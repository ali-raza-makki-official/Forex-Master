'use client';
import { useState, useEffect } from 'react';
import { useWebSocket } from '@/components/WebSocketProvider';
import EmergencyStop from './EmergencyStop';
import DailyStatsGrid from './DailyStatsGrid';

export default function AutoScalpSettings() {
  const { tradeStats, dailyStats, socket, systemSettings } = useWebSocket();
  const [confidence, setConfidence] = useState(85);
  const [autoScalp, setAutoScalp] = useState(false);

  // Sync with server-side settings on load
  useEffect(() => {
    if (systemSettings) {
      if (systemSettings.auto_scalp_enabled !== undefined) {
        setAutoScalp(!!systemSettings.auto_scalp_enabled);
      }
      if (systemSettings.min_confidence) {
        setConfidence(systemSettings.min_confidence);
      }
    }
  }, [systemSettings]);

  const handleToggle = () => {
    const newVal = !autoScalp;
    setAutoScalp(newVal);
    
    // Notify server of the change
    if (socket && socket.readyState === 1) { // WebSocket.OPEN
      socket.send(JSON.stringify({ 
        action: 'set_auto_scalp', 
        enabled: newVal,
        minConfidence: confidence 
      }));
    }
  };

  const handleConfidenceChange = (val) => {
    setConfidence(val);
    if (socket && socket.readyState === 1) {
      socket.send(JSON.stringify({ 
        action: 'set_auto_scalp', 
        enabled: autoScalp,
        minConfidence: parseInt(val)
      }));
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Feature 1: Emergency Stop */}
      <EmergencyStop socket={socket} autoScalp={autoScalp} />

      {/* Feature 5A: Daily Stats Grid */}
      <DailyStatsGrid stats={dailyStats} />

      {/* 2. AUTO-SCALP TOGGLE */}
      <div className="p-5 bg-bg-tertiary/40 border border-white/5 rounded-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
             <span className="text-[10px] text-accent-gold font-black uppercase tracking-widest">Automation</span>
             <h3 className="text-xs font-black text-white uppercase">Auto-Scalp Engine</h3>
          </div>
          <button 
            onClick={handleToggle}
            className={`w-12 h-6 rounded-full relative transition-colors duration-300 ${autoScalp ? 'bg-accent-green' : 'bg-white/10'}`}
          >
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ${autoScalp ? 'left-7' : 'left-1'}`}></div>
          </button>
        </div>

        <div className="space-y-2 pt-2">
          <div className="flex justify-between text-[9px] font-black uppercase text-text-secondary">
            <span>Min Confidence</span>
            <span className="text-accent-gold">{confidence}%</span>
          </div>
          <input 
            type="range" min="50" max="95" value={confidence} 
            onChange={(e) => handleConfidenceChange(e.target.value)}
            className="w-full h-1 bg-white/5 rounded-lg appearance-none cursor-pointer accent-accent-gold"
          />
        </div>
      </div>

    </div>
  );
}
