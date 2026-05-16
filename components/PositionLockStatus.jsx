'use client';

import React from 'react';

const ZONE_CONFIG = {
  'ENTRY':   { color: '#3b82f6', label: 'ENTRY ZONE',  emoji: '🔵' },
  'EARLY':   { color: '#eab308', label: 'EARLY ZONE',  emoji: '🟡' },
  'MID':     { color: '#f97316', label: 'MID ZONE',    emoji: '🟠' },
  'STRONG':  { color: '#ef4444', label: 'STRONG ZONE', emoji: '🔴' },
  'MONSTER': { color: '#a855f7', label: 'MONSTER ZONE',emoji: '🟣' }
};

export default function PositionLockStatus({ ticket, lockData }) {
  if (!lockData) return null;

  const { zone, profitPips, lockPips, lockPrice, protectPct, nextLockPips, nextProtectPips } = lockData;
  const config = ZONE_CONFIG[zone] || ZONE_CONFIG['ENTRY'];

  return (
    <div className="bg-[#0a0e1a]/50 border-t border-[#1f2937] p-3 animate-in slide-in-from-top-1">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm" style={{ color: config.color }}>{config.emoji} {config.label}</span>
          <span className="text-[#9ca3af] text-xs">·</span>
          <span className={`text-xs font-bold ${profitPips >= 0 ? 'text-[#00d4a8]' : 'text-[#ff4757]'}`}>
            {profitPips > 0 ? '+' : ''}{profitPips.toFixed(1)} pips profit
          </span>
        </div>
        <div className="text-xs text-[#9ca3af]">
          Protected: <span className="text-white font-mono">{protectPct}%</span>
        </div>
      </div>

      <div className="relative w-full h-2 bg-[#1f2937] rounded-full overflow-hidden mb-2">
        {/* Profit portion */}
        <div 
          className="absolute h-full bg-[#f5a623] transition-all duration-500 ease-out"
          style={{ width: `${Math.min(100, Math.max(0, (profitPips / (nextLockPips || 100)) * 100))}%` }}
        />
        {/* Locked portion */}
        <div 
          className="absolute h-full transition-all duration-500 ease-out opacity-60"
          style={{ 
            width: `${protectPct}%`,
            backgroundColor: config.color 
          }}
        />
      </div>

      <div className="flex justify-between items-end">
        <div className="text-[11px] text-[#9ca3af]">
          SL locked at <span className="text-white font-mono">{lockPrice.toFixed(2)}</span> 
          <span className="ml-1 text-[#00d4a8]">(+{lockPips.toFixed(1)} pips)</span>
        </div>
        {nextLockPips && (
          <div className="text-[11px] text-[#9ca3af] text-right">
            Next lock: <span className="text-white">{nextLockPips} pips</span> → <span className="text-[#00d4a8]">{nextProtectPips} pips</span>
          </div>
        )}
      </div>
    </div>
  );
}
