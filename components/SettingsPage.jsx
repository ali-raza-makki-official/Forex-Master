'use client';
import { useState, useEffect } from 'react';
import { useWebSocket } from '@/components/WebSocketProvider';
import { useToast } from './ToastSystem';
import SelfTrainerStatus from './SelfTrainerStatus';

// Premium Institutional Trading Profiles
const PRESETS = [
  {
    id: 'gold_inst',
    name: 'Gold Institutional',
    desc: 'Ultra-Sensitive HFT Gold profile optimized for high-volume liquidity drives. Multi-correlated benchmark tracking.',
    icon: '⚡',
    leader: 'XAUUSD',
    lagging: [
      { symbol: 'XAGUSD', correlation: 'same', weight: 90 },
      { symbol: 'DXY', correlation: 'inverse', weight: 95 },
      { symbol: 'USTEC', correlation: 'same', weight: 75 },
      { symbol: 'US10Y', correlation: 'inverse', weight: 70 },
      { symbol: 'US500', correlation: 'same', weight: 60 },
      { symbol: 'GBPUSD', correlation: 'same', weight: 50 }
    ],
    risk: { lotSize: '0.10', dailyLossLimit: '250.00', maxSpread: '4.0', newsBufferMins: '15' }
  },
  {
    id: 'silver_beta',
    name: 'Silver High-Beta',
    desc: 'High-volatility scalper tied closely to Gold momentum.',
    icon: '🥈',
    leader: 'XAGUSD',
    lagging: [
      { symbol: 'XAUUSD', correlation: 'same', weight: 85 },
      { symbol: 'DXY', correlation: 'inverse', weight: 70 }
    ],
    risk: { lotSize: '0.10', dailyLossLimit: '80.00', maxSpread: '6.0', newsBufferMins: '30' }
  },
  {
    id: 'us30_momentum',
    name: 'Dow Jones Momentum',
    desc: 'Index arbitrage correlated with S&P500 & Nasdaq.',
    icon: '📈',
    leader: 'US30',
    lagging: [
      { symbol: 'US500', correlation: 'same', weight: 80 },
      { symbol: 'USTEC', correlation: 'same', weight: 70 },
      { symbol: 'DXY', correlation: 'inverse', weight: 50 }
    ],
    risk: { lotSize: '0.10', dailyLossLimit: '200.00', maxSpread: '4.0', newsBufferMins: '15' }
  },
  {
    id: 'eurusd_spread',
    name: 'EURUSD Spread Arb',
    desc: 'FX micro-scalper utilizing Dollar Index & GBP correlations.',
    icon: '💶',
    leader: 'EURUSD',
    lagging: [
      { symbol: 'GBPUSD', correlation: 'same', weight: 75 },
      { symbol: 'DXY', correlation: 'inverse', weight: 90 },
      { symbol: 'USDCHF', correlation: 'inverse', weight: 60 }
    ],
    risk: { lotSize: '0.50', dailyLossLimit: '50.00', maxSpread: '1.5', newsBufferMins: '10' }
  },
  {
    id: 'btc_volatility',
    name: 'Bitcoin Volatility',
    desc: 'High-spread crypto scalper tracking S&P & Ethereum.',
    icon: '₿',
    leader: 'BTCUSD',
    lagging: [
      { symbol: 'ETHUSD', correlation: 'same', weight: 80 },
      { symbol: 'DXY', correlation: 'inverse', weight: 50 },
      { symbol: 'US500', correlation: 'same', weight: 60 }
    ],
    risk: { lotSize: '0.02', dailyLossLimit: '150.00', maxSpread: '25.0', newsBufferMins: '10' }
  }
];

// Utility function to find fuzzy symbol matches based on broker naming (e.g. XAUUSD.pro or GOLD)
const findBestSymbolMatch = (target, availableList) => {
  if (!availableList || availableList.length === 0) return target;
  
  // Exact match
  if (availableList.includes(target)) return target;
  
  // Fuzzy match (case-insensitive substring)
  const match = availableList.find(sym => 
    sym.toUpperCase().includes(target.toUpperCase()) || 
    target.toUpperCase().includes(sym.toUpperCase())
  );
  return match || target;
};

