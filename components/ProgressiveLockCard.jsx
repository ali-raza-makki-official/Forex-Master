'use client';
import { useWebSocket } from '@/components/WebSocketProvider';

export default function ProgressiveLockCard({ position, lockState }) {
  // Logic to determine zone based on pips
  const pips = lockState?.pips || 0;
  let zone = 'ENTRY';
  let zoneColor = 'text-white/40';
  let bgColor = 'bg-white/5';

  if (pips >= 10 && pips < 35) {
    zone = 'PROFIT LOCK';
    zoneColor = 'text-accent-green';
    bgColor = 'bg-accent-green/10';
  } else if (pips >= 35) {
    zone = 'MOON ZONE';
    zoneColor = 'text-accent-gold';
    bgColor = 'bg-accent-gold/10';
  }

  const profit = parseFloat(position.profit || 0);

  return (
    <div className={`p-4 rounded-2xl border border-white/5 ${bgColor} transition-all duration-500`}>
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
           <span className={`text-[10px] font-black px-2 py-0.5 rounded bg-black/40 ${position.type === 'BUY' ? 'text-accent-green' : 'text-accent-red'}`}>
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
        <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden">
           <div 
            className={`h-full transition-all duration-1000 ${zone === 'ENTRY' ? 'bg-white/20' : zone === 'PROFIT LOCK' ? 'bg-accent-green shadow-[0_0_8px_rgba(0,212,168,0.4)]' : 'bg-accent-gold shadow-[0_0_8px_rgba(245,166,35,0.4)]'}`}
            style={{ width: `${Math.min((pips / 70) * 100, 100)}%` }}
           ></div>
        </div>

        <div className="flex justify-between items-center">
           <div className="flex flex-col">
              <span className="text-[7px] text-text-secondary uppercase font-black tracking-widest">Active Zone</span>
              <span className={`text-[10px] font-black uppercase italic ${zoneColor}`}>{zone}</span>
           </div>
           <div className="text-right flex flex-col">
              <span className="text-[7px] text-text-secondary uppercase font-black tracking-widest">Locked</span>
              <span className="text-[10px] font-black text-white">+{pips} <span className="text-[7px] opacity-40 font-normal">PIPS</span></span>
           </div>
        </div>
      </div>
    </div>
  );
}
