/**
 * Progressive Lock (Trailing SL) Logic
 * Moves Stop Loss to lock profits as the trade moves in our favor.
 * Synchronizes with database schema and updates frontend in real-time.
 */

const WebSocket = require('ws');
const { getPipMultiplier, getDecimalPlaces } = require('./atrEngine');

// Cache to detect zone changes for toast notifications
const lastKnownZones = new Map();

async function checkAndUpdateLocks(positions, livePrices, mt5Client, db, broadcastFn) {
    if (!Array.isArray(positions)) return;

    // Fetch dynamic sl_mode from settings
    let slMode = 'DYNAMIC';
    try {
        const settings = await db.getSystemSettings();
        slMode = settings.sl_mode || 'DYNAMIC';
    } catch (err) {
        console.error('[LOCK ERROR] Failed to fetch settings for SL mode:', err.message);
    }

    if (slMode === 'STATIC') return; // Early exit: Static mode keeps SL fixed permanently

    for (const pos of positions) {
        if (!pos || !pos.symbol || !pos.type || !pos.openPrice) {
            console.warn('[LOCK] Incomplete position data received, skipping progressive lock evaluation:', pos);
            continue;
        }

        const symbol = pos.symbol;
        const currentPrice = livePrices[symbol]?.bid;
        if (!currentPrice) continue;

        const ticket = pos.ticket || pos.id;
        const entry = pos.openPrice;
        
        const multiplier = getPipMultiplier(symbol);
        const decimals = getDecimalPlaces(symbol);

        // Calculate current floating profit in pips
        const diff = pos.type === 'BUY' ? (currentPrice - entry) : (entry - currentPrice);
        const profitPips = parseFloat((diff * multiplier).toFixed(1));

        // Determine Zone configuration based on profit pips and trading mode
        let zone = 'ENTRY';
        let lockPips = 0;
        let protectPct = 0;
        let nextLockPips = 30;
        let nextProtectPips = 10;

        if (slMode === 'SCALP_TRAIL') {
            // Mode 3: SCALP-TRAIL (Aggressive dynamic trailing stop of 10 pips)
            if (profitPips >= 10) {
                zone = 'SCALP_TRAIL';
                lockPips = Math.floor(profitPips - 10); // Maintain tight 10-pip distance
                protectPct = Math.min(100, Math.floor((lockPips / profitPips) * 100));
                nextLockPips = Math.floor(profitPips + 5);
                nextProtectPips = Math.floor(profitPips - 5);
            }
        } else if (slMode === 'BREAK_EVEN') {
            // Mode 4: BREAK-EVEN LOCK (Lock BE+3 pips once at +20 pips profit, no further trailing)
            if (profitPips >= 20) {
                zone = 'BREAK_EVEN';
                lockPips = 3; // Lock 3 pips profit to cover spreads/commissions (Risk-free trade!)
                protectPct = 100;
                nextLockPips = null;
                nextProtectPips = null;
            }
        } else {
            // Mode 1: DYNAMIC (Default Trailing SL / Zone Protection)
            if (profitPips >= 100) {
                zone = 'MONSTER';
                lockPips = 70;
                protectPct = 70;
                nextLockPips = null;
                nextProtectPips = null;
            } else if (profitPips >= 80) {
                zone = 'STRONG';
                lockPips = 50;
                protectPct = 62;
                nextLockPips = 100;
                nextProtectPips = 70;
            } else if (profitPips >= 60) {
                zone = 'MID';
                lockPips = 35;
                protectPct = 58;
                nextLockPips = 80;
                nextProtectPips = 50;
            } else if (profitPips >= 30) {
                zone = 'EARLY';
                lockPips = 10;
                protectPct = 33;
                nextLockPips = 60;
                nextProtectPips = 35;
            }
        }

        // Calculate Locked SL Price dynamically based on pip multiplier and decimals
        const lockPrice = pos.type === 'BUY' 
            ? parseFloat((entry + lockPips / multiplier).toFixed(decimals))
            : parseFloat((entry - lockPips / multiplier).toFixed(decimals));

        // Send real-time state update to frontend (Always stream the latest state so cards are live!)
        if (broadcastFn) {
            const prevZone = lastKnownZones.get(ticket) || 'ENTRY';
            const zoneChanged = prevZone !== zone && zone !== 'ENTRY';
            
            if (zoneChanged || !lastKnownZones.has(ticket)) {
                lastKnownZones.set(ticket, zone);
            }

            const emojis = { ENTRY: '🔵', EARLY: '🟡', MID: '🟠', STRONG: '🔴', MONSTER: '🟣' };

            broadcastFn({
                event: 'lock_update',
                ticket: ticket,
                zone,
                profitPips,
                lockPips,
                lockPrice,
                protectPct,
                nextLockPips,
                nextProtectPips,
                zoneChanged,
                zoneEmoji: emojis[zone] || '🔵'
            });
        }

        // Execute MT5 modification only if lockPips > 0 and it represents a genuine SL improvement
        if (lockPips > 0) {
            const currentSL = pos.sl || 0;
            const isBetter = pos.type === 'BUY' 
                ? (currentSL === 0 || lockPrice > currentSL) 
                : (currentSL === 0 || lockPrice < currentSL);

            if (isBetter) {
                console.log(`[LOCK] Upgrading ${symbol} Ticket #${ticket} to ${zone} (+${lockPips} Pips) SL: ${lockPrice}`);
                
                // 1. Send update command to MT5 bridge
                if (mt5Client && mt5Client.readyState === WebSocket.OPEN) {
                    mt5Client.send(JSON.stringify({
                        action: 'modify_sl',
                        ticket: ticket,
                        sl: lockPrice
                    }));
                }

                // 2. Persist in MySQL DB under the correct table 'lock_events'
                try {
                    const conn = await db.getDB();
                    await conn.execute(
                        'INSERT INTO lock_events (ticket, symbol, profit_pips, lock_pips, lock_price, zone) VALUES (?, ?, ?, ?, ?, ?)',
                        [ticket, symbol, profitPips, lockPips, lockPrice, zone]
                    );
                } catch (dbErr) {
                    console.error('[DB ERROR] Failed to log lock event:', dbErr.message);
                }
            }
        }
    }

    // Clean up cached tickets that are no longer active
    const activeTickets = new Set(positions.map(p => p.ticket || p.id));
    for (const cachedTicket of lastKnownZones.keys()) {
        if (!activeTickets.has(cachedTicket)) {
            lastKnownZones.delete(cachedTicket);
        }
    }
}

module.exports = { checkAndUpdateLocks };