export default function SettingsPage() {
  const { systemSettings, ws, activePairs, setActivePairs, leaderPair, setLeaderPair, prices, allSymbols } = useWebSocket();
  const { addToast } = useToast();
  
  // Local form states
  const [leader, setLeader] = useState(leaderPair.symbol || 'XAUUSD');
  const [laggingPairs, setLaggingPairs] = useState(activePairs || []); // Array of objects
  const [newPair, setNewPair] = useState('');
  const [newPairCorrelation, setNewPairCorrelation] = useState('same');
  const [newPairWeight, setNewPairWeight] = useState(50);

  // Editable Risk Settings State
  const [lotSize, setLotSize] = useState('0.01');
  const [dailyLossLimit, setDailyLossLimit] = useState('50.00');
  const [maxSpread, setMaxSpread] = useState('5.0');
  const [newsBufferMins, setNewsBufferMins] = useState('30');
  const [sessionFilterEnabled, setSessionFilterEnabled] = useState(true);
  const [atrSLMult, setAtrSLMult] = useState('1.00');
  const [atrTPMult, setAtrTPMult] = useState('1.50');
  const [slMode, setSlMode] = useState('DYNAMIC');

  const [isRiskInitialized, setIsRiskInitialized] = useState(false);
  const [isLeaderInitialized, setIsLeaderInitialized] = useState(false);
  const [isLaggingInitialized, setIsLaggingInitialized] = useState(false);

  // Initialize Risk Settings Form State
  useEffect(() => {
    const hasSettings = systemSettings && Object.keys(systemSettings).length > 0;
    if (hasSettings && !isRiskInitialized) {
      if (systemSettings.lot_size !== undefined) setLotSize(String(systemSettings.lot_size));
      if (systemSettings.daily_loss_limit !== undefined) setDailyLossLimit(String(systemSettings.daily_loss_limit));
      if (systemSettings.max_spread !== undefined) setMaxSpread(String(systemSettings.max_spread));
      if (systemSettings.news_buffer_mins !== undefined) setNewsBufferMins(String(systemSettings.news_buffer_mins));
      if (systemSettings.session_filter_enabled !== undefined) setSessionFilterEnabled(systemSettings.session_filter_enabled !== 0);
      if (systemSettings.atr_sl_mult !== undefined) setAtrSLMult(String(systemSettings.atr_sl_mult));
      if (systemSettings.atr_tp_mult !== undefined) setAtrTPMult(String(systemSettings.atr_tp_mult));
      if (systemSettings.sl_mode !== undefined) setSlMode(String(systemSettings.sl_mode));
      setIsRiskInitialized(true);
      console.log('[SETTINGS] Risk states initialized from database.');
    }
  }, [systemSettings, isRiskInitialized]);

  // Initialize Leader Form State
  useEffect(() => {
    if (leaderPair && leaderPair.symbol && !isLeaderInitialized) {
      setLeader(leaderPair.symbol);
      setIsLeaderInitialized(true);
      console.log('[SETTINGS] Leader symbol initialized from database.');
    }
  }, [leaderPair, isLeaderInitialized]);

  // Initialize Lagging Pairs Form State
  useEffect(() => {
    if (activePairs && activePairs.length > 0 && !isLaggingInitialized) {
      setLaggingPairs(activePairs);
      setIsLaggingInitialized(true);
      console.log('[SETTINGS] Lagging pairs initialized from database.');
    }
  }, [activePairs, isLaggingInitialized]);

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
        news_buffer_mins: parseInt(newsBufferMins) || 30,
        session_filter_enabled: sessionFilterEnabled,
        atr_sl_mult: parseFloat(atrSLMult) || 1.0,
        atr_tp_mult: parseFloat(atrTPMult) || 1.5,
        sl_mode: slMode
      }));
    }
    
    // Allow the form to safely re-sync to the new database baseline after saving
    setIsRiskInitialized(false);
    setIsLeaderInitialized(false);
    setIsLaggingInitialized(false);
    addToast("Configuration Saved & Persisted", "success");
  };

  const hasChanges = leader !== leaderPair.symbol || 
                    laggingPairs.length !== activePairs.length ||
                    JSON.stringify(laggingPairs) !== JSON.stringify(activePairs) ||
                    String(lotSize) !== String(systemSettings?.lot_size || '0.01') ||
                    String(dailyLossLimit) !== String(systemSettings?.daily_loss_limit || '50.00') ||
                    String(maxSpread) !== String(systemSettings?.max_spread || '5.0') ||
                    String(newsBufferMins) !== String(systemSettings?.news_buffer_mins || '30') ||
                    sessionFilterEnabled !== (systemSettings?.session_filter_enabled !== 0) ||
                    String(atrSLMult) !== String(systemSettings?.atr_sl_mult || '1.00') ||
                    String(atrTPMult) !== String(systemSettings?.atr_tp_mult || '1.50') ||
                    slMode !== (systemSettings?.sl_mode || 'DYNAMIC');

  const applyPreset = (preset) => {
    // Find matching leader in masterSymbolList
    const matchedLeader = findBestSymbolMatch(preset.leader, masterSymbolList);
    
    // Find matching lagging symbols
    const matchedLagging = preset.lagging.map(lag => {
      const matchedSym = findBestSymbolMatch(lag.symbol, masterSymbolList);
      return {
        symbol: matchedSym,
        correlation: lag.correlation,
        weight: lag.weight
      };
    });

    setLeader(matchedLeader);
    setLaggingPairs(matchedLagging);
    setLotSize(preset.risk.lotSize);
    setDailyLossLimit(preset.risk.dailyLossLimit);
    setMaxSpread(preset.risk.maxSpread);
    setNewsBufferMins(preset.risk.newsBufferMins);

    addToast(`Preset Loaded: ${preset.name}. Review below, then click 'Save Configuration' to apply!`, 'info');
  };

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

      {/* HFT ARCHITECTURE TEMPLATES */}
      <div className="p-6 bg-bg-secondary/40 border border-white/5 rounded-2xl space-y-4">
        <div>
          <h3 className="text-[10px] font-black text-accent-gold uppercase tracking-[0.2em]">Institutional Scalper Templates</h3>
          <p className="text-[10px] text-text-secondary mt-1">Load optimized profiles. Symbols auto-adjust to your broker&apos;s specific naming conventions.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => applyPreset(preset)}
              className="flex flex-col text-left p-4 bg-black/40 border border-white/5 hover:border-accent-gold/30 hover:bg-accent-gold/[0.02] rounded-xl transition-all duration-300 group hover:scale-[1.02] active:scale-[0.98]"
            >
              <div className="flex justify-between items-center w-full mb-2">
                <span className="text-xl">{preset.icon}</span>
                <span className="text-[8px] font-black text-accent-gold opacity-0 group-hover:opacity-100 uppercase tracking-widest transition-opacity">LOAD</span>
              </div>
              <div className="text-[11px] font-black text-white group-hover:text-accent-gold uppercase tracking-tighter truncate w-full">{preset.name}</div>
              <div className="text-[9px] text-text-secondary mt-1 line-clamp-2 leading-relaxed h-[36px]">{preset.desc}</div>
              <div className="mt-3 flex justify-between items-center w-full text-[8px] font-bold text-white/30 uppercase">
                <span>{preset.leader}</span>
                <span>{preset.lagging.length} drivers</span>
              </div>
            </button>
          ))}
        </div>
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
          <div className="space-y-2">
            <label className="text-[10px] font-black text-text-secondary uppercase">Stop Loss ATR Multiplier (x)</label>
            <input 
              type="number" step="0.1" min="0.5" max="5.0"
              value={atrSLMult}
              onChange={(e) => setAtrSLMult(e.target.value)}
              className="w-full h-10 bg-black/40 border border-white/10 rounded-xl px-4 text-sm font-bold text-white outline-none focus:border-accent-gold/40 transition-all animate-fade-in"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-text-secondary uppercase">Take Profit ATR Multiplier (x)</label>
            <input 
              type="number" step="0.1" min="0.5" max="10.0"
              value={atrTPMult}
              onChange={(e) => setAtrTPMult(e.target.value)}
              className="w-full h-10 bg-black/40 border border-white/10 rounded-xl px-4 text-sm font-bold text-white outline-none focus:border-accent-gold/40 transition-all animate-fade-in"
            />
          </div>
        </div>

        {/* Session Hours Filter Toggle */}
        <div className="pt-4 border-t border-white/5 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-text-primary uppercase tracking-wider">Session Hours Filter</span>
            <span className="text-[9px] text-text-secondary mt-1">If enabled, trading will be restricted to high-liquidity London/New York sessions. Turn OFF to trade 24/7.</span>
          </div>
          <button
            onClick={() => setSessionFilterEnabled(!sessionFilterEnabled)}
            className={`w-14 h-7 rounded-full p-1 transition-all duration-300 ${
              sessionFilterEnabled ? 'bg-accent-gold' : 'bg-white/10'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-black transition-all duration-300 transform ${
                sessionFilterEnabled ? 'translate-x-7' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Stop Loss Execution Mode Selector */}
        <div className="pt-4 border-t border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col pr-4 max-w-xl">
            <span className="text-[10px] font-black text-text-primary uppercase tracking-wider">Auto-Trading Mode (SL Type)</span>
            <span className="text-[9px] text-text-secondary mt-1 min-h-[20px] transition-all">
              {slMode === 'DYNAMIC' && '🟢 DYNAMIC (Trailing SL): Automatically moves Stop Loss to lock profits dynamically (Progressive Zone Locking). Best for big trends.'}
              {slMode === 'STATIC' && '🔴 STATIC (Fixed SL): Stop Loss remains completely fixed at its initial entry price. Never trails. Ideal for strict backtest consistency.'}
              {slMode === 'BREAK_EVEN' && '🔵 BREAK-EVEN LOCK: Automatically locks BE + 3 pips once trade hits +20 pips profit. No further trailing, giving trade maximum breathing room.'}
              {slMode === 'SCALP_TRAIL' && '🟣 SCALP-TRAIL: Aggressive dynamic trailing stop that trails strictly at a tight 10 pips distance. Perfect for fast range markets.'}
            </span>
          </div>
          <div className="flex flex-wrap bg-black/60 border border-white/10 rounded-xl p-1 gap-1 shrink-0 self-start md:self-center">
            <button
              onClick={() => setSlMode('DYNAMIC')}
              className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all duration-200 ${
                slMode === 'DYNAMIC' 
                  ? 'bg-accent-gold text-black shadow-lg shadow-accent-gold/20 scale-105' 
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              Dynamic
            </button>
            <button
              onClick={() => setSlMode('STATIC')}
              className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all duration-200 ${
                slMode === 'STATIC' 
                  ? 'bg-accent-red text-white shadow-lg shadow-accent-red/20 scale-105' 
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              Static
            </button>
            <button
              onClick={() => setSlMode('BREAK_EVEN')}
              className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all duration-200 ${
                slMode === 'BREAK_EVEN' 
                  ? 'bg-accent-blue text-white shadow-lg shadow-accent-blue/20 scale-105' 
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              Break-Even
            </button>
            <button
              onClick={() => setSlMode('SCALP_TRAIL')}
              className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all duration-200 ${
                slMode === 'SCALP_TRAIL' 
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20 scale-105' 
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              Scalp-Trail
            </button>
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
