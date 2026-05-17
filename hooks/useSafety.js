'use client';
import { useState, useEffect } from 'react';

/**
 * Spread Monitor Logic:
 * Checks if current Bid/Ask spread exceeds safe limit (Max 5 pips).
 */
export function useSpreadMonitor(prices, symbol = 'XAUUSD', maxSpread = 5.0) {
  const [spreadStatus, setSpreadStatus] = useState({ 
    pips: 0, 
    isSafe: true,
    limit: maxSpread 
  });

  useEffect(() => {
    if (!prices || !prices[symbol]) return;

    const { bid, ask } = prices[symbol];
    // Metals (Gold/Silver) use 10, FX uses 10000
    const multiplier = (symbol.includes('XAU') || symbol.includes('GOLD') || symbol.includes('XAG') || symbol.includes('SILVER')) ? 10 : 10000;
    const diff = Math.abs(ask - bid);
    const pips = parseFloat((diff * multiplier).toFixed(1));
    const isSafe = pips <= maxSpread;

    setSpreadStatus({ pips, isSafe, limit: maxSpread });
  }, [prices, symbol, maxSpread]);

  return spreadStatus;
}

/**
 * News Filter Logic:
 * Fetches high-impact news and checks if we are within 'danger zone' (30 mins before/after).
 * Note: This can be extended with a real news API. For now, we use a manual/server-driven block.
 */
export function useNewsFilter() {
  const [newsBlock, setNewsBlock] = useState({
    isActive: false,
    event: null,
    countdown: null
  });

  // Simulation for now, will be connected to server.js cron job later
  return newsBlock;
}

/**
 * Daily Drawdown Logic:
 * Prevents over-trading if loss threshold hit.
 */
export function useRiskGuard(balance, tradeStats) {
  const [riskStatus, setRiskStatus] = useState({
    isBlocked: false,
    reason: null
  });

  useEffect(() => {
    if (!tradeStats) return;

    // Rule 1: Max 3 consecutive SL hits (Simulated from last trades)
    // Rule 2: Max daily loss (e.g. $50)
    const dailyLossLimit = 50;
    
    // In a real system, we'd check current P/L from balance vs start-of-day balance
    // For now, we provide the hook to be used in AutoScalpEngine
  }, [balance, tradeStats]);

  return riskStatus;
}
