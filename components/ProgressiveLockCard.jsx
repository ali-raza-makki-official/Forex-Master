'use client';
import React from 'react';

const ZONE_THEMES = {
  'ENTRY':   { label: 'ENTRY ZONE',   color: 'text-blue-400',   bgColor: 'bg-blue-500/5 border-blue-500/10',   progressColor: 'bg-blue-500' },
  'EARLY':   { label: 'EARLY ZONE',   color: 'text-yellow-500', bgColor: 'bg-yellow-500/5 border-yellow-500/10', progressColor: 'bg-yellow-500' },
  'MID':     { label: 'MID ZONE',     color: 'text-orange-500',  bgColor: 'bg-orange-500/5 border-orange-500/10',   progressColor: 'bg-orange-500' },
  'STRONG':  { label: 'STRONG ZONE',  color: 'text-red-500',    bgColor: 'bg-red-500/5 border-red-500/10',       progressColor: 'bg-red-500' },
  'MONSTER': { label: 'MONSTER ZONE', color: 'text-purple-500', bgColor: 'bg-purple-500/5 border-purple-500/10', progressColor: 'bg-purple-500' }
};

export default function ProgressiveLockCard({ position, lockState }) {
  const zone = lockState?.zone || 'ENTRY';
  const theme = ZONE_THEMES[zone] || ZONE_THEMES['ENTRY'];
  
  const profitPips = lockState?.profitPips || 0;
  const lockPips = lockState?.lockPips || 0;
  const nextLockPips = lockState?.nextLockPips || 30;

  const profit = parseFloat(position.profit || 0);
  const progressPercent = Math.min(100, Math.max(0, (profitPips / nextLockPips) * 100));

  return (
    <div className={`p-4 rounded-2xl border ${theme.bgColor} transition-all duration-500 hover:scale-[1.01]`}>
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
           <span className={`text-[9px] font-black px-2 py-0.5 rounded bg-black/40 ${position.type === 'BUY' ? 'text-accent-green' : 'text-accent-red'}`}>
            {position.type}
           </span>
           <span className="text-[10px] font-black text-white font-mono">#{position.ticket}</span>
        </div>
        <span className={`text-sm font-black ${profit >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
          {profit >= 0 ? '+' : ''}${profit.toFixed(2)}
        </span>
      </div>

      <div className="space-y-3">
        {/* PROGRESS BAR TO NEXT ZONE */}
        <div className="relative h-1.5 w-full bg-black/40 rounded-full overflow-hidden">
           <div 
            className={`absolute h-full transition-all duration-1000 ease-out ${theme.progressColor}`}
            style={{ width: `${progressPercent}%` }}
           ></div>
        </div>

        <div className="flex justify-between items-center">
           <div className="flex flex-col">
              <span className="text-[7px] text-text-secondary uppercase font-black tracking-widest leading-none mb-1">Active Zone</span>
              <span className={`text-[10px] font-black uppercase italic leading-none ${theme.color}`}>{theme.label}</span>
           </div>
           <div className="text-right flex flex-col">
              <span className="text-[7px] text-text-secondary uppercase font-black tracking-widest leading-none mb-1">Locked</span>
              <span className="text-[10px] font-black text-white leading-none">
                 +{lockPips.toFixed(1)} <span className="text-[7px] opacity-40 font-normal">PIPS</span>
              </span>
           </div>
        </div>
      </div>
    </div>
  );
}
