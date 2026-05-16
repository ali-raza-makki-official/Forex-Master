'use client';
import { useWebSocket } from '@/components/WebSocketProvider';
import { useState, useEffect } from 'react';
import HFTIndicator from '@/components/HFTIndicator';

export default function LeadLagCanvas() {
  const { prices, hftAnalytics, tradeStats, gapStats, atr, activePairs, leaderPair, signals } = useWebSocket();
  const [isClient, setIsClient] = useState(false);
  const [spreadData, setSpreadData] = useState({ pips: 0, isSafe: true });

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Simple spread calculation for UI display if provider doesn't have it yet
  useEffect(() => {
    if (prices?.['XAUUSD']) {
        const { bid, ask } = prices['XAUUSD'];
        const pips = parseFloat((Math.abs(ask - bid) * 10).toFixed(1));
        setSpreadData({ pips, isSafe: pips <= 5.0 });
    }
  }, [prices]);

  const getLivePrice = (baseSymbol) => {
    if (!prices) return 0;
    if (prices[baseSymbol]) return prices[baseSymbol].bid;
    const foundKey = Object.keys(prices).find(key => 
      key.startsWith(baseSymbol) || baseSymbol.startsWith(key)
    );
    return foundKey ? prices[foundKey].bid : 0;
  };

  const getAnalytics = (symbol) => {
    if (!hftAnalytics || hftAnalytics.length === 0) return null;
    return hftAnalytics.find(a => 
      symbol.toUpperCase() === a.symbol.toUpperCase() || 
      symbol.toUpperCase().startsWith(a.symbol.toUpperCase()) || 
      a.symbol.toUpperCase().startsWith(symbol.toUpperCase())
    );
  };

  if (!isClient) return <div className="w-full h-full bg-[#0a0e1a] animate-pulse" />;

  const goldPrice = getLivePrice(leaderPair.symbol);
  const goldStats = getAnalytics(leaderPair.symbol);
  
  // Lead-Lag Calculation
  const dxyPrice = getLivePrice('DXY'); // DXY is often a constant benchmark, but we can make it dynamic if needed
  const realDiff = dxyPrice > 0 && goldPrice > 0 ? Math.abs(goldPrice - (dxyPrice * 45)) : null;
  const avgDiff = gapStats?.avgDiff ? parseFloat(gapStats.avgDiff) : null;
  
  let indicatorColor = 'bg-white/5';
  let indicatorLabel = 'SCAN';
  if (realDiff !== null && avgDiff !== null) {
    if (realDiff > avgDiff * 1.5) {
       indicatorColor = 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]';
       indicatorLabel = 'BUY';
    } else if (realDiff < avgDiff * 0.5) {
       indicatorColor = 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]';
       indicatorLabel = 'SELL';
    } else {
       indicatorColor = 'bg-yellow-500';
       indicatorLabel = 'WAIT';
    }
  }

  // ATR based dynamic SL/TP levels
  const currentATR = atr; 
  const tpLevel = (goldPrice > 0 && currentATR) ? (goldPrice + currentATR * 1.5).toFixed(2) : '---';
  const slLevel = (goldPrice > 0 && currentATR) ? (goldPrice - currentATR * 1.0).toFixed(2) : '---';

  const avgAcc = hftAnalytics?.length > 0 
    ? (hftAnalytics.reduce((s, a) => s + parseFloat(a.avgAccuracy), 0) / hftAnalytics.length).toFixed(1)
    : '---';
  const avgDelay = hftAnalytics?.length > 0 
    ? (hftAnalytics.reduce((s, a) => s + parseFloat(a.avgDelay), 0) / hftAnalytics.length).toFixed(0)
    : '---';
  const avgMs = hftAnalytics?.length > 0 
    ? (hftAnalytics.reduce((s, a) => s + parseFloat(a.avgMs), 0) / hftAnalytics.length).toFixed(0)
    : '---';

  return (
    <div className="w-full h-full flex flex-col overflow-hidden relative">
      
      {/* 1. TOP HEADER (Stats & Dynamic ATR Levels) */}
      <div className="flex items-center justify-between p-3 border-b border-white/5 bg-bg-secondary/20">
         <div className="flex items-center gap-5">
            <h3 className="text-[10px] font-black text-white tracking-[0.2em] uppercase">XAU/USD INTELLIGENCE CANVAS</h3>
         </div>
                  <div className="flex items-center gap-6">
             <div className="flex items-center gap-6 pr-6 border-r border-white/10">
                 <div className="flex items-center gap-2">
                    <span className="text-[7px] text-accent-gold font-black uppercase whitespace-nowrap">ATR:</span>
                    <span className="text-[10px] font-black text-accent-gold">
                       {currentATR !== null ? currentATR.toFixed(2) : '---'} 
                       <span className="text-[7px] opacity-50 font-normal ml-0.5">PIPS</span>
                    </span>
                 </div>
                <div className="flex items-center gap-2 border-l border-white/5 pl-4">
                   <span className="text-[7px] text-accent-green font-black uppercase whitespace-nowrap">TP:</span>
                   <span className="text-[10px] font-black text-accent-green">{tpLevel}</span>
                </div>
                <div className="flex items-center gap-2 border-l border-white/5 pl-4">
                   <span className="text-[7px] text-accent-red font-black uppercase whitespace-nowrap">SL:</span>
                   <span className="text-[10px] font-black text-accent-red">{slLevel}</span>
                </div>
             </div>
                        {/* SPREAD MONITOR UI */}
             <div className="flex items-center gap-3 pl-2">
                <span className="text-[7px] text-text-secondary font-black uppercase whitespace-nowrap">Spread:</span>
                <div className="flex items-center gap-1.5">
                   <span className={`text-[10px] font-black ${spreadData.isSafe ? 'text-accent-green' : 'text-accent-red'}`}>
                      {spreadData.pips} <span className="text-[7px] opacity-50 font-normal">PIPS</span>
                   </span>
                   <div className={`w-1.5 h-1.5 rounded-full ${spreadData.isSafe ? 'bg-accent-green' : 'bg-accent-red animate-ping'}`}></div>
                </div>
             </div>
         </div>
      </div>

      <div className="px-0 flex flex-col flex-1 overflow-hidden">
         
         {/* 2. SECONDARY HEADER (HFT Performance Stats - LINEAR) */}
         <div className="flex items-center justify-between px-6 py-3 bg-bg-secondary/40 border-b border-white/5">
            <div className="flex items-center gap-8">
               <div className="flex items-center gap-2">
                  <span className="text-[8px] font-black text-text-secondary uppercase tracking-widest">Total:</span>
                  <span className="text-sm font-black text-white">{tradeStats?.totalTrades || 0}</span>
               </div>
               <div className="flex items-center gap-2 border-l border-white/10 pl-8">
                  <span className="text-[8px] font-black text-accent-green uppercase tracking-widest">TP:</span>
                  <span className="text-sm font-black text-accent-green">{tradeStats?.tp?.pct}% <span className="text-[9px] text-white/30 font-normal">({tradeStats?.tp?.count})</span></span>
               </div>
               <div className="flex items-center gap-2 border-l border-white/10 pl-8">
                  <span className="text-[8px] font-black text-accent-red uppercase tracking-widest">SL:</span>
                  <span className="text-sm font-black text-accent-red">{tradeStats?.sl?.pct}% <span className="text-[9px] text-white/30 font-normal">({tradeStats?.sl?.count})</span></span>
               </div>
               <div className="flex items-center gap-2 border-l border-white/10 pl-8">
                  <span className="text-[8px] font-black text-accent-blue uppercase tracking-widest">BE:</span>
                  <span className="text-sm font-black text-accent-blue">{tradeStats?.be?.pct}% <span className="text-[9px] text-white/30 font-normal">({tradeStats?.be?.count})</span></span>
               </div>
            </div>
            
            <div className="flex items-center gap-6 border-l border-white/10 pl-8 text-[9px] font-bold text-white/40 italic">
               <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-accent-green"></div> BUY</span>
               <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-accent-red"></div> SELL</span>
               <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-yellow-500"></div> WAIT</span>
            </div>
         </div>

         {/* 3. MAIN GRID */}
         <div className="flex-1 overflow-auto custom-scrollbar p-6">
            <div className="grid grid-cols-3 gap-6 pb-2">
               
               {/* PROMOTED GOLD TARGET - FULL WIDTH TOP */}
               <div className="col-span-3 ex-card p-6 bg-accent-gold/5 border-l-4 border-accent-gold shadow-[0_0_50px_rgba(245,166,35,0.08)] mb-2">
                  <div className="flex justify-between items-center mb-6">
                     <div className="flex items-center gap-8">
                        <div className="flex flex-col">
                           <h4 className="text-sm font-black text-accent-gold tracking-[0.3em] uppercase italic leading-none">Gold Target benchmark</h4>
                           <span className="text-[8px] text-accent-gold/40 uppercase font-black tracking-widest mt-1">Live Institutional Reference Price</span>
                        </div>
                        
                        {/* MOVED FROM HEADER */}
                        <div className="border-l border-accent-gold/20 pl-8">
                           <HFTIndicator />
                        </div>
                     </div>

                     <div className="flex flex-col items-end gap-2">
                        <div className="flex items-center gap-3">
                           {signals && signals[0] && (
                              <div className="flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full">
                                 <span className="text-[8px] uppercase tracking-widest text-text-secondary">Signal Power:</span>
                                 <span className={`text-xs font-black ${signals[0].type === 'BUY' ? 'text-accent-green' : 'text-accent-red'}`}>
                                    {signals[0].confidence}% {signals[0].type}
                                 </span>
                              </div>
                           )}
                           <span className="text-3xl font-mono font-black text-accent-gold tracking-tighter tabular-nums leading-none">
                              {goldPrice > 0 ? goldPrice.toFixed(2) : '---'}
                           </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                           <div className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse"></div>
                           <span className="text-[7px] text-accent-green font-black uppercase tracking-widest">Master Stream Active</span>
                        </div>
                     </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-12 py-6 border-y border-accent-gold/10">
                     <div className="flex justify-between items-center px-4 border-r border-accent-gold/5">
                        <span className="text-[8px] text-accent-gold/60 uppercase font-bold tracking-widest">System Confidence</span>
                        <span className="text-sm font-black text-accent-green">{goldStats ? goldStats.avgAccuracy + '%' : '---'}</span>
                     </div>
                     <div className="flex justify-between items-center px-4 border-r border-accent-gold/5">
                        <span className="text-[8px] text-accent-gold/60 uppercase font-bold tracking-widest">Price Stability</span>
                        <span className="text-sm font-black text-white">{goldStats ? goldStats.avgDelay + 'm' : '---'}</span>
                     </div>
                     <div className="flex justify-between items-center px-4">
                        <span className="text-[8px] text-accent-gold/60 uppercase font-bold tracking-widest">Stream Latency</span>
                        <span className="text-sm font-black text-accent-blue">{goldStats ? goldStats.avgMs + 'ms' : '---'}</span>
                     </div>
                  </div>
               </div>

               {[...activePairs].sort((a, b) => (b.weight || 50) - (a.weight || 50)).map((asset) => {
                  const price = getLivePrice(asset.symbol);
                  const stats = getAnalytics(asset.symbol);
                  
                  // REAL-TIME SIGNAL LOGIC (Lead-Lag)
                  let signal = 'WAIT';
                  let signalColor = 'text-white/40';
                  let bgColor = 'bg-bg-secondary/60';
                  let borderColor = 'border-border/40';
                  
                  const isInverse = asset.correlation === 'inverse';
                  const gap = stats ? parseFloat(stats.currentGap) : 0;
                  const avgGap = stats ? parseFloat(stats.avgGap) : 0;
                  
                  if (Math.abs(gap) > 0.05) {
                     if (gap > 0) {
                        signal = isInverse ? 'XAU SELL' : 'XAU BUY';
                        signalColor = isInverse ? 'text-accent-red' : 'text-accent-green';
                        borderColor = isInverse ? 'border-accent-red/40' : 'border-accent-green/40';
                     } else {
                        signal = isInverse ? 'XAU BUY' : 'XAU SELL';
                        signalColor = isInverse ? 'text-accent-green' : 'text-accent-red';
                        borderColor = isInverse ? 'border-accent-green/40' : 'border-accent-red/40';
                     }
                  } else {
                     signal = 'XAU WAIT';
                     signalColor = 'text-yellow-500';
                     borderColor = 'border-yellow-500/20';
                  }

                  return (
                      <div key={asset.symbol} className={`ex-card p-5 border-l-4 transition-all duration-500 ${bgColor} ${borderColor} hover:shadow-[0_0_30px_rgba(255,255,255,0.02)]`}>
                        <div className="flex justify-between items-start mb-4">
                           <div className="flex flex-col">
                              <div className="flex items-center gap-2 mb-1">
                                 <div className={`w-1.5 h-1.5 rounded-full ${price > 0 ? 'bg-accent-green shadow-[0_0_8px_rgba(0,212,168,0.4)]' : 'bg-white/10'}`}></div>
                                 <span className="text-[10px] font-black text-white tracking-[0.2em] uppercase">{asset.symbol}</span>
                              </div>
                              <span className="text-[7px] text-text-secondary uppercase font-bold tracking-widest">{asset.name}</span>
                           </div>
                           <div className="flex flex-col items-end">
                              <span className="text-sm font-mono font-black text-white leading-none mb-1">{price > 0 ? price.toFixed(2) : '---'}</span>
                              <span className={`text-[9px] font-black uppercase tracking-widest ${signalColor} animate-pulse`}>{signal}</span>
                           </div>
                        </div>
                        
                        <div className="flex flex-col gap-3 py-4 border-y border-white/5 my-2">
                           <div className="flex justify-between items-center">
                              <span className="text-[7px] text-white/30 uppercase font-black">Real Diff vs {leaderPair.symbol}</span>
                              <span className={`text-[11px] font-mono font-black ${gap >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                                 {gap > 0 ? '+' : ''}{gap.toFixed(4)}
                              </span>
                           </div>
                           <div className="flex justify-between items-center">
                              <span className="text-[7px] text-white/30 uppercase font-black">Avg Offset vs {leaderPair.symbol}</span>
                              <span className="text-[11px] font-mono font-black text-white/60">
                                 {avgGap.toFixed(4)}
                              </span>
                           </div>
                           <div className="flex justify-between items-center">
                              <span className="text-[7px] text-white/30 uppercase font-black">Forecast vs {leaderPair.symbol}</span>
                              <span className="text-[11px] font-mono font-black text-accent-gold">{stats ? stats.avgAccuracy + '%' : '---'}</span>
                           </div>
                           <div className="flex justify-between items-center">
                              <span className="text-[7px] text-white/30 uppercase font-black">{leaderPair.symbol} Latency</span>
                              <span className="text-[11px] font-mono font-black text-white">{stats ? stats.avgDelay + 'm' : '---'}</span>
                           </div>
                           <div className="flex justify-between items-center">
                              <span className="text-[7px] text-white/30 uppercase font-black">{leaderPair.symbol} Execution</span>
                              <span className="text-[11px] font-mono font-black text-accent-blue">{stats ? stats.avgMs + 'ms' : '---'}</span>
                           </div>
                           <div className="flex justify-between items-center">
                              <span className="text-[7px] text-white/30 uppercase font-black">Correlation Strength</span>
                              <span className="text-[11px] font-mono font-black text-accent-gold">
                                 {stats ? (parseFloat(stats.avgAccuracy)).toFixed(1) + '%' : '---'}
                              </span>
                           </div>
                           <div className="flex justify-between items-center">
                              <span className="text-[7px] text-white/30 uppercase font-black">Relative Volatility</span>
                              <span className="text-[11px] font-mono font-black text-white/60">
                                 {stats && stats.currentGap ? (Math.abs(parseFloat(stats.currentGap) / (parseFloat(stats.avgGap) || 1)).toFixed(2)) + 'x' : '---'}
                              </span>
                           </div>
                           <div className="flex justify-between items-center">
                              <span className="text-[7px] text-white/30 uppercase font-black">Session High Gap</span>
                              <span className="text-[11px] font-mono font-black text-accent-red/60">
                                 {stats ? (parseFloat(stats.avgGap) * 2.5).toFixed(4) : '---'}
                              </span>
                           </div>
                           <div className="flex justify-between items-center">
                              <span className="text-[7px] text-white/30 uppercase font-black">Correlation Type</span>
                              <span className={`text-[11px] font-mono font-black ${asset.correlation === 'same' ? 'text-accent-green' : 'text-accent-red'}`}>
                                 {asset.correlation === 'same' ? '📈 SAME (+)' : '📉 INVERSE (-)'}
                              </span>
                           </div>
                           <div className="flex justify-between items-center">
                              <span className="text-[7px] text-white/30 uppercase font-black">System Weighting</span>
                              <span className="text-[11px] font-mono font-black text-accent-blue/80">
                                 {asset.weight || 50}%
                              </span>
                           </div>
                           <div className="flex justify-between items-center">
                              <span className="text-[7px] text-white/30 uppercase font-black">Trend Momentum</span>
                              <span className={`text-[11px] font-mono font-black ${gap >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                                 {gap >= 0 ? '↗ BULLISH' : '↘ BEARISH'}
                              </span>
                           </div>
                           <div className="flex justify-between items-center">
                              <span className="text-[7px] text-white/30 uppercase font-black">Signal Power</span>
                              <div className="flex gap-0.5">
                                 {[1,2,3,4,5].map(i => {
                                    const power = stats ? Math.min(5, Math.ceil(Math.abs(parseFloat(stats.currentGap)) / (parseFloat(stats.avgGap) * 0.5 || 0.1))) : 0;
                                    return (
                                       <div key={i} className={`w-1.5 h-3 rounded-sm ${i <= power ? (gap >= 0 ? 'bg-accent-green shadow-[0_0_5px_rgba(0,212,168,0.3)]' : 'bg-accent-red shadow-[0_0_5px_rgba(255,82,82,0.3)]') : 'bg-white/5'}`}></div>
                                    );
                                 })}
                              </div>
                           </div>
                        </div>
                     </div>
                  );
               })}
            </div>
         </div>
      </div>

    </div>
  );
}
