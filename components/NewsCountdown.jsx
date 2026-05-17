'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

export default function NewsCountdown({ newsData }) {
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    if (!newsData || !newsData.nextNewsMs) {
      setTimeLeft(null);
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const diff = newsData.nextNewsMs - now;

      if (diff <= 0) {
        setTimeLeft(0);
        clearInterval(interval);
      } else {
        setTimeLeft(diff);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [newsData]);

  if (!newsData || !newsData.nextNewsMs || (timeLeft === null && !newsData.isActive)) {
    return null;
  }

  // Format MM:SS
  const formatTime = (ms) => {
    if (ms <= 0) return "00:00";
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isActive = newsData.isActive;

  return (
    <div className={`w-full h-10 sticky top-0 z-40 border-b flex items-center px-4 transition-all duration-500 overflow-hidden ${
      isActive 
        ? 'bg-[#1a0000] border-red-500 text-red-500' 
        : 'bg-[#1a1200] border-[#f5a623] text-[#f5a623]'
    }`}>
      <div className="flex items-center gap-2 flex-1">
        <AlertTriangle size={16} className={isActive ? 'animate-pulse' : ''} />
        <span className="text-xs font-bold uppercase tracking-widest truncate max-w-[200px]">
          {newsData.nextNewsName || 'High Impact News'}
        </span>
      </div>

      <div className="flex-1 text-center font-mono font-bold text-sm">
        {isActive ? (
          <span>ALL SIGNALS BLOCKED — Resumes in {formatTime(timeLeft)}</span>
        ) : (
          <span>Signals paused in {formatTime(timeLeft)}</span>
        )}
      </div>

      <div className="flex-1 flex justify-end items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-tighter">
          {isActive ? 'NEWS ACTIVE' : 'LIVE SOON'}
        </span>
        <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'bg-[#f5a623] shadow-[0_0_8px_rgba(245,166,35,0.8)]'} animate-pulse`}></div>
      </div>
    </div>
  );
}
