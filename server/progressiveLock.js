/**
 * Progressive Lock (Trailing SL) Logic
 * Moves Stop Loss to lock profits as the trade moves in our favor.
 */

const LOCK_STAGES = [
    { target: 30, lock: 10 },   // If +30 pips, move SL to +10 pips (BreakEven+)
    { target: 60, lock: 35 },   // If +60 pips, move SL to +35 pips
    { target: 100, lock: 70 }   // If +100 pips, move SL to +70 pips
];

async function checkAndUpdateLocks(positions, livePrices, mt5Client, db) {
    for (const pos of positions) {
        const symbol = pos.symbol;
        const currentPrice = livePrices[symbol]?.bid;
        if (!currentPrice) continue;

        // Calculate current profit in pips
        const entry = pos.openPrice;
        const diff = pos.type === 'BUY' ? (currentPrice - entry) : (entry - currentPrice);
        const pips = parseFloat((diff * 10).toFixed(1));

        // Find the best lock stage achieved
        let bestLock = null;
        for (const stage of LOCK_STAGES) {
            if (pips >= stage.target) {
                bestLock = stage.lock;
            }
        }

        if (bestLock !== null) {
            // Calculate new SL price
            const newSL = pos.type === 'BUY' 
                ? (entry + bestLock / 10) 
                : (entry - bestLock / 10);
            
            // Only update if the new SL is better than current SL
            const isBetter = pos.type === 'BUY' ? (newSL > pos.sl) : (newSL < pos.sl);

            if (isBetter) {
                console.log(`[LOCK] Updating ${symbol} Ticket ${pos.id} to +${bestLock} pips`);
                
                // Send update command to MT5
                mt5Client.send(JSON.stringify({
                    action: 'modify_sl',
                    ticket: pos.id,
                    sl: newSL
                }));

                // Record in DB
                const conn = await db.getDB();
                await conn.execute(
                    'INSERT INTO lock_logs (ticket, pips_locked, sl_price) VALUES (?, ?, ?)',
                    [pos.id, bestLock, newSL]
                );
            }
        }
    }
}

module.exports = { checkAndUpdateLocks };
