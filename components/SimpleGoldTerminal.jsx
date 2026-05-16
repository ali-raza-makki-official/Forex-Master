'use client';
import { useWebSocket } from '@/components/WebSocketProvider';
import React, { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import ManualTradeForm from './ManualTradeForm';
import PositionLockStatus from './PositionLockStatus';
import NewsCountdown from './NewsCountdown';

export default function SimpleGoldTerminal() {
  const { prices, sendTradeCommand, positions, lockStates, socket, newsStatus } = useWebSocket();
  const gold = prices?.['XAUUSD'] || { bid: 0, ask: 0 };
  const [lot, setLot] = useState(0.10);
  const [slPips, setSlPips] = useState(20);
  const [tpPips, setTpPips] = useState(40);
  const [showManualForm, setShowManualForm] = useState(false);

  const spread = gold.ask > 0 ? (gold.ask - gold.bid).toFixed(2) : '0.00';

  // Calculate open profit/loss across all XAUUSD positions
  const xauPositions = positions?.filter(p => p.symbol === 'XAUUSD') || [];
  const totalProfit = xauPositions.reduce((acc, p) => acc + (p.profit || 0), 0);

  const handleQuickTrade = (type) => {
    // 1 pip = 0.10 in Gold price (usually)
    const pipValue = 0.10; 
    const slOffset = slPips * pipValue;
    const tpOffset = tpPips * pipValue;

    const sl = type === 'BUY' ? (gold.bid - slOffset) : (gold.ask + slOffset);
    const tp = type === 'BUY' ? (gold.bid + tpOffset) : (gold.ask - tpOffset);

    console.log(`[TERMINAL] Sending ${type} request with SL: ${sl.toFixed(2)}, TP: ${tp.toFixed(2)}`);

    sendTradeCommand('trade', {
      symbol: 'XAUUSD',
      type: type,
      volume: lot,
      sl: parseFloat(sl.toFixed(2)),
      tp: parseFloat(tp.toFixed(2))
    });
  };

  return (
    <div className="h-full flex flex-col p-8 bg-bg-primary overflow-y-auto">
      {/* Feature 3: News Countdown Banner */}
      <NewsCountdown newsData={newsStatus} />
      
      <div className="max-w-4xl mx-auto w-full space-y-8 pt-6">
        
        {/* Real-time Exposure Summary */}
        <div className="flex justify-between items-center px-6 py-3 bg-bg-secondary/50 rounded-xl border border-border">
           <div className="flex flex-col">
              <span className="text-[10px] text-text-secondary font-black tracking-widest uppercase">Total Open XAU Exposure</span>
              <span className="text-sm font-bold">{xauPositions.length} Positions</span>
           </div>
           <div className="text-right">
              <span className="text-[10px] text-text-secondary font-black tracking-widest uppercase">Current P/L</span>
              <div className={`text-xl font-black ${totalProfit >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                 {totalProfit >= 0 ? '+' : ''}${totalProfit.toFixed(2)}
              </div>
           </div>
        </div>

        {/* Price Center */}
        <div className="flex flex-col items-center justify-center space-y-2">
          <div className="text-text-secondary text-[10px] font-black tracking-[0.4em] uppercase opacity-60">XAU/USD Real-time Feed</div>
          <div className="flex items-baseline gap-8">
            <div className="flex flex-col items-center group cursor-pointer">
              <span className="text-[10px] text-accent-red font-bold opacity-50 group-hover:opacity-100 transition-opacity">BID</span>
              <span className="text-7xl font-black text-white tabular-nums tracking-tighter">
                {gold.bid.toFixed(2)}
              </span>
            </div>
            <div className="h-16 w-px bg-border/30 self-end mb-4"></div>
            <div className="flex flex-col items-center group cursor-pointer">
              <span className="text-[10px] text-accent-green font-bold opacity-50 group-hover:opacity-100 transition-opacity">ASK</span>
              <span className="text-7xl font-black text-text-secondary tabular-nums tracking-tighter">
                {gold.ask.toFixed(2)}
              </span>
            </div>
          </div>
          <div className="px-4 py-1.5 bg-accent-gold/10 border border-accent-gold/20 rounded-full flex gap-4 items-center">
             <span className="text-[11px] font-black text-accent-gold tracking-widest uppercase">Spread: {spread}</span>
             <div className="w-1.5 h-1.5 rounded-full bg-accent-gold animate-pulse"></div>
          </div>
        </div>

        {/* Big Action Buttons */}
        <div className="grid grid-cols-2 gap-6 h-60">
           <button 
             onClick={() => handleQuickTrade('BUY')}
             className="relative group overflow-hidden bg-accent-green/5 border-2 border-accent-green/20 rounded-3xl transition-all hover:bg-accent-green/10 hover:border-accent-green/50 active:scale-[0.97]"
           >
              <div className="absolute inset-0 bg-gradient-to-tr from-accent-green/10 to-transparent"></div>
              <div className="relative flex flex-col items-center justify-center h-full">
                 <span className="text-xs font-black text-accent-green/60 uppercase tracking-[0.3em] mb-1">Execute Long</span>
                 <span className="text-6xl font-black text-accent-green group-hover:scale-105 transition-transform">BUY</span>
                 <span className="mt-4 text-[11px] font-bold text-white/40">Market Order @ {gold.ask.toFixed(2)}</span>
              </div>
           </button>

           <button 
             onClick={() => handleQuickTrade('SELL')}
             className="relative group overflow-hidden bg-accent-red/5 border-2 border-accent-red/20 rounded-3xl transition-all hover:bg-accent-red/10 hover:border-accent-red/50 active:scale-[0.97]"
           >
              <div className="absolute inset-0 bg-gradient-to-tr from-accent-red/10 to-transparent"></div>
              <div className="relative flex flex-col items-center justify-center h-full">
                 <span className="text-xs font-black text-accent-red/60 uppercase tracking-[0.3em] mb-1">Execute Short</span>
                 <span className="text-6xl font-black text-accent-red group-hover:scale-105 transition-transform">SELL</span>
                 <span className="mt-4 text-[11px] font-bold text-white/40">Market Order @ {gold.bid.toFixed(2)}</span>
              </div>
           </button>
        </div>

        {/* Dynamic Controls */}
        <div className="grid grid-cols-3 gap-6">
           <div className="ex-card p-4 bg-bg-secondary/40 border border-border/50 rounded-xl">
              <div className="flex justify-between items-center mb-2">
                 <span className="text-[10px] text-text-secondary font-black uppercase tracking-widest">Lot Size</span>
                 <span className="text-[10px] font-bold text-accent-gold">FIXED</span>
              </div>
              <input 
                type="number" step="0.01" value={lot} 
                onChange={(e) => setLot(parseFloat(e.target.value))}
                className="w-full bg-transparent text-2xl font-black text-white outline-none border-b border-border/50 focus:border-accent-gold transition-colors"
              />
           </div>
           
           <div className="ex-card p-4 bg-bg-secondary/40 border border-border/50 rounded-xl">
              <div className="flex justify-between items-center mb-2">
                 <span className="text-[10px] text-text-secondary font-black uppercase tracking-widest">Take Profit</span>
                 <span className="text-[10px] font-bold text-accent-green">PIPS</span>
              </div>
              <input 
                type="number" value={tpPips} 
                onChange={(e) => setTpPips(parseInt(e.target.value))}
                className="w-full bg-transparent text-2xl font-black text-accent-green outline-none border-b border-border/50 focus:border-accent-green transition-colors"
              />
           </div>

           <div className="ex-card p-4 bg-bg-secondary/40 border border-border/50 rounded-xl">
              <div className="flex justify-between items-center mb-2">
                 <span className="text-[10px] text-text-secondary font-black uppercase tracking-widest">Stop Loss</span>
                 <span className="text-[10px] font-bold text-accent-red">PIPS</span>
              </div>
              <input 
                type="number" value={slPips} 
                onChange={(e) => setSlPips(parseInt(e.target.value))}
                className="w-full bg-transparent text-2xl font-black text-accent-red outline-none border-b border-border/50 focus:border-accent-red transition-colors"
              />
           </div>
        </div>

        {/* Positions Table */}
        <div className="pt-4 space-y-4">
           <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-white uppercase italic tracking-widest">Open Positions</h2>
              <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] font-bold text-[#9ca3af]">
                {positions.length} ACTIVE
              </span>
           </div>

           <div className="bg-bg-secondary/40 border border-border/50 rounded-xl overflow-hidden">
              <table className="w-full text-left">
                 <thead>
                    <tr className="border-b border-border/50 bg-white/5">
                       <th className="px-4 py-3 text-[10px] font-black text-text-secondary uppercase">Ticket / Symbol</th>
                       <th className="px-4 py-3 text-[10px] font-black text-text-secondary uppercase">Type</th>
                       <th className="px-4 py-3 text-[10px] font-black text-text-secondary uppercase">Volume</th>
                       <th className="px-4 py-3 text-[10px] font-black text-text-secondary uppercase">Open / Current</th>
                       <th className="px-4 py-3 text-[10px] font-black text-text-secondary uppercase text-right">Profit</th>
                       <th className="px-4 py-3 text-[10px] font-black text-text-secondary uppercase text-right">Action</th>
                    </tr>
                 </thead>
                 <tbody className="text-sm">
                    {positions.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="px-4 py-12 text-center text-[#9ca3af] uppercase text-[10px] font-bold tracking-[0.2em]">No open positions</td>
                      </tr>
                    ) : (
                      positions.map(pos => (
                        <React.Fragment key={pos.ticket}>
                          <tr className="border-b border-border/30 hover:bg-white/5 transition-colors group">
                            <td className="px-4 py-4">
                              <div className="font-bold text-white">#{pos.ticket}</div>
                              <div className="text-[10px] text-[#9ca3af] font-mono">{pos.symbol}</div>
                            </td>
                            <td className="px-4 py-4">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${pos.type === 'BUY' ? 'bg-accent-green/10 text-accent-green' : 'bg-accent-red/10 text-accent-red'}`}>
                                {pos.type}
                              </span>
                            </td>
                            <td className="px-4 py-4 font-mono text-white">{pos.volume.toFixed(2)}</td>
                            <td className="px-4 py-4">
                              <div className="text-white font-mono">{pos.openPrice.toFixed(2)}</div>
                              <div className="text-[10px] text-[#9ca3af] font-mono">→ {pos.currentPrice?.toFixed(2) || '---'}</div>
                            </td>
                            <td className={`px-4 py-4 text-right font-bold tabular-nums ${pos.profit >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                              {pos.profit >= 0 ? '+' : ''}${pos.profit.toFixed(2)}
                            </td>
                            <td className="px-4 py-4 text-right">
                              <button 
                                onClick={() => sendTradeCommand('close', { ticket: pos.ticket })}
                                className="p-2 hover:bg-accent-red/10 rounded-lg text-[#9ca3af] hover:text-accent-red transition-all"
                              >
                                <X size={16} />
                              </button>
                            </td>
                          </tr>
                          {/* Feature 4: Progressive Lock Zone */}
                          <tr>
                            <td colSpan="6" className="p-0">
                              <PositionLockStatus 
                                ticket={pos.ticket} 
                                lockData={lockStates?.[pos.ticket]} 
                              />
                            </td>
                          </tr>
                        </React.Fragment>
                      ))
                    )}
                 </tbody>
              </table>
           </div>

           {/* Feature 2: Action Buttons */}
           <div className="flex gap-4">
              <button 
                onClick={() => {
                  if (positions.length > 0 && confirm(`Close all ${positions.length} positions?`)) {
                    positions.forEach(p => sendTradeCommand('close', { ticket: p.ticket }));
                  }
                }}
                disabled={positions.length === 0}
                className="flex-1 h-11 border border-accent-red text-accent-red rounded-xl hover:bg-accent-red/10 transition-all flex items-center justify-center gap-2 font-bold disabled:opacity-30 disabled:grayscale"
              >
                <Trash2 size={18} />
                CLOSE ALL POSITIONS
              </button>
              <button 
                onClick={() => setShowManualForm(!showManualForm)}
                className="flex-1 h-11 border border-accent-green text-accent-green rounded-xl hover:bg-accent-green/10 transition-all flex items-center justify-center gap-2 font-bold"
              >
                <Plus size={18} />
                MANUAL TRADE
              </button>
           </div>

           {showManualForm && (
             <ManualTradeForm 
               socket={socket} 
               onCancel={() => setShowManualForm(false)}
               onTradeExecuted={(msg) => {
                 setShowManualForm(false);
                 alert(`Order Executed: ${msg}`);
               }}
             />
           )}
        </div>

      </div>
    </div>
  );
}
