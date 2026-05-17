/**
 * Spread Monitor Logic (Server-side)
 * Ensures high-speed price data is within safe limits for HFT.
 */

function startSpreadBroadcast(livePrices, db, broadcastFn) {
    setInterval(async () => {
        try {
            const settings = await db.getSystemSettings().catch(() => ({}));
            const leader = settings?.leader_symbol || 'XAUUSD';
            const limit = settings?.max_spread || 5.0;

            if (!livePrices[leader]) return;

            const { bid, ask } = livePrices[leader];
            
            // Dynamic multiplier: Metals use 10, currency pairs use 10000
            const multiplier = (leader.includes('XAU') || leader.includes('GOLD') || leader.includes('XAG') || leader.includes('SILVER')) ? 10 : 10000;
            const pips = parseFloat((Math.abs(ask - bid) * multiplier).toFixed(1));
            const isSafe = pips <= limit;

            broadcastFn({
                event: 'spread_update',
                symbol: leader,
                pips,
                isSafe,
                limit
            });
        } catch (err) {
            // Safe fallback
        }
    }, 1000); // Check every second
}

function checkSpread(symbol, bid, ask, maxSpread = 5.0) {
    const limit = maxSpread;
    const multiplier = (symbol.includes('XAU') || symbol.includes('GOLD') || symbol.includes('XAG') || symbol.includes('SILVER')) ? 10 : 10000;
    const pips = parseFloat((Math.abs(ask - bid) * multiplier).toFixed(1));
    return {
        allowed: pips <= limit,
        pips: pips,
        reason: pips > limit ? `Spread too high: ${pips} pips (Limit: ${limit})` : null
    };
}

module.exports = { startSpreadBroadcast, checkSpread };
