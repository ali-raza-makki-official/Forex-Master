/**
 * Spread Monitor Logic (Server-side)
 * Ensures high-speed price data is within safe limits for HFT.
 */

let maxAllowedSpread = 5.0; // Pips

function startSpreadBroadcast(livePrices, broadcastFn) {
    setInterval(() => {
        if (!livePrices['XAUUSD']) return;

        const { bid, ask } = livePrices['XAUUSD'];
        const pips = parseFloat((Math.abs(ask - bid) * 10).toFixed(1));
        const isSafe = pips <= maxAllowedSpread;

        broadcastFn({
            event: 'spread_update',
            symbol: 'XAUUSD',
            pips,
            isSafe
        });
    }, 1000); // Check every second
}

function checkSpread(symbol, bid, ask, maxSpread = null) {
    const limit = maxSpread !== null ? maxSpread : maxAllowedSpread;
    const pips = parseFloat((Math.abs(ask - bid) * 10).toFixed(1));
    return {
        allowed: pips <= limit,
        pips: pips,
        reason: pips > limit ? `Spread too high: ${pips} pips (Limit: ${limit})` : null
    };
}

module.exports = { startSpreadBroadcast, checkSpread };
