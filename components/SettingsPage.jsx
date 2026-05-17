'use client';
import { useState, useEffect } from 'react';
import { useWebSocket } from '@/components/WebSocketProvider';
import { useToast } from './ToastSystem';
import SelfTrainerStatus from './SelfTrainerStatus';

export default function SettingsPage() {
  const { systemSettings, ws, activePairs, setActivePairs, leaderPair, setLeaderPair, prices, allSymbols } = useWebSocket();
  const { addToast } = useToast();
  const [leader, setLeader] = useState(leaderPair.symbol);
  const [laggingPairs, setLaggingPairs] = useState(activePairs); // Array of objects
  const [newPair, setNewPair] = useState('');
  const [newPairCorrelation, setNewPairCorrelation] = useState('same');
  const [newPairWeight, setNewPairWeight] = useState(50);

  // Editable Risk Settings State
  const [lotSize, setLotSize] = useState('0.01');
  const [dailyLossLimit, setDailyLossLimit] = useState('50.00');
  const [maxSpread, setMaxSpread] = useState('5.0');
  const [newsBufferMins, setNewsBufferMins] = useState('30');

  // Sync state with WebSocket loaded systemSettings
  useEffect(() => {
    if (systemSettings) {
      if (systemSettings.lot_size !== undefined) setLotSize(String(systemSettings.lot_size));
      if (systemSettings.daily_loss_limit !== undefined) setDailyLossLimit(String(systemSettings.daily_loss_limit));
      if (systemSettings.max_spread !== undefined) setMaxSpread(String(systemSettings.max_spread));
      if (systemSettings.news_buffer_mins !== undefined) setNewsBufferMins(String(systemSettings.news_buffer_mins));
    }
  }, [systemSettings]);

  // Keep lagging pairs and leader in sync with global context changes
  useEffect(() => {
    setLeader(leaderPair.symbol);
  }, [leaderPair.symbol]);

  useEffect(() => {
    setLaggingPairs(activePairs);
  }, [activePairs]);

  // Master list of all symbols from MT5 bridge
  const masterSymbolList = allSymbols?.length > 0 ? allSymbols : Object.keys(prices || {});

  // Symbols available for the 'Add Intelligence' section (exclude leader and already added)
  const availableSymbols = masterSymbolList.filter(s => 
    s !== leader && !laggingPairs.find(p => p.symbol === s)
  );

  const handleAddPair = (symbolToAdd) => {
    const sym = (symbolToAdd || newPair).toUpperCase();
    if (sym && !laggingPairs.find(p => p.symbol === sym)) {
      setLaggingPairs([...laggingPairs, { symbol: sym, correlation: newPairCorrelation, weight: newPairWeight }]);
      setNewPair('');
      setNewPairCorrelation('same');
      setNewPairWeight(50);
    }
  };

  const handleRemovePair = (symbol) => {
    setLaggingPairs(laggingPairs.filter(p => p.symbol !== symbol));
  };

  const handleSave = () => {
    setActivePairs(laggingPairs);
    setLeaderPair({ symbol: leader, name: leader + ' Benchmark' });

    if (ws && ws.readyState === WebSocket.OPEN) {
      // 1. Save architecture
      ws.send(JSON.stringify({
        event: 'update_architecture',
        leader: leader,
        laggingPairs: laggingPairs
      }));

      // 2. Save risk settings
      ws.send(JSON.stringify({
        action: 'update_risk_settings',
        lot_size: parseFloat(lotSize) || 0.01,
        daily_loss_limit: parseFloat(dailyLossLimit) || 50.0,
        max_spread: parseFloat(maxSpread) || 5.0,
        news_buffer_mins: parseInt(newsBufferMins) || 30
      }));
    }
    addToast("Configuration Saved & Persisted", "success");
  };

  const hasChanges = leader !== leaderPair.symbol || 
                    laggingPairs.length !== activePairs.length ||
                    JSON.stringify(laggingPairs) !== JSON.stringify(activePairs) ||
                    String(lotSize) !== String(systemSettings?.lot_size || '0.01') ||
                    String(dailyLossLimit) !== String(systemSettings?.daily_loss_limit || '50.00') ||
                    String(maxSpread) !== String(systemSettings?.max_spread || '5.0') ||
                    String(newsBufferMins) !== String(systemSettings?.news_buffer_mins || '30');

  return (
    <div className="max-w-3xl space-y-8 pb-20">
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h2 className="text-xl font-black text-white uppercase italic tracking-widest">Real-Time System Config</h2>
          <p className="text-xs text-text-secondary mt-2">Configure active parameters from Node.js backend.</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={!hasChanges}
          className={`h-10 px-6 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
            hasChanges 
              ? "bg-accent-gold text-black hover:scale-105 active:scale-95 cursor-pointer" 
              : "bg-white/5 text-white/30 border border-white/5 cursor-not-allowed"
          }`}
        >
          {hasChanges ? "Save Configuration" : "Saved & Synced"}
        </button>
      </div>

      {/* RISK SETTINGS */}
      <div className="p-6 bg-bg-secondary/40 border border-white/5 rounded-2xl space-y-6">
        <h3 className="text-[10px] font-black text-accent-gold uppercase tracking-[0.2em]">Active Risk Parameters</h3>
        
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-text-secondary uppercase">Lot Size (Live)</label>
            <input 
              type="number" step="0.01" min="0.01" max="10.0"
              value={lotSize}
              onChange={(e) => setLotSize(e.target.value)}
              className="w-full h-10 bg-black/40 border border-white/10 rounded-xl px-4 text-sm font-bold text-white outline-none focus:border-accent-gold/40 transition-all animate-fade-in"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-text-secondary uppercase">Daily Limit ($)</label>
            <input 
              type="number" step="1.0" min="5.0" max="1000.0"
              value={dailyLossLimit}
              onChange={(e) => setDailyLossLimit(e.target.value)}
              className="w-full h-10 bg-black/40 border border-white/10 rounded-xl px-4 text-sm font-bold text-white outline-none focus:border-accent-gold/40 transition-all animate-fade-in"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-text-secondary uppercase">Max Spread (Pips)</label>
            <input 
              type="number" step="0.1" min="1.0" max="50.0"
              value={maxSpread}
              onChange={(e) => setMaxSpread(e.target.value)}
              className="w-full h-10 bg-black/40 border border-white/10 rounded-xl px-4 text-sm font-bold text-white outline-none focus:border-accent-gold/40 transition-all animate-fade-in"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-text-secondary uppercase">News Buffer (Min)</label>
            <input 
              type="number" step="1" min="0" max="120"
              value={newsBufferMins}
              onChange={(e) => setNewsBufferMins(e.target.value)}
              className="w-full h-10 bg-black/40 border border-white/10 rounded-xl px-4 text-sm font-bold text-white outline-none focus:border-accent-gold/40 transition-all animate-fade-in"
            />
          </div>
        </div>
      </div>

      <SelfTrainerStatus trainingData={systemSettings?.trainingData} />

      {/* 2. MARKET ARCHITECTURE SETTINGS */}
      <div className="p-6 bg-bg-secondary/40 border border-white/5 rounded-2xl space-y-6">
        <div className="flex justify-between items-center">
           <h3 className="text-[10px] font-black text-accent-gold uppercase tracking-[0.2em]">Market Architecture</h3>
           <span className="text-[9px] font-black text-accent-blue bg-accent-blue/10 px-2 py-0.5 rounded uppercase">Engine v2.4</span>
        </div>
        
        <div className="space-y-6">
           {/* SEARCHABLE PRIMARY TARGET */}
           <div className="space-y-3">
              <label className="text-[10px] font-black text-text-secondary uppercase tracking-widest">Primary Scalper Target (Traded Pair)</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                  <span className="text-accent-gold text-lg">🎯</span>
                </div>
                <input 
                  type="text"
                  value={leader}
                  onChange={(e) => setLeader(e.target.value.toUpperCase())}
                  className="w-full h-12 bg-black/60 border border-white/10 rounded-xl pl-12 pr-4 text-sm font-black text-accent-gold placeholder:text-white/20 outline-none focus:border-accent-gold/50 focus:ring-1 focus:ring-accent-gold/20 transition-all"
                  placeholder="SEARCH TARGET SYMBOL..."
                  list="leader-symbols"
                />
                <datalist id="leader-symbols">
                  {masterSymbolList.map(sym => <option key={sym} value={sym} />)}
                </datalist>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-white/20 uppercase">
                  ACTIVE BENCHMARK
                </div>
              </div>
           </div>

           {/* MULTI-SYMBOL INTELLIGENCE GRID */}
           <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-text-secondary uppercase tracking-widest">Leader Intelligence Assets (Market Drivers)</label>
                <button 
                  onClick={() => ws?.send(JSON.stringify({ action: 'get_symbols' }))}
                  className="text-[8px] font-black text-accent-gold/50 hover:text-accent-gold uppercase tracking-tighter transition-colors flex items-center gap-1"
                >
                  <span className="animate-spin-slow">🔄</span> Refresh Discovery ({allSymbols.length || 0})
                </button>
              </div>

              {/* ACTIVE CHIPS */}
              <div className="flex flex-wrap gap-2 min-h-[48px] p-3 bg-black/20 rounded-xl border border-dashed border-white/10">
                 {laggingPairs.length === 0 && (
                   <span className="text-[10px] font-medium text-white/20 italic p-1">No intelligence assets selected. Add symbols below to drive signals.</span>
                 )}
                 {laggingPairs.map(pair => (
                    <div key={pair.symbol} className="flex flex-col gap-1 bg-accent-blue/10 border border-accent-blue/20 rounded-lg px-3 py-2 group hover:bg-accent-blue/20 transition-all  animate-fade-in">
                       <div className="flex items-center justify-between gap-3">
                         <span className="text-[11px] font-black text-accent-blue tracking-tighter">{pair.symbol}</span>
                         <button 
                           onClick={() => handleRemovePair(pair.symbol)}
                           className="text-accent-blue/40 hover:text-accent-red transition-colors text-xs font-bold leading-none"
                         >
                           ×
                         </button>
                       </div>
                       <div className="flex justify-between items-center text-[9px] text-white/50 font-bold uppercase gap-2">
                         <span>{pair.correlation === 'same' ? '📈 SAME' : '📉 INVERSE'}</span>
                         <span>{pair.weight}%</span>
                       </div>
                    </div>
                 ))}
              </div>

              {/* SEARCH & ADD COMPONENT */}
              <div className="flex flex-col gap-3 group">
                 <div className="relative">
                    <input 
                       list="driver-symbols"
                       value={newPair}
                       onChange={(e) => setNewPair(e.target.value.toUpperCase())}
                       onKeyDown={(e) => e.key === 'Enter' && handleAddPair()}
                       className="w-full h-14 bg-white/5 border border-white/10 rounded-xl px-5 text-sm font-black text-white placeholder:text-white/10 outline-none focus:border-accent-blue/40 focus:bg-white/[0.07] transition-all"
                       placeholder="TYPE TO ADD MARKET DRIVER (E.G. DXY, US10Y, SPX500)..."
                    />
                    <datalist id="driver-symbols">
                       {availableSymbols.map(sym => (
                          <option key={sym} value={sym} />
                       ))}
                    </datalist>
                 </div>
                 
                 {/* New Options Row */}
                 <div className="flex gap-4 items-center bg-white/5 p-3 rounded-xl border border-white/5">
                    <div className="flex-1 space-y-1">
                       <label className="text-[9px] font-black text-text-secondary uppercase">Correlation</label>
                       <select 
                         value={newPairCorrelation}
                         onChange={(e) => setNewPairCorrelation(e.target.value)}
                         className="w-full h-10 bg-black/40 border border-white/10 rounded-lg px-3 text-xs font-bold text-white outline-none focus:border-accent-blue/40"
                       >
                         <option value="same">SAME DIRECTION (+)</option>
                         <option value="inverse">AGAINST / INVERSE (-)</option>
                       </select>
                    </div>
                    <div className="flex-1 space-y-1">
                       <label className="text-[9px] font-black text-text-secondary uppercase flex justify-between">
                         <span>Priority Weight</span>
                         <span className="text-accent-blue">{newPairWeight}%</span>
                       </label>
                       <input 
                         type="range" min="1" max="100" 
                         value={newPairWeight} 
                         onChange={(e) => setNewPairWeight(Number(e.target.value))}
                         className="w-full accent-accent-blue h-10"
                       />
                    </div>
                    <button 
                      onClick={() => handleAddPair()}
                      className="h-10 px-6 mt-4 bg-accent-blue/20 hover:bg-accent-blue/40 text-accent-blue text-[10px] font-black uppercase rounded-lg transition-all border border-accent-blue/30"
                    >
                      ADD ASSET
                    </button>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
