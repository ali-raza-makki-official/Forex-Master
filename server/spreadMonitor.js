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

function checkSpread(symbol, bid, ask) {
    const pips = parseFloat((Math.abs(ask - bid) * 10).toFixed(1));
    return {
        allowed: pips <= maxAllowedSpread,
        pips: pips,
        reason: pips > maxAllowedSpread ? `Spread too high: ${pips} pips` : null
    };
}

module.exports = { startSpreadBroadcast, checkSpread };
