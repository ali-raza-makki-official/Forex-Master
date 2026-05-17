// server/atrEngine.js
// ATR = Average True Range from last 14 candles (5-min)
// MT5 se candle data nahi milta directly — isliye
// price history se khud calculate karte hain

const candleData = {};  // { symbol: [{ open, high, low, close, time }] }

// New price tick aane pe candle update karo
function onPriceTick(symbol, bid, ask) {
  const mid     = (bid + ask) / 2;
  const nowMin5 = Math.floor(Date.now() / (5 * 60 * 1000)) * (5 * 60 * 1000);

  if (!candleData[symbol]) candleData[symbol] = [];
  const candles = candleData[symbol];
  const last    = candles[candles.length - 1];

  const newCandle = { open: mid, high: mid, low: mid, close: mid, time: nowMin5 };

  if (last && last.time === nowMin5) {
    // Atomically assign values to prevent tick-level race conditions
    Object.assign(last, {
      high: Math.max(last.high, mid),
      low: Math.min(last.low, mid),
      close: mid
    });
  } else {
    // Safe sequential push and shift to avoid out-of-order mutations
    candles.push(newCandle);
    while (candles.length > 50) {
      candles.shift();
    }
  }
}

// Calculate ATR(14) from stored candles
function calculateATR(symbol, period = 14) {
  const candles = candleData[symbol];
  if (!candles || candles.length < period + 1) return null;

  const recent = candles.slice(-(period + 1));
  let trSum = 0;

  for (let i = 1; i < recent.length; i++) {
    const curr = recent[i];
    const prev = recent[i - 1];
    // True Range = max of:
    // (1) High - Low of current candle
    // (2) |High - Previous Close|
    // (3) |Low  - Previous Close|
    const tr = Math.max(
      curr.high - curr.low,
      Math.abs(curr.high - prev.close),
      Math.abs(curr.low  - prev.close)
    );
    trSum += tr;
  }

  return parseFloat((trSum / period).toFixed(5));
}

function getPipMultiplier(symbol) {
  const sym = symbol.toUpperCase();
  if (sym.includes('JPY')) return 100;
  if (sym.includes('XAU') || sym.includes('GOLD')) return 100; // Gold: $1 move = 100 pips / points
  if (sym.includes('XAG') || sym.includes('SILVER')) return 100; // Silver: $1 move = 100 pips
  if (sym.includes('US30') || sym.includes('DJI') || sym.includes('NAS') || sym.includes('SPX') || sym.includes('UK100') || sym.includes('GER30')) return 1; // Indices: $1 move = 1 pip / point
  if (sym.includes('BTC')) return 1; // BTC: $1 move = 1 pip
  if (sym.includes('ETH')) return 1000; // ETH: $1 move = 1000 pips
  return 10000; // Standard FX (EURUSD, GBPUSD, etc.)
}

function getDecimalPlaces(symbol) {
  const sym = symbol.toUpperCase();
  if (sym.includes('JPY')) return 3;
  if (sym.includes('US30') || sym.includes('DJI') || sym.includes('NAS') || sym.includes('SPX') || sym.includes('UK100') || sym.includes('GER30')) return 1;
  if (sym.includes('BTC') || sym.includes('ETH') || sym.includes('XAU') || sym.includes('GOLD')) return 2;
  if (sym.includes('XAG') || sym.includes('SILVER')) return 3;
  return 5; // Standard FX
}

// Calculate dynamic SL/TP using ATR
function getDynamicSLTP(symbol, signalType, currentPrice) {
  const atr = calculateATR(symbol);
  if (atr === null || atr === undefined) {
    // Fallback to fixed pips if not enough data yet
    return getFallbackSLTP(symbol, signalType, currentPrice);
  }

  const multiplier = getPipMultiplier(symbol);
  const decimals = getDecimalPlaces(symbol);

  // Volatility-guided ATR multipliers (1:1.5 Risk-Reward)
  const SL_MULT = 1.0;   // 1x ATR stop loss
  const TP_MULT = 1.5;   // 1.5x ATR take profit

  const slDistance = parseFloat((atr * SL_MULT).toFixed(decimals));
  const tpDistance = parseFloat((atr * TP_MULT).toFixed(decimals));
  const slPips     = parseFloat((slDistance * multiplier).toFixed(1));
  const tpPips     = parseFloat((tpDistance * multiplier).toFixed(1));

  let sl, tp;
  if (signalType === 'BUY') {
    sl = parseFloat((currentPrice - slDistance).toFixed(decimals));
    tp = parseFloat((currentPrice + tpDistance).toFixed(decimals));
  } else {
    sl = parseFloat((currentPrice + slDistance).toFixed(decimals));
    tp = parseFloat((currentPrice - tpDistance).toFixed(decimals));
  }

  return {
    sl, tp, slPips, tpPips,
    atr:          parseFloat(atr.toFixed(decimals)),
    atrPips:      parseFloat((atr * multiplier).toFixed(1)),
    riskReward:   '1:1.5',
    source:       'ATR-14',
    isFallback:   false
  };
}

// Fallback if ATR not available (less than 15 candles collected)
function getFallbackSLTP(symbol, signalType, currentPrice) {
  const multiplier = getPipMultiplier(symbol);
  const decimals = getDecimalPlaces(symbol);

  const isGold = symbol.toUpperCase().includes('XAU') || symbol.toUpperCase().includes('GOLD');
  const FIXED_SL_PIPS = isGold ? 8 : 10;
  const FIXED_TP_PIPS = isGold ? 12 : 15;
  
  const SL_DIST = FIXED_SL_PIPS / multiplier;
  const TP_DIST = FIXED_TP_PIPS / multiplier;

  const rawSL = signalType === 'BUY' ? currentPrice - SL_DIST : currentPrice + SL_DIST;
  const rawTP = signalType === 'BUY' ? currentPrice + TP_DIST : currentPrice - TP_DIST;

  return {
    sl:         parseFloat(rawSL.toFixed(decimals)),
    tp:         parseFloat(rawTP.toFixed(decimals)),
    slPips:     FIXED_SL_PIPS,
    tpPips:     FIXED_TP_PIPS,
    atr:        null,
    riskReward: '1:1.5',
    source:     'Fixed (ATR collecting...)',
    isFallback: true
  };
}

// ATR volatility label for frontend
function getVolatilityLabel(atrPips) {
  if (!atrPips)      return { label: 'Unknown', color: '#888' };
  if (atrPips < 8)   return { label: 'Low',     color: '#3b82f6' };
  if (atrPips < 15)  return { label: 'Normal',  color: '#00d4a8' };
  if (atrPips < 25)  return { label: 'High',    color: '#f5a623' };
  return               { label: 'Extreme',       color: '#ff4757' };
}

module.exports = { onPriceTick, calculateATR, getDynamicSLTP, getVolatilityLabel };
