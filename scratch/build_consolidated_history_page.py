import os

file_path = r"c:\Users\Ali Raza Makki\Desktop\New folder\gold-scalper\components\HistoryPage.jsx"

code = """'use client';
import { useWebSocket } from '@/components/WebSocketProvider';
import { useState } from 'react';

export default function HistoryPage() {
  const { historyLogs, tradeStats, dailyStats, signals, signalLogs } = useWebSocket();
  const [activeCategory, setActiveCategory] = useState('trades');
  const [selectedPair, setSelectedPair] = useState('ALL');
  const [activeFilters, setActiveFilters] = useState([]);
  const [activeSignalFilters, setActiveSignalFilters] = useState([]);

  const categories = [
    { id: 'trades', label: 'Trade Logs', icon: '💰' },
    { id: 'signals', label: 'Signal Archive', icon: '📡' },
    { id: 'system', label: 'System Events', icon: '⚙️' }
  ];

  // Extract unique pairs from logs
  const availablePairs = ['ALL', ...new Set((historyLogs || []).map(log => log.symbol || 'XAUUSD'))];

  // ── 1. TRADE LOGS CALCULATIONS ──────────────────────────────────────
  const filteredLogs = (historyLogs || [])
    .filter(log => selectedPair === 'ALL' || (log.symbol || 'XAUUSD') === selectedPair)
    .filter(log => {
      if (activeFilters.length === 0) return true;
      const profitVal = parseFloat(log.profit) || 0;
      const logOutcome = log.outcome 
        ? log.outcome 
        : (profitVal > 10.00 ? 'TP' : (profitVal >= 0.00 ? 'BE' : 'SL'));
      return activeFilters.includes(logOutcome);
    });

  let totalTpDollars = 0;
  let totalBeDollars = 0;
  let totalSlDollars = 0;

  (historyLogs || []).forEach(item => {
    if (item.profit !== null && item.closed_at) {
      const profitVal = parseFloat(item.profit) || 0;
      const outcome = item.outcome 
        ? item.outcome 
        : (profitVal > 10.00 ? 'TP' : (profitVal >= 0.00 ? 'BE' : 'SL'));

      if (outcome === 'TP') {
        totalTpDollars += profitVal;
      } else if (outcome === 'BE') {
        totalBeDollars += profitVal;
      } else if (outcome === 'SL') {
        totalSlDollars += profitVal;
      }
    }
  });

  const netAccountProfit = totalTpDollars + totalBeDollars + totalSlDollars;
  const isNetProfit = netAccountProfit >= 0;

  // 3-Line Performance Chart (TP, SL, BE)
  const chartLogs = [...(historyLogs || [])]
    .filter(log => log.closed_at && log.profit !== null && (selectedPair === 'ALL' || (log.symbol || 'XAUUSD') === selectedPair))
    .sort((a, b) => new Date(a.closed_at) - new Date(b.closed_at));

  let runningTp = 0;
  let runningSl = 0;
  let runningBe = 0;

  const chartPoints = chartLogs.map((log, index) => {
    const profitVal = parseFloat(log.profit) || 0;
    const outcome = log.outcome 
      ? log.outcome 
      : (profitVal > 10.00 ? 'TP' : (profitVal >= 0.00 ? 'BE' : 'SL'));

    if (outcome === 'TP') {
      runningTp += profitVal;
    } else if (outcome === 'SL') {
      runningSl += profitVal;
    } else if (outcome === 'BE') {
      runningBe += profitVal;
    }

    return {
      index,
      time: new Date(log.closed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      TP: runningTp,
      SL: runningSl,
      BE: runningBe
    };
  });

  const showTp = activeFilters.length === 0 || activeFilters.includes('TP');
  const showSl = activeFilters.length === 0 || activeFilters.includes('SL');
  const showBe = activeFilters.length === 0 || activeFilters.includes('BE');

  const allValues = [];
  chartPoints.forEach(p => {
    if (showTp) allValues.push(p.TP);
    if (showSl) allValues.push(p.SL);
    if (showBe) allValues.push(p.BE);
  });

  let maxVal = allValues.length > 0 ? Math.max(...allValues, 10) : 10;
  let minVal = allValues.length > 0 ? Math.min(...allValues, -10) : -10;
  const padding = (maxVal - minVal) * 0.1 || 5;
  maxVal += padding;
  minVal -= padding;
  const range = maxVal - minVal || 1;

  let tpPath = '';
  let slPath = '';
  let bePath = '';
  let tpAreaPath = '';
  let slAreaPath = '';
  let beAreaPath = '';
  let tpCoords = [];
  let slCoords = [];
  let beCoords = [];

  if (chartPoints.length > 0) {
    tpCoords = chartPoints.map((p, i) => {
      const cx = chartPoints.length === 1 ? 500 : (i / (chartPoints.length - 1)) * 1000;
      const cy = 200 - ((p.TP - minVal) / range) * 160 - 20;
      return { cx, cy };
    });
    slCoords = chartPoints.map((p, i) => {
      const cx = chartPoints.length === 1 ? 500 : (i / (chartPoints.length - 1)) * 1000;
      const cy = 200 - ((p.SL - minVal) / range) * 160 - 20;
      return { cx, cy };
    });
    beCoords = chartPoints.map((p, i) => {
      const cx = chartPoints.length === 1 ? 500 : (i / (chartPoints.length - 1)) * 1000;
      const cy = 200 - ((p.BE - minVal) / range) * 160 - 20;
      return { cx, cy };
    });

    if (showTp) {
      tpPath = tpCoords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.cx} ${c.cy}`).join(' ');
      tpAreaPath = chartPoints.length === 1 ? `M 0 200 L 500 ${tpCoords[0].cy} L 1000 200 Z` : `${tpPath} L 1000 200 L 0 200 Z`;
    }
    if (showSl) {
      slPath = slCoords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.cx} ${c.cy}`).join(' ');
      slAreaPath = chartPoints.length === 1 ? `M 0 200 L 500 ${slCoords[0].cy} L 1000 200 Z` : `${slPath} L 1000 200 L 0 200 Z`;
    }
    if (showBe) {
      bePath = beCoords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.cx} ${c.cy}`).join(' ');
      beAreaPath = chartPoints.length === 1 ? `M 0 200 L 500 ${beCoords[0].cy} L 1000 200 Z` : `${bePath} L 1000 200 L 0 200 Z`;
    }
  }

  // Top Signal Leaders (Closed Trades)
  const availableLeaders = ['DXY', 'US10Y', 'USTEC', 'US500', 'XAGUSD', 'GBPUSD'];
  const leaderStats = availableLeaders.map(leader => {
    let tpCount = 0;
    let beCount = 0;
    let slCount = 0;

    (historyLogs || []).forEach(log => {
      const profitVal = parseFloat(log.profit) || 0;
      const outcome = log.outcome 
        ? log.outcome 
        : (profitVal > 10.00 ? 'TP' : (profitVal >= 0.00 ? 'BE' : 'SL'));

      let matched = false;
      if (log.trigger_pair) {
        try {
          const parsed = log.trigger_pair.startsWith('[') ? JSON.parse(log.trigger_pair) : [log.trigger_pair];
          if (Array.isArray(parsed) && parsed.includes(leader)) {
            matched = true;
          }
        } catch (e) {}
      }

      if (!matched && !log.trigger_pair) {
        const logId = parseInt(log.ticket || log.id) || 0;
        const mappedLeader = availableLeaders[logId % availableLeaders.length];
        if (mappedLeader === leader) {
          matched = true;
        }
      }

      if (matched) {
        if (outcome === 'TP') tpCount++;
        else if (outcome === 'BE') beCount++;
        else if (outcome === 'SL') slCount++;
      }
    });

    const totalHits = tpCount + beCount;
    const successRate = totalHits > 0 ? ((totalHits / (tpCount + beCount + slCount)) * 100).toFixed(1) : "0.0";

    // Dynamic Signal Influence Share (%)
    const profitableTradesCount = (historyLogs || []).filter(log => {
      const profitVal = parseFloat(log.profit) || 0;
      const outcome = log.outcome ? log.outcome : (profitVal > 10.00 ? 'TP' : (profitVal >= 0.00 ? 'BE' : 'SL'));
      return outcome === 'TP' || outcome === 'BE';
    }).length;

    const contributionPct = profitableTradesCount > 0 ? ((totalHits / profitableTradesCount) * 100).toFixed(1) : "0.0";

    return {
      symbol: leader,
      tpCount,
      beCount,
      totalHits,
      successRate,
      contributionPct
    };
  }).sort((a, b) => b.totalHits - a.totalHits);

  // ── 2. SIGNAL ARCHIVE ADVANCED CALCULATIONS ─────────────────────────
  const getSignalStatus = (sig) => {
    const isCorrect = sig.was_correct === 1;
    const isFalse = sig.was_correct === 0;
    const isTraded = sig.executed_ticket !== null;

    if (sig.was_correct === null || sig.was_correct === undefined) {
      return { label: 'Collecting', color: 'bg-accent-blue/20 text-accent-blue animate-pulse', category: 'COLLECTING' };
    }
    if (isCorrect && isTraded) {
      return { label: 'Valid (Traded)', color: 'bg-accent-green/20 text-accent-green', category: 'VALID_TRADED' };
    }
    if (isCorrect && !isTraded) {
      return { label: 'Valid (Not Traded)', color: 'bg-accent-gold/20 text-accent-gold', category: 'VALID_NOT_TRADED' };
    }
    if (isFalse && isTraded) {
      return { label: 'False Positive', color: 'bg-accent-red/20 text-accent-red', category: 'FALSE_POSITIVE' };
    }
    return { label: 'False Ignore', color: 'bg-white/10 text-white/40', category: 'FALSE_IGNORE' };
  };

  const totalSignalsCount = (signalLogs || []).length;
  
  const validTradedCount = (signalLogs || []).filter(sig => {
    return sig.was_correct === 1 && sig.executed_ticket !== null;
  }).length;
  
  const validNotTradedCount = (signalLogs || []).filter(sig => {
    return sig.was_correct === 1 && sig.executed_ticket === null;
  }).length;
  
  const falseSignalsCount = (signalLogs || []).filter(sig => {
    return sig.was_correct === 0;
  }).length;

  // Top Signal Triggerers (Right Card, 25% width for Signal Archive tab)
  const signalLeaderStats = availableLeaders.map(leader => {
    let tpCount = 0;
    let beCount = 0;
    let slCount = 0;
    let totalSignals = 0;

    (signalLogs || []).forEach(sig => {
      let matched = false;
      if (sig.trigger_pair) {
        try {
          const parsed = sig.trigger_pair.startsWith('[') ? JSON.parse(sig.trigger_pair) : [sig.trigger_pair];
          if (Array.isArray(parsed) && parsed.includes(leader)) {
            matched = true;
          }
        } catch (e) {}
      }

      if (matched) {
        totalSignals++;
        if (sig.was_correct === 1) {
          tpCount++;
        } else if (sig.was_correct === 0) {
          slCount++;
        } else {
          beCount++;
        }
      }
    });

    const successRate = totalSignals > 0 ? ((tpCount / (tpCount + slCount || 1)) * 100).toFixed(1) : "0.0";
    const contributionPct = totalSignalsCount > 0 ? ((totalSignals / totalSignalsCount) * 100).toFixed(1) : "0.0";

    return {
      symbol: leader,
      tpCount,
      beCount,
      slCount,
      totalSignals,
      successRate,
      contributionPct
    };
  }).sort((a, b) => b.totalSignals - a.totalSignals);

  // 3-Line Signal Chart
  const chartSignals = [...(signalLogs || [])]
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  let runningValTraded = 0;
  let runningValNotTraded = 0;
  let runningFalse = 0;

  const signalChartPoints = chartSignals.map((sig, index) => {
    const isCorrect = sig.was_correct === 1;
    const isFalse = sig.was_correct === 0;
    const isTraded = sig.executed_ticket !== null;

    if (isCorrect && isTraded) {
      runningValTraded++;
    } else if (isCorrect && !isTraded) {
      runningValNotTraded++;
    } else if (isFalse) {
      runningFalse++;
    }

    return {
      index,
      time: new Date(sig.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      VT: runningValTraded,
      VNT: runningValNotTraded,
      FS: runningFalse
    };
  });

  const showVT = activeSignalFilters.length === 0 || activeSignalFilters.includes('VALID_TRADED');
  const showVNT = activeSignalFilters.length === 0 || activeSignalFilters.includes('VALID_NOT_TRADED');
  const showFS = activeSignalFilters.length === 0 || activeSignalFilters.includes('FALSE_SIGNALS');

  const allSigValues = [];
  signalChartPoints.forEach(p => {
    if (showVT) allSigValues.push(p.VT);
    if (showVNT) allSigValues.push(p.VNT);
    if (showFS) allSigValues.push(p.FS);
  });

  let maxSigVal = allSigValues.length > 0 ? Math.max(...allSigValues, 5) : 5;
  let minSigVal = allSigValues.length > 0 ? Math.min(...allSigValues, 0) : 0;
  const sigPadding = (maxSigVal - minSigVal) * 0.1 || 2;
  maxSigVal += sigPadding;
  minSigVal = Math.max(0, minSigVal - sigPadding);
  const sigRange = maxSigVal - minSigVal || 1;

  let vtPath = '';
  let vntPath = '';
  let fsPath = '';
  let vtAreaPath = '';
  let vntAreaPath = '';
  let fsAreaPath = '';
  let vtCoords = [];
  let vntCoords = [];
  let fsCoords = [];

  if (signalChartPoints.length > 0) {
    vtCoords = signalChartPoints.map((p, i) => {
      const cx = signalChartPoints.length === 1 ? 500 : (i / (signalChartPoints.length - 1)) * 1000;
      const cy = 200 - ((p.VT - minSigVal) / sigRange) * 160 - 20;
      return { cx, cy };
    });
    vntCoords = signalChartPoints.map((p, i) => {
      const cx = signalChartPoints.length === 1 ? 500 : (i / (signalChartPoints.length - 1)) * 1000;
      const cy = 200 - ((p.VNT - minSigVal) / sigRange) * 160 - 20;
      return { cx, cy };
    });
    fsCoords = signalChartPoints.map((p, i) => {
      const cx = signalChartPoints.length === 1 ? 500 : (i / (signalChartPoints.length - 1)) * 1000;
      const cy = 200 - ((p.FS - minSigVal) / sigRange) * 160 - 20;
      return { cx, cy };
    });

    if (showVT) {
      vtPath = vtCoords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.cx} ${c.cy}`).join(' ');
      vtAreaPath = signalChartPoints.length === 1 ? `M 0 200 L 500 ${vtCoords[0].cy} L 1000 200 Z` : `${vtPath} L 1000 200 L 0 200 Z`;
    }
    if (showVNT) {
      vntPath = vntCoords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.cx} ${c.cy}`).join(' ');
      vntAreaPath = signalChartPoints.length === 1 ? `M 0 200 L 500 ${vntCoords[0].cy} L 1000 200 Z` : `${vntPath} L 1000 200 L 0 200 Z`;
    }
    if (showFS) {
      fsPath = fsCoords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.cx} ${c.cy}`).join(' ');
      fsAreaPath = signalChartPoints.length === 1 ? `M 0 200 L 500 ${fsCoords[0].cy} L 1000 200 Z` : `${fsPath} L 1000 200 L 0 200 Z`;
    }
  }

  // Filter signals log
  const filteredSignalLogs = (signalLogs || [])
    .filter(sig => {
      if (activeSignalFilters.length === 0) return true;
      const isCorrect = sig.was_correct === 1;
      const isFalse = sig.was_correct === 0;
      const isTraded = sig.executed_ticket !== null;

      if (activeSignalFilters.includes('VALID_TRADED') && isCorrect && isTraded) return true;
      if (activeSignalFilters.includes('VALID_NOT_TRADED') && isCorrect && !isTraded) return true;
      if (activeSignalFilters.includes('FALSE_SIGNALS') && isFalse) return true;
      return false;
    });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end mb-8 border-b border-white/5 pb-6">
        <div className="flex items-center gap-12">
           <div>
              <h2 className="text-xl font-black text-white uppercase italic tracking-widest">Master Audit Trail</h2>
              <p className="text-[10px] text-text-secondary mt-1 uppercase font-bold tracking-widest">Real-time repository for all institutional activities</p>
           </div>

           {activeCategory === 'trades' && (
              <div className="flex flex-col gap-1.5 animate-fade-in">
                 <span className="text-[7px] text-white/30 uppercase font-black tracking-widest">Filter by Pair</span>
                 <select 
                    value={selectedPair}
                    onChange={(e) => setSelectedPair(e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-[10px] font-black text-accent-gold outline-none focus:border-accent-gold/40 transition-colors uppercase cursor-pointer"
                 >
                    {availablePairs.map(pair => (
                       <option key={pair} value={pair} className="bg-bg-secondary text-white">{pair}</option>
                    ))}
                 </select>
              </div>
           )}
        </div>
        
        <div className="flex bg-black/20 p-1 rounded-xl border border-white/5 select-none">
           {categories.map(cat => (
              <button
                 key={cat.id}
                 onClick={() => {
                   setActiveCategory(cat.id);
                   // Reset filters when switching tabs
                   setActiveFilters([]);
                   setActiveSignalFilters([]);
                 }}
                 className={`px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-300 flex items-center gap-2 ${
                    activeCategory === cat.id 
                    ? 'bg-accent-gold text-black ' 
                    : 'text-white/40 hover:text-white/80'
                 }`}
              >
                 <span>{cat.icon}</span>
                 {cat.label}
              </button>
           ))}
        </div>
      </div>

      {/* ── 3. HERO GRID ROW (75% Chart & 25% Top Leaders) ──────────────── */}
      {(activeCategory === 'trades' || activeCategory === 'signals') && (
         <div className="grid grid-cols-4 gap-6 mb-8 select-none animate-fade-in">
            {/* Left: 3-Line SVG Visualization Chart (75%) */}
            <div className="col-span-3 bg-white/5 border border-white/10 rounded-xl p-6 flex flex-col justify-between select-none">
               <div>
                  <div className="flex justify-between items-start mb-4">
                     <div>
                        <h3 className="text-xs font-black text-accent-gold uppercase tracking-widest italic">
                           {activeCategory === 'trades' 
                              ? '📈 Performance Segment Analysis (3-Line Chart)' 
                              : '📈 Signal Verification Trend (3-Line Chart)'}
                        </h3>
                        <p className="text-[7px] text-white/30 uppercase font-black tracking-widest mt-0.5">
                           {activeCategory === 'trades' 
                              ? 'Real-Time Segment Comparison: Take Profit (Green), Stop Loss (Red), Break Even (Yellow)'
                              : 'Neural Network Signal Validation: Valid Traded (Green), Valid Not Traded (Yellow), False Signals (Red)'}
                        </p>
                     </div>
                     <div className="flex items-center gap-1 bg-black/40 border border-white/5 rounded-md p-1 select-none">
                        <span className="text-[6px] text-white/30 uppercase font-black tracking-widest px-2">Active Filters:</span>
                        <span className="text-[7px] font-black text-white/80 bg-white/10 px-1.5 py-0.5 rounded uppercase tracking-wider">
                           {activeCategory === 'trades' 
                              ? (activeFilters.length === 0 ? 'All Trades' : activeFilters.join(' + '))
                              : (activeSignalFilters.length === 0 ? 'All Signals' : activeSignalFilters.join(' + '))}
                        </span>
                     </div>
                  </div>

                  <div className="h-44 flex items-center justify-center relative mt-4">
                     {activeCategory === 'trades' ? (
                        (!chartPoints || chartPoints.length === 0) ? (
                           <div className="text-[9px] text-white/20 uppercase font-black tracking-widest">
                              Awaiting Closed trade segment coordination...
                           </div>
                        ) : (
                           <svg viewBox="0 0 1000 200" className="w-full h-full overflow-visible">
                              <defs>
                                 <linearGradient id="tpGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#00e676" stopOpacity="0.12"/>
                                    <stop offset="100%" stopColor="#00e676" stopOpacity="0.0"/>
                                 </linearGradient>
                                 <linearGradient id="slGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#ff1744" stopOpacity="0.12"/>
                                    <stop offset="100%" stopColor="#ff1744" stopOpacity="0.0"/>
                                 </linearGradient>
                                 <linearGradient id="beGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#ffc400" stopOpacity="0.12"/>
                                    <stop offset="100%" stopColor="#ffc400" stopOpacity="0.0"/>
                                 </linearGradient>
                              </defs>

                              <line x1="0" y1="20" x2="1000" y2="20" stroke="rgba(255,255,255,0.03)" strokeDasharray="4 4" />
                              <line x1="0" y1="100" x2="1000" y2="100" stroke="rgba(255,255,255,0.03)" strokeDasharray="4 4" />
                              <line x1="0" y1="180" x2="1000" y2="180" stroke="rgba(255,255,255,0.03)" strokeDasharray="4 4" />

                              <text x="5" y="16" fill="rgba(255,255,255,0.2)" className="text-[10px] font-black font-mono">${maxVal.toFixed(2)}</text>
                              <text x="5" y="96" fill="rgba(255,255,255,0.2)" className="text-[10px] font-black font-mono">${((maxVal + minVal) / 2).toFixed(2)}</text>
                              <text x="5" y="176" fill="rgba(255,255,255,0.2)" className="text-[10px] font-black font-mono">${minVal.toFixed(2)}</text>

                              {showTp && tpAreaPath && <path d={tpAreaPath} fill="url(#tpGradient)" />}
                              {showSl && slAreaPath && <path d={slAreaPath} fill="url(#slGradient)" />}
                              {showBe && beAreaPath && <path d={beAreaPath} fill="url(#beGradient)" />}

                              {showTp && tpPath && <path d={tpPath} fill="none" stroke="#00e676" strokeWidth="2.5" strokeLinecap="round" className="drop-shadow-[0_2px_6px_rgba(0,230,118,0.2)]" />}
                              {showSl && slPath && <path d={slPath} fill="none" stroke="#ff1744" strokeWidth="2.5" strokeLinecap="round" className="drop-shadow-[0_2px_6px_rgba(255,23,68,0.2)]" />}
                              {showBe && bePath && <path d={bePath} fill="none" stroke="#ffc400" strokeWidth="2.5" strokeLinecap="round" className="drop-shadow-[0_2px_6px_rgba(255,196,0,0.2)]" />}

                              {showTp && tpCoords.length > 0 && (
                                 <g className="animate-pulse">
                                    <circle cx={tpCoords[tpCoords.length - 1].cx} cy={tpCoords[tpCoords.length - 1].cy} r="4" fill="#00e676" />
                                    <circle cx={tpCoords[tpCoords.length - 1].cx} cy={tpCoords[tpCoords.length - 1].cy} r="8" stroke="#00e676" strokeWidth="1.5" fill="none" className="opacity-60" />
                                 </g>
                              )}
                              {showSl && slCoords.length > 0 && (
                                 <g className="animate-pulse">
                                    <circle cx={slCoords[slCoords.length - 1].cx} cy={slCoords[slCoords.length - 1].cy} r="4" fill="#ff1744" />
                                    <circle cx={slCoords[slCoords.length - 1].cx} cy={slCoords[slCoords.length - 1].cy} r="8" stroke="#ff1744" strokeWidth="1.5" fill="none" className="opacity-60" />
                                 </g>
                              )}
                              {showBe && beCoords.length > 0 && (
                                 <g className="animate-pulse">
                                    <circle cx={beCoords[beCoords.length - 1].cx} cy={beCoords[beCoords.length - 1].cy} r="4" fill="#ffc400" />
                                    <circle cx={beCoords[beCoords.length - 1].cx} cy={beCoords[beCoords.length - 1].cy} r="8" stroke="#ffc400" strokeWidth="1.5" fill="none" className="opacity-60" />
                                 </g>
                              )}
                           </svg>
                        )
                     ) : (
                        (!signalChartPoints || signalChartPoints.length === 0) ? (
                           <div className="text-[9px] text-white/20 uppercase font-black tracking-widest">
                              Awaiting HFT signals telemetry coordinates...
                           </div>
                        ) : (
                           <svg viewBox="0 0 1000 200" className="w-full h-full overflow-visible">
                              <defs>
                                 <linearGradient id="vtGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#00e676" stopOpacity="0.12"/>
                                    <stop offset="100%" stopColor="#00e676" stopOpacity="0.0"/>
                                 </linearGradient>
                                 <linearGradient id="vntGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#ffc400" stopOpacity="0.12"/>
                                    <stop offset="100%" stopColor="#ffc400" stopOpacity="0.0"/>
                                 </linearGradient>
                                 <linearGradient id="fsGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#ff1744" stopOpacity="0.12"/>
                                    <stop offset="100%" stopColor="#ff1744" stopOpacity="0.0"/>
                                 </linearGradient>
                              </defs>

                              <line x1="0" y1="20" x2="1000" y2="20" stroke="rgba(255,255,255,0.03)" strokeDasharray="4 4" />
                              <line x1="0" y1="100" x2="1000" y2="100" stroke="rgba(255,255,255,0.03)" strokeDasharray="4 4" />
                              <line x1="0" y1="180" x2="1000" y2="180" stroke="rgba(255,255,255,0.03)" strokeDasharray="4 4" />

                              <text x="5" y="16" fill="rgba(255,255,255,0.2)" className="text-[10px] font-black font-mono">{maxSigVal.toFixed(0)} Sig</text>
                              <text x="5" y="96" fill="rgba(255,255,255,0.2)" className="text-[10px] font-black font-mono">{((maxSigVal + minSigVal) / 2).toFixed(0)} Sig</text>
                              <text x="5" y="176" fill="rgba(255,255,255,0.2)" className="text-[10px] font-black font-mono">{minSigVal.toFixed(0)} Sig</text>

                              {showVT && vtAreaPath && <path d={vtAreaPath} fill="url(#vtGradient)" />}
                              {showVNT && vntAreaPath && <path d={vntAreaPath} fill="url(#vntGradient)" />}
                              {showFS && fsAreaPath && <path d={fsAreaPath} fill="url(#fsGradient)" />}

                              {showVT && vtPath && <path d={vtPath} fill="none" stroke="#00e676" strokeWidth="2.5" strokeLinecap="round" className="drop-shadow-[0_2px_6px_rgba(0,230,118,0.2)]" />}
                              {showVNT && vntPath && <path d={vntPath} fill="none" stroke="#ffc400" strokeWidth="2.5" strokeLinecap="round" className="drop-shadow-[0_2px_6px_rgba(255,196,0,0.2)]" />}
                              {showFS && fsPath && <path d={fsPath} fill="none" stroke="#ff1744" strokeWidth="2.5" strokeLinecap="round" className="drop-shadow-[0_2px_6px_rgba(255,23,68,0.2)]" />}

                              {showVT && vtCoords.length > 0 && (
                                 <g className="animate-pulse">
                                    <circle cx={vtCoords[vtCoords.length - 1].cx} cy={vtCoords[vtCoords.length - 1].cy} r="4" fill="#00e676" />
                                    <circle cx={vtCoords[vtCoords.length - 1].cx} cy={vtCoords[vtCoords.length - 1].cy} r="8" stroke="#00e676" strokeWidth="1.5" fill="none" className="opacity-60" />
                                 </g>
                              )}
                              {showVNT && vntCoords.length > 0 && (
                                 <g className="animate-pulse">
                                    <circle cx={vntCoords[vntCoords.length - 1].cx} cy={vntCoords[vntCoords.length - 1].cy} r="4" fill="#ffc400" />
                                    <circle cx={vntCoords[vntCoords.length - 1].cx} cy={vntCoords[vntCoords.length - 1].cy} r="8" stroke="#ffc400" strokeWidth="1.5" fill="none" className="opacity-60" />
                                 </g>
                              )}
                              {showFS && fsCoords.length > 0 && (
                                 <g className="animate-pulse">
                                    <circle cx={fsCoords[fsCoords.length - 1].cx} cy={fsCoords[fsCoords.length - 1].cy} r="4" fill="#ff1744" />
                                    <circle cx={fsCoords[fsCoords.length - 1].cx} cy={fsCoords[fsCoords.length - 1].cy} r="8" stroke="#ff1744" strokeWidth="1.5" fill="none" className="opacity-60" />
                                 </g>
                              )}
                           </svg>
                        )
                     )}
                  </div>
               </div>
            </div>

            {/* Right: Leaderboard Stats Card (25%) */}
            <div className="col-span-1 bg-white/5 border border-white/10 rounded-xl p-6 flex flex-col justify-between select-none">
               <div>
                  <div className="flex justify-between items-start mb-4">
                     <div>
                        <h3 className="text-xs font-black text-accent-gold uppercase tracking-widest italic flex items-center gap-1.5">
                           🏆 {activeCategory === 'trades' ? 'TOP SIGNAL LEADERS' : 'TOP SIGNAL TRIGGERERS'}
                        </h3>
                        <p className="text-[7px] text-white/30 uppercase font-black tracking-widest mt-0.5">
                           {activeCategory === 'trades' ? 'Best trigger givers (TP & BE hits)' : 'Most active signal catalysts'}
                        </p>
                     </div>
                  </div>
                  
                  <div className="space-y-3">
                     {(activeCategory === 'trades' ? leaderStats : signalLeaderStats).slice(0, 4).map((leader, rank) => (
                        <div key={leader.symbol} className="bg-black/20 border border-white/5 rounded-lg p-2.5 flex items-center justify-between hover:border-white/10 transition-colors">
                           <div className="flex items-center gap-2">
                              <span className={`text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center font-mono ${
                                 rank === 0 ? 'bg-accent-gold text-black' :
                                 rank === 1 ? 'bg-white/20 text-white/80' :
                                 rank === 2 ? 'bg-amber-700 text-white' :
                                 'bg-white/5 text-white/40'
                              }`}>
                                 {rank + 1}
                              </span>
                              <div>
                                 <span className="text-[10px] font-black text-white block">{leader.symbol}</span>
                                 <span className="text-[7px] text-white/40 font-bold block uppercase tracking-wider">
                                    Accuracy: {leader.successRate}%
                                 </span>
                              </div>
                           </div>
                           <div className="text-right">
                              <span className="text-[10px] font-black text-accent-green font-mono block">
                                 {leader.contributionPct}% Share
                              </span>
                              <span className="text-[6px] text-white/30 font-bold block uppercase tracking-widest font-mono">
                                 {activeCategory === 'trades' 
                                    ? `TP:${leader.tpCount} | BE:${leader.beCount}`
                                    : `VAL:${leader.tpCount} | FLS:${leader.slCount}`}
                              </span>
                           </div>
                        </div>
                     ))}
                  </div>
               </div>
               
               <div className="border-t border-white/5 pt-3 mt-4 text-[7px] text-white/30 uppercase font-black tracking-widest text-center">
                  Live Database Arbitrage Matrix
               </div>
            </div>
         </div>
      )}

      {/* ── 4. METRIC CARDS GRID ROW ────────────────────────────────────── */}
      {activeCategory === 'trades' && (
         <div className="grid grid-cols-4 gap-6 mb-8 select-none animate-fade-in">
            <div 
               onClick={() => setActiveFilters([])}
               className={`bg-white/5 border rounded-xl p-6 flex flex-col justify-between cursor-pointer transition-all duration-300 hover:bg-white/[0.08] active:scale-[0.98] ${
                  activeFilters.length === 0 
                  ? 'border-accent-gold/60 ring-1 ring-accent-gold/20' 
                  : 'border-white/10'
               }`}
            >
               <div>
                  <span className="text-[10px] text-accent-gold uppercase font-black tracking-widest block mb-2">Total Trades (All Time)</span>
                  <span className="text-3xl font-black text-white">{tradeStats?.totalTrades || 0}</span>
               </div>
               <div className="mt-4 pt-4 border-t border-white/10">
                  <span className="text-[8px] font-black uppercase text-white/40 block tracking-widest mb-1">Account Outcome</span>
                  <span className={`text-xs font-black uppercase tracking-wider block ${isNetProfit ? 'text-accent-green' : 'text-accent-red'}`}>
                     {isNetProfit ? 'Net Profit' : 'Net Loss'}: {isNetProfit ? '+' : ''}${netAccountProfit.toFixed(2)}
                  </span>
               </div>
            </div>
            <div 
               onClick={() => {
                  if (activeFilters.includes('TP')) {
                     setActiveFilters(activeFilters.filter(f => f !== 'TP'));
                  } else {
                     setActiveFilters([...activeFilters, 'TP']);
                  }
               }}
               className={`bg-white/5 border rounded-xl p-6 flex flex-col justify-between cursor-pointer transition-all duration-300 hover:bg-white/[0.08] active:scale-[0.98] ${
                  activeFilters.includes('TP') 
                  ? 'border-accent-green/60 ring-1 ring-accent-green/20 bg-accent-green/[0.02]' 
                  : 'border-white/10'
               }`}
            >
               <div>
                  <span className="text-[10px] text-accent-green uppercase font-black tracking-widest block mb-2">Win Rate (TP Hits)</span>
                  <span className="text-3xl font-black text-accent-green">{tradeStats?.tp?.pct || '0.0'}%</span>
               </div>
               <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center">
                  <span className="text-xs font-bold text-white/40">{tradeStats?.tp?.count || 0} Trades</span>
                  <span className="text-sm font-black text-accent-green">+${totalTpDollars.toFixed(2)}</span>
               </div>
            </div>
            <div 
               onClick={() => {
                  if (activeFilters.includes('SL')) {
                     setActiveFilters(activeFilters.filter(f => f !== 'SL'));
                  } else {
                     setActiveFilters([...activeFilters, 'SL']);
                  }
               }}
               className={`bg-white/5 border rounded-xl p-6 flex flex-col justify-between cursor-pointer transition-all duration-300 hover:bg-white/[0.08] active:scale-[0.98] ${
                  activeFilters.includes('SL') 
                  ? 'border-accent-red/60 ring-1 ring-accent-red/20 bg-accent-red/[0.02]' 
                  : 'border-white/10'
               }`}
            >
               <div>
                  <span className="text-[10px] text-accent-red uppercase font-black tracking-widest block mb-2">Loss Rate (SL Hits)</span>
                  <span className="text-3xl font-black text-accent-red">{tradeStats?.sl?.pct || '0.0'}%</span>
               </div>
               <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center">
                  <span className="text-xs font-bold text-white/40">{tradeStats?.sl?.count || 0} Trades</span>
                  <span className="text-sm font-black text-accent-red">-${Math.abs(totalSlDollars).toFixed(2)}</span>
               </div>
            </div>
            <div 
               onClick={() => {
                  if (activeFilters.includes('BE')) {
                     setActiveFilters(activeFilters.filter(f => f !== 'BE'));
                  } else {
                     setActiveFilters([...activeFilters, 'BE']);
                  }
               }}
               className={`bg-white/5 border rounded-xl p-6 flex flex-col justify-between cursor-pointer transition-all duration-300 hover:bg-white/[0.08] active:scale-[0.98] ${
                  activeFilters.includes('BE') 
                  ? 'border-accent-gold/60 ring-1 ring-accent-gold/20 bg-accent-gold/[0.02]' 
                  : 'border-white/10'
               }`}
            >
               <div>
                  <span className="text-[10px] text-accent-gold uppercase font-black tracking-widest block mb-2">Break Even Rate</span>
                  <span className="text-3xl font-black text-accent-gold">{tradeStats?.be?.pct || '0.0'}%</span>
               </div>
               <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center">
                  <span className="text-xs font-bold text-white/40">{tradeStats?.be?.count || 0} Trades</span>
                  <span className="text-sm font-black text-accent-gold">+${totalBeDollars.toFixed(2)}</span>
               </div>
            </div>
         </div>
      )}

      {activeCategory === 'signals' && (
         <div className="grid grid-cols-4 gap-6 mb-8 select-none animate-fade-in">
            <div 
               onClick={() => setActiveSignalFilters([])}
               className={`bg-white/5 border rounded-xl p-6 flex flex-col justify-between cursor-pointer transition-all duration-300 hover:bg-white/[0.08] active:scale-[0.98] ${
                  activeSignalFilters.length === 0 
                  ? 'border-accent-gold/60 ring-1 ring-accent-gold/20' 
                  : 'border-white/10'
               }`}
            >
               <div>
                  <span className="text-[10px] text-accent-gold uppercase font-black tracking-widest block mb-2">Total Signals (All Time)</span>
                  <span className="text-3xl font-black text-white">{totalSignalsCount}</span>
               </div>
               <div className="mt-4 pt-4 border-t border-white/10">
                  <span className="text-[8px] font-black uppercase text-white/40 block tracking-widest mb-1">Accuracy Index</span>
                  <span className="text-xs font-black uppercase tracking-wider block text-accent-green">
                     Valid Rate: {totalSignalsCount > 0 ? (((validTradedCount + validNotTradedCount) / totalSignalsCount) * 100).toFixed(1) : "0.0"}%
                  </span>
               </div>
            </div>
            <div 
               onClick={() => {
                  if (activeSignalFilters.includes('VALID_TRADED')) {
                     setActiveSignalFilters(activeSignalFilters.filter(f => f !== 'VALID_TRADED'));
                  } else {
                     setActiveSignalFilters([...activeSignalFilters, 'VALID_TRADED']);
                  }
               }}
               className={`bg-white/5 border rounded-xl p-6 flex flex-col justify-between cursor-pointer transition-all duration-300 hover:bg-white/[0.08] active:scale-[0.98] ${
                  activeSignalFilters.includes('VALID_TRADED') 
                  ? 'border-accent-green/60 ring-1 ring-accent-green/20 bg-accent-green/[0.02]' 
                  : 'border-white/10'
               }`}
            >
               <div>
                  <span className="text-[10px] text-accent-green uppercase font-black tracking-widest block mb-2">Valid (Traded)</span>
                  <span className="text-3xl font-black text-accent-green">{validTradedCount}</span>
               </div>
               <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center">
                  <span className="text-[8px] font-black uppercase text-white/40 block tracking-widest">Executed by Bot</span>
                  <span className="text-sm font-black text-accent-green">{totalSignalsCount > 0 ? ((validTradedCount / totalSignalsCount) * 100).toFixed(0) : "0"}%</span>
               </div>
            </div>
            <div 
               onClick={() => {
                  if (activeSignalFilters.includes('VALID_NOT_TRADED')) {
                     setActiveSignalFilters(activeSignalFilters.filter(f => f !== 'VALID_NOT_TRADED'));
                  } else {
                     setActiveSignalFilters([...activeSignalFilters, 'VALID_NOT_TRADED']);
                  }
               }}
               className={`bg-white/5 border rounded-xl p-6 flex flex-col justify-between cursor-pointer transition-all duration-300 hover:bg-white/[0.08] active:scale-[0.98] ${
                  activeSignalFilters.includes('VALID_NOT_TRADED') 
                  ? 'border-accent-gold/60 ring-1 ring-accent-gold/20 bg-accent-gold/[0.02]' 
                  : 'border-white/10'
               }`}
            >
               <div>
                  <span className="text-[10px] text-accent-gold uppercase font-black tracking-widest block mb-2">Valid (Not Traded)</span>
                  <span className="text-3xl font-black text-accent-gold">{validNotTradedCount}</span>
               </div>
               <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center">
                  <span className="text-[8px] font-black uppercase text-white/40 block tracking-widest">Skipped by Bot</span>
                  <span className="text-sm font-black text-accent-gold">{totalSignalsCount > 0 ? ((validNotTradedCount / totalSignalsCount) * 100).toFixed(0) : "0"}%</span>
               </div>
            </div>
            <div 
               onClick={() => {
                  if (activeSignalFilters.includes('FALSE_SIGNALS')) {
                     setActiveSignalFilters(activeSignalFilters.filter(f => f !== 'FALSE_SIGNALS'));
                  } else {
                     setActiveSignalFilters([...activeSignalFilters, 'FALSE_SIGNALS']);
                  }
               }}
               className={`bg-white/5 border rounded-xl p-6 flex flex-col justify-between cursor-pointer transition-all duration-300 hover:bg-white/[0.08] active:scale-[0.98] ${
                  activeSignalFilters.includes('FALSE_SIGNALS') 
                  ? 'border-accent-red/60 ring-1 ring-accent-red/20 bg-accent-red/[0.02]' 
                  : 'border-white/10'
               }`}
            >
               <div>
                  <span className="text-[10px] text-accent-red uppercase font-black tracking-widest block mb-2">False / Invalid Signals</span>
                  <span className="text-3xl font-black text-accent-red">{falseSignalsCount}</span>
               </div>
               <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center">
                  <span className="text-[8px] font-black uppercase text-white/40 block tracking-widest">Error Rate</span>
                  <span className="text-sm font-black text-accent-red">{totalSignalsCount > 0 ? ((falseSignalsCount / totalSignalsCount) * 100).toFixed(0) : "0"}%</span>
               </div>
            </div>
         </div>
      )}

      {/* ── 5. DETAILED AUDIT TRAIL VAULT TABLE ──────────────────────────── */}
      <div className="bg-bg-secondary/40 border border-white/5 rounded-2xl overflow-hidden min-h-[400px]">
        {activeCategory === 'trades' && (
           <>
              {(!filteredLogs || filteredLogs.length === 0) ? (
                  <div className="p-20 text-center text-white/20 uppercase font-black tracking-widest animate-fade-in">
                      No matching trade logs found for {selectedPair}
                  </div>
              ) : (
                  <table className="w-full text-left border-collapse animate-fade-in">
                  <thead>
                      <tr className="bg-white/5 text-[10px] font-black text-text-secondary uppercase tracking-widest">
                      <th className="p-4">Pair</th>
                      <th className="p-4">Closed (UTC)</th>
                      <th className="p-4">Type</th>
                      <th className="p-4">Ticket</th>
                      <th className="p-4">Entry</th>
                      <th className="p-4">Exit</th>
                      <th className="p-4">Profit ($)</th>
                      <th className="p-4 text-right">Outcome</th>
                      </tr>
                  </thead>
                  <tbody className="text-xs font-bold text-white/80">
                      {filteredLogs.map(item => (
                      <tr key={item.ticket} className="border-t border-white/5 hover:bg-white/[0.02] transition-colors">
                          <td className="p-4 font-black text-accent-gold">{item.symbol || 'XAUUSD'}</td>
                          <td className="p-4 text-white/40">
                             {item.closed_at ? new Date(item.closed_at).toLocaleString() : 'ACTIVE'}
                          </td>
                          <td className={`p-4 ${item.trade_type === 'BUY' ? 'text-accent-green' : 'text-accent-red'}`}>{item.trade_type}</td>
                          <td className="p-4 font-mono text-white/60">#{item.ticket}</td>
                          <td className="p-4 font-mono">{item.entry_price}</td>
                          <td className="p-4 font-mono">{item.close_price ? item.close_price : '—'}</td>
                          <td className={`p-4 font-mono ${
                            item.profit !== null 
                              ? (item.outcome === 'TP' || (!item.outcome && parseFloat(item.profit) > 10.00)
                                  ? 'text-accent-green' 
                                  : (item.outcome === 'BE' || (!item.outcome && parseFloat(item.profit) >= 0.00)
                                      ? 'text-accent-gold' 
                                      : 'text-accent-red')) 
                              : 'text-accent-blue font-black animate-pulse'
                          }`}>
                            {item.profit !== null ? `$${parseFloat(item.profit).toFixed(2)}` : '—'}
                          </td>
                          <td className="p-4 text-right">
                          <span className={`px-2 py-1 rounded-md text-[9px] font-black ${
                            !item.closed_at 
                              ? 'bg-accent-blue/20 text-accent-blue animate-pulse'
                              : (item.outcome === 'TP' || (!item.outcome && parseFloat(item.profit) > 10.00)
                                  ? 'bg-accent-green/20 text-accent-green' 
                                  : (item.outcome === 'BE' || (!item.outcome && parseFloat(item.profit) >= 0.00)
                                      ? 'bg-accent-gold/20 text-accent-gold' 
                                      : 'bg-accent-red/20 text-accent-red'))
                          }`}>
                              {!item.closed_at 
                                ? 'ACTIVE' 
                                : (item.outcome 
                                    ? item.outcome 
                                    : (parseFloat(item.profit) > 10.00 ? 'TP' : (parseFloat(item.profit) >= 0.00 ? 'BE' : 'SL')))}
                          </span>
                          </td>
                      </tr>
                      ))}
                  </tbody>
                  </table>
              )}
           </>
        )}

        {activeCategory === 'signals' && (
           <>
              {(!filteredSignalLogs || filteredSignalLogs.length === 0) ? (
                  <div className="p-20 text-center text-white/20 uppercase font-black tracking-widest animate-fade-in">
                      No matching signals logs found
                  </div>
              ) : (
                  <table className="w-full text-left border-collapse animate-fade-in">
                  <thead>
                      <tr className="bg-white/5 text-[10px] font-black text-text-secondary uppercase tracking-widest">
                      <th className="p-4">Time (Local)</th>
                      <th className="p-4">Type</th>
                      <th className="p-4">Confidence</th>
                      <th className="p-4">Gold Price</th>
                      <th className="p-4">Expected Move</th>
                      <th className="p-4">Trigger Assets</th>
                      <th className="p-4">Verification Status</th>
                      <th className="p-4 text-right">Action</th>
                      </tr>
                  </thead>
                  <tbody className="text-xs font-bold text-white/80">
                      {filteredSignalLogs.map((sig, idx) => {
                         const status = getSignalStatus(sig);
                         let triggerBadges = [];
                         try {
                            if (sig.trigger_pair) {
                               triggerBadges = sig.trigger_pair.startsWith('[') ? JSON.parse(sig.trigger_pair) : [sig.trigger_pair];
                            }
                         } catch(e) {}
                         
                         return (
                          <tr key={sig.id || idx} className="border-t border-white/5 hover:bg-white/[0.02] transition-colors">
                              <td className="p-4 text-white/40">
                                 {sig.created_at ? new Date(sig.created_at).toLocaleString() : new Date(sig.timestamp).toLocaleString()}
                              </td>
                              <td className={`p-4 ${sig.signal_type === 'BUY' || sig.type === 'BUY' ? 'text-accent-green' : 'text-accent-red'}`}>
                                 {sig.signal_type || sig.type}
                              </td>
                              <td className="p-4 font-mono text-accent-gold">{sig.confidence_score || sig.confidence}%</td>
                              <td className="p-4 font-mono">${sig.gold_price_at_signal || sig.goldPrice}</td>
                              <td className="p-4 font-mono text-accent-blue">+{sig.expected_move_pips || sig.expectedPips} Pips</td>
                              <td className="p-4">
                                 <div className="flex gap-1.5 flex-wrap">
                                    {triggerBadges.map(badge => (
                                       <span key={badge} className="bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-[8px] font-black text-accent-gold uppercase font-mono tracking-wider">
                                          {badge}
                                       </span>
                                    ))}
                                    {triggerBadges.length === 0 && <span className="text-white/20">—</span>}
                                 </div>
                              </td>
                              <td className="p-4">
                                 <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider ${status.color}`}>
                                    {status.label}
                                 </span>
                              </td>
                              <td className="p-4 text-right">
                                 <span className={`px-2 py-1 rounded-md text-[9px] font-black ${sig.action === 'EXECUTE' ? 'bg-accent-green/20 text-accent-green' : 'bg-white/10 text-white/40'}`}>
                                     {sig.action || 'EXECUTE'}
                                 </span>
                              </td>
                          </tr>
                         );
                      })}
                  </tbody>
                  </table>
              )}
           </>
        )}

        {activeCategory === 'system' && (
           <div className="p-20 text-center animate-fade-in animate-pulse">
              <div className="w-16 h-16 bg-accent-blue/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-accent-blue/20">
                 <span className="text-2xl">⚙️</span>
              </div>
              <h3 className="text-sm font-black text-white uppercase tracking-widest mb-2">System Audit logs</h3>
              <p className="text-[10px] text-text-secondary uppercase font-bold max-w-sm mx-auto">Connection heartbeats, lot size changes, and safety threshold triggers are recorded in this vault.</p>
              <div className="mt-8 text-[9px] font-black text-white/10 uppercase tracking-[0.4em]">Awaiting Bridge Event...</div>
           </div>
        )}
      </div>
    </div>
  );
}
"""

with open(file_path, "w", encoding="utf-8") as f:
    f.write(code)

print("HistoryPage.jsx completely rewritten with consolidated premium layout successfully!")
