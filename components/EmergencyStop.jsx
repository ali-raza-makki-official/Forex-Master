'use client';

import React, { useState, useEffect } from 'react';
import { ShieldOff } from 'lucide-react';
import { useToast } from './ToastSystem';

export default function EmergencyStop({ socket, autoScalp }) {
  const [isStopped, setIsStopped] = useState(false);
  const { addToast } = useToast();

  const handleStop = () => {
    if (isStopped) return;
    
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ action: 'emergency_stop' }));
    }
    
    addToast("STOP executed — all systems paused", "error");
    setIsStopped(true);
    setTimeout(() => setIsStopped(false), 10000);
  };

  return (
    <button
      onClick={handleStop}
      disabled={isStopped}
      className={`w-full h-[52px] rounded-lg flex flex-col items-center justify-center transition-all duration-300 relative overflow-hidden ${
        isStopped 
          ? 'bg-gray-600 cursor-not-allowed' 
          : 'bg-[#ff4757] hover:bg-[#ff3041] active:scale-95'
      }`}
    >
      {/* Pulsing ring animation when auto-scalp is ON */}
      {autoScalp && !isStopped && (
        <div className="absolute inset-0 border-2 border-white rounded-lg animate-ping opacity-20 pointer-events-none"></div>
      )}

      <div className="flex items-center gap-2">
        <ShieldOff size={20} className="text-white" />
        <span className="text-white font-bold text-[16px]">
          {isStopped ? 'STOPPED' : 'EMERGENCY STOP'}
        </span>
      </div>
      
      {!isStopped && (
        <span className="text-white/80 text-[10px] uppercase tracking-wider">
          Close all · Pause engine · Alert Telegram
        </span>
      )}
      
      {isStopped && (
        <span className="text-white/80 text-[10px] uppercase tracking-wider">
          Safety lock active (10s)
        </span>
      )}
    </button>
  );
}
