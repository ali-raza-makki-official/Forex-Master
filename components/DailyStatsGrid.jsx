'use client';

import React from 'react';

export default function DailyStatsGrid({ stats }) {
  // Default values if stats not provided
  const {
    tradesToday = 0,
    winRate = 0,
    dailyPL = 0,
    drawdown = 0,
    limitReached = false
  } = stats || {};

  const dailyStats = stats;

  return (
    <div className="w-full space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-bg-tertiary/40 border border-white/5 p-4 rounded-2xl flex flex-col gap-1 shadow-inner group hover:border-accent-gold/20 transition-colors">
          <span className="text-[7px] text-accent-gold font-black uppercase tracking-[0.2em] opacity-60 group-hover:opacity-100 transition-opacity">Trades Today</span>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-black text-white">{dailyStats?.tradesToday || 0}</span>
            <span className="text-[10px] text-text-secondary font-bold">/ 10</span>
          </div>
          {dailyStats?.tradesToday >= 8 && (
            <div className="text-[7px] text-accent-red font-bold uppercase animate-pulse mt-1">Daily Limit Near</div>
          )}
        </div>

        <div className="bg-bg-tertiary/40 border border-white/5 p-4 rounded-2xl flex flex-col gap-1 shadow-inner group hover:border-accent-green/20 transition-colors">
          <span className="text-[7px] text-accent-green font-black uppercase tracking-[0.2em] opacity-60 group-hover:opacity-100 transition-opacity">Win Rate</span>
          <span className="text-lg font-black text-white">{dailyStats?.winRate || 0}%</span>
        </div>

        <div className="bg-bg-tertiary/40 border border-white/5 p-4 rounded-2xl flex flex-col gap-1 shadow-inner group hover:border-accent-blue/20 transition-colors">
          <span className="text-[7px] text-accent-blue font-black uppercase tracking-[0.2em] opacity-60 group-hover:opacity-100 transition-opacity">Daily P&L</span>
          <span className={`text-lg font-black ${dailyStats?.dailyPL >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
            {dailyStats?.dailyPL >= 0 ? '+' : ''}${Math.abs(dailyStats?.dailyPL || 0).toFixed(2)}
          </span>
        </div>

        <div className="bg-bg-tertiary/40 border border-white/5 p-4 rounded-2xl flex flex-col gap-1 shadow-inner group hover:border-accent-red/20 transition-colors">
          <span className="text-[7px] text-accent-red font-black uppercase tracking-[0.2em] opacity-60 group-hover:opacity-100 transition-opacity">Max Drawdown</span>
          <span className="text-lg font-black text-white">${(dailyStats?.drawdown || 0).toFixed(2)}</span>
        </div>
      </div>

      {limitReached && (
        <div className="w-full py-2 bg-red-500/20 border border-red-500 rounded flex items-center justify-center animate-pulse">
          <span className="text-red-500 text-[11px] font-bold uppercase tracking-widest">
            DAILY LIMIT REACHED — Trading paused
          </span>
        </div>
      )}
    </div>
  );
}
