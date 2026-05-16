'use client';
import { useState, useEffect } from 'react';

/**
 * Spread Monitor Logic:
 * Checks if current Bid/Ask spread exceeds safe limit (Max 5 pips).
 */
export function useSpreadMonitor(prices) {
  const [spreadStatus, setSpreadStatus] = useState({ 
    pips: 0, 
    isSafe: true,
    limit: 5.0 
  });

  useEffect(() => {
    if (!prices || !prices['XAUUSD']) return;

    const { bid, ask } = prices['XAUUSD'];
    // In Gold, 1 pip = 0.10. So (Ask - Bid) * 10 = Pips
    const diff = Math.abs(ask - bid);
    const pips = parseFloat((diff * 10).toFixed(1));
    const isSafe = pips <= spreadStatus.limit;

    setSpreadStatus(prev => ({ ...prev, pips, isSafe }));
  }, [prices]);

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
