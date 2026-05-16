'use client';

import React, { useState } from 'react';
import { Brain, RefreshCw, Clock, TrendingUp } from 'lucide-react';

export default function SelfTrainerStatus({ trainingData }) {
  const [isRetraining, setIsRetraining] = useState(false);

  const {
    lastRetrain = "2 hours ago (14:30 UTC)",
    nextRetrain = "In 1 hour",
    weights = [
      { pair: 'DXY', points: 40, correlation: '91%', accuracy: '87%' },
      { pair: 'US10Y', points: 35, correlation: '84%', accuracy: '82%' },
      { pair: 'SPX500', points: 25, correlation: '71%', accuracy: '74%' }
    ],
    history = [82, 84, 83, 85, 87, 86, 88] // Mock accuracy history for sparkline
  } = trainingData || {};

  const handleRetrain = async () => {
    setIsRetraining(true);
    try {
      await fetch('/api/retrain', { method: 'POST' });
      // In a real app, we'd wait for the WebSocket event for completion
    } catch (e) {
      console.error("Retrain failed", e);
    }
    setTimeout(() => setIsRetraining(false), 3000);
  };

  return (
    <div className="bg-[#111827] border border-[#1f2937] rounded-xl overflow-hidden">
      <div className="p-4 border-b border-[#1f2937] flex justify-between items-center bg-[#111827]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
            <Brain size={20} className="text-purple-500" />
          </div>
          <div>
            <h3 className="text-[#f9fafb] font-bold">Neural Self-Trainer</h3>
            <p className="text-[11px] text-[#9ca3af] uppercase tracking-wider flex items-center gap-1">
              <Clock size={10} /> Active · Learning from live ticks
            </p>
          </div>
        </div>
        <button 
          onClick={handleRetrain}
          disabled={isRetraining}
          className="px-4 py-2 bg-transparent border border-purple-500 text-purple-500 rounded-lg hover:bg-purple-500/10 transition-all flex items-center gap-2 text-sm font-bold disabled:opacity-50"
        >
          <RefreshCw size={14} className={isRetraining ? 'animate-spin' : ''} />
          {isRetraining ? 'Retraining...' : 'Retrain Now'}
        </button>
      </div>

      <div className="p-4 grid grid-cols-2 gap-4">
        <div className="bg-[#0a0e1a] rounded-lg p-3 border border-[#1f2937]">
          <span className="text-[10px] text-[#9ca3af] uppercase tracking-wider">Last Sync</span>
          <p className="text-sm text-white font-mono mt-1">{lastRetrain}</p>
        </div>
        <div className="bg-[#0a0e1a] rounded-lg p-3 border border-[#1f2937]">
          <span className="text-[10px] text-[#9ca3af] uppercase tracking-wider">Next Cycle</span>
          <p className="text-sm text-[#f5a623] font-bold font-mono mt-1">{nextRetrain}</p>
        </div>
      </div>

      <div className="px-4 pb-4">
        <div className="bg-[#0a0e1a] border border-[#1f2937] rounded-lg overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#1f2937] bg-[#111827]/50">
                <th className="px-4 py-2 text-[10px] text-[#9ca3af] uppercase tracking-wider">Pair</th>
                <th className="px-4 py-2 text-[10px] text-[#9ca3af] uppercase tracking-wider text-center">Points</th>
                <th className="px-4 py-2 text-[10px] text-[#9ca3af] uppercase tracking-wider text-center">Corr.</th>
                <th className="px-4 py-2 text-[10px] text-[#9ca3af] uppercase tracking-wider text-right">Accuracy</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {weights.map((w, i) => (
                <tr key={i} className="border-b border-[#1f2937]/50 last:border-0 hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 font-bold text-white">{w.pair}</td>
                  <td className="px-4 py-3 text-center text-[#9ca3af] font-mono">{w.points}</td>
                  <td className="px-4 py-3 text-center text-[#00d4a8] font-mono">{w.correlation}</td>
                  <td className="px-4 py-3 text-right font-mono">
                    <span className="px-2 py-0.5 rounded bg-green-500/10 text-[#00d4a8]">{w.accuracy}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="p-4 bg-[#111827] border-t border-[#1f2937] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-[#00d4a8]" />
          <span className="text-xs text-[#9ca3af]">Accuracy Improvement (Last 4 Weeks)</span>
        </div>
        <div className="flex gap-1 h-8 items-end">
          {history.map((h, i) => (
            <div 
              key={i} 
              className="w-4 bg-purple-500/40 hover:bg-purple-500 transition-all rounded-t-sm"
              style={{ height: `${(h / 100) * 100}%` }}
              title={`${h}%`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
