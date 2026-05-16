const db = require('./db');

/**
 * Calculates Average True Range (ATR) based on the last N price ticks.
 * Since we have tick data, we simulate 'candles' by grouping ticks.
 */
async function calculateATR(symbol = 'XAUUSD', period = 14) {
    const conn = await db.getDB();
    
    // We fetch more ticks to ensure we can form 'period' groups
    // In a high-speed system, we might use a small number of ticks per 'candle' (e.g. 100 ticks)
    const ticksPerCandle = 100; 
    const totalTicksNeeded = ticksPerCandle * (period + 1);
    
    const [ticks] = await conn.execute(`
        SELECT bid as price FROM price_data 
        WHERE symbol = ? 
        ORDER BY id DESC 
        LIMIT ?
    `, [symbol, totalTicksNeeded]);

    if (ticks.length < totalTicksNeeded) return 0;

    const candles = [];
    for (let i = 0; i < ticks.length; i += ticksPerCandle) {
        const slice = ticks.slice(i, i + ticksPerCandle);
        if (slice.length < ticksPerCandle) break;
        
        const high = Math.max(...slice.map(t => t.price));
        const low = Math.min(...slice.map(t => t.price));
        const close = slice[0].price; // Latest in slice
        const prevClose = slice[slice.length - 1].price; // Oldest in slice
        
        candles.push({ high, low, close, prevClose });
    }

    // Calculate True Range (TR) for each 'candle'
    const trs = candles.slice(0, period).map(c => {
        return Math.max(
            c.high - c.low,
            Math.abs(c.high - c.prevClose),
            Math.abs(c.low - c.prevClose)
        );
    });

    // Simple Moving Average of TR
    const atr = trs.reduce((a, b) => a + b, 0) / period;
    return parseFloat(atr.toFixed(3));
}

module.exports = { calculateATR };
