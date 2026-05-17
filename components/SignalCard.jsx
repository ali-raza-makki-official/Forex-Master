'use client';
import { useState, useEffect } from 'react';
import { useWebSocket } from '@/components/WebSocketProvider';

export default function SignalCard() {
  const { signals } = useWebSocket();
  const latestSignal = signals?.[0];

  if (!latestSignal) {
    return (
      <div className="p-6 border border-dashed border-white/5 rounded-2xl bg-white/[0.02] text-center">
        <div className="w-8 h-8 border-2 border-accent-gold/20 border-t-accent-gold rounded-full animate-spin mx-auto mb-3"></div>
        <p className="text-[10px] text-text-secondary uppercase font-black tracking-widest">Scanning Market Leaders...</p>
      </div>
    );
  }

  return (
    <div className={`p-4 rounded-2xl border ${latestSignal.type === 'BUY' ? 'bg-accent-green/5 border-accent-green/20' : 'bg-accent-red/5 border-accent-red/20'} animate-in zoom-in duration-300`}>
      <div className="flex justify-between items-start mb-3">
        <div className="flex flex-col">
          <span className={`text-xl font-black italic ${latestSignal.type === 'BUY' ? 'text-accent-green' : 'text-accent-red'}`}>
            {latestSignal.type} GOLD
          </span>
          <span className="text-[9px] text-text-secondary font-bold uppercase">{new Date(latestSignal.timestamp).toLocaleTimeString()}</span>
        </div>
        <div className="text-right">
          <span className="text-xs font-black text-white font-mono">${latestSignal.goldPrice}</span>
          <div className="flex items-center gap-1 mt-1 justify-end">
            <div className="w-1.5 h-1.5 rounded-full bg-accent-gold animate-pulse"></div>
            <span className="text-[8px] font-black text-accent-gold uppercase tracking-tighter">Score: {latestSignal.score}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-4">
        <div className="p-2 bg-black/40 rounded-lg border border-white/5">
          <span className="text-[7px] text-text-secondary uppercase font-bold block mb-0.5">Target (TP)</span>
          <span className="text-[10px] font-black text-accent-green">${latestSignal.tp}</span>
        </div>
        <div className="p-2 bg-black/40 rounded-lg border border-white/5">
          <span className="text-[7px] text-text-secondary uppercase font-bold block mb-0.5">Safety (SL)</span>
          <span className="text-[10px] font-black text-accent-red">${latestSignal.sl}</span>
        </div>
      </div>
    </div>
  );
}
