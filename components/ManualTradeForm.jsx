'use client';

import React, { useState } from 'react';
import { Plus, X, Play } from 'lucide-react';
import { useToast } from './ToastSystem';

export default function ManualTradeForm({ socket, onCancel, onTradeExecuted }) {
  const { addToast } = useToast();
  const [formData, setFormData] = useState({
    symbol: 'XAUUSD',
    type: 'BUY',
    volume: 0.01,
    sl: '',
    tp: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!socket || socket.readyState !== WebSocket.OPEN) return;

    const tradeCmd = {
      action: 'trade',
      symbol: formData.symbol,
      type: formData.type,
      volume: parseFloat(formData.volume),
      sl: formData.sl ? parseFloat(formData.sl) : 0,
      tp: formData.tp ? parseFloat(formData.tp) : 0
    };

    socket.send(JSON.stringify(tradeCmd));
    
    addToast(`${formData.type} ${formData.volume} ${formData.symbol} executed`, "success");
    
    if (onTradeExecuted) {
      onTradeExecuted(`${formData.type} ${formData.volume} ${formData.symbol}`);
    }
  };

  return (
    <div className="bg-[#111827] border border-[#1f2937] rounded-lg p-4 mt-4 animate-in slide-in-from-top duration-200">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-[#f9fafb] font-bold flex items-center gap-2">
          <Plus size={16} className="text-[#00d4a8]" />
          Execute Manual Trade
        </h3>
        <button onClick={onCancel} className="text-[#9ca3af] hover:text-white transition-colors">
          <X size={18} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[11px] text-[#9ca3af] uppercase tracking-wider">Symbol</label>
            <select 
              value={formData.symbol}
              onChange={(e) => setFormData({...formData, symbol: e.target.value})}
              className="w-full bg-[#0a0e1a] border border-[#1f2937] rounded p-2 text-sm text-white focus:outline-none focus:border-[#00d4a8]"
            >
              <option value="XAUUSD">XAUUSD (Gold)</option>
              <option value="XAGUSD">XAGUSD (Silver)</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-[#9ca3af] uppercase tracking-wider">Type</label>
            <select 
              value={formData.type}
              onChange={(e) => setFormData({...formData, type: e.target.value})}
              className="w-full bg-[#0a0e1a] border border-[#1f2937] rounded p-2 text-sm text-white focus:outline-none focus:border-[#00d4a8]"
            >
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-[11px] text-[#9ca3af] uppercase tracking-wider">Volume</label>
            <input 
              type="number" 
              step="0.01"
              value={formData.volume}
              onChange={(e) => setFormData({...formData, volume: e.target.value})}
              className="w-full bg-[#0a0e1a] border border-[#1f2937] rounded p-2 text-sm text-white focus:outline-none focus:border-[#00d4a8]"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-[#9ca3af] uppercase tracking-wider">Stop Loss</label>
            <input 
              type="number" 
              step="0.01"
              placeholder="Auto"
              value={formData.sl}
              onChange={(e) => setFormData({...formData, sl: e.target.value})}
              className="w-full bg-[#0a0e1a] border border-[#1f2937] rounded p-2 text-sm text-white focus:outline-none focus:border-[#00d4a8]"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-[#9ca3af] uppercase tracking-wider">Take Profit</label>
            <input 
              type="number" 
              step="0.01"
              placeholder="Auto"
              value={formData.tp}
              onChange={(e) => setFormData({...formData, tp: e.target.value})}
              className="w-full bg-[#0a0e1a] border border-[#1f2937] rounded p-2 text-sm text-white focus:outline-none focus:border-[#00d4a8]"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button 
            type="button"
            onClick={onCancel}
            className="flex-1 h-10 border border-[#1f2937] text-[#9ca3af] rounded hover:bg-[#1f2937] transition-all"
          >
            Cancel
          </button>
          <button 
            type="submit"
            className="flex-1 h-10 bg-[#00d4a8] text-[#0a0e1a] font-bold rounded hover:opacity-90 transition-all flex items-center justify-center gap-2"
          >
            <Play size={16} fill="currentColor" />
            EXECUTE
          </button>
        </div>
      </form>
    </div>
  );
}
