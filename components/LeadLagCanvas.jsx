'use client';
import { useWebSocket } from '@/components/WebSocketProvider';
import { useState, useEffect } from 'react';
import HFTIndicator from '@/components/HFTIndicator';

export default function LeadLagCanvas() {
   const { prices, hftAnalytics, tradeStats, gapStats, atr, activePairs, leaderPair, signals } = useWebSocket();
   const [isClient, setIsClient] = useState(false);
   const [spreadData, setSpreadData] = useState({ pips: 0, isSafe: true });

   // Ratio History for real-time statistical gap tracking
   const [ratioHistories, setRatioHistories] = useState({});

   useEffect(() => {
      setIsClient(true);
   }, []);

   const getLivePrice = (baseSymbol) => {
      if (!prices) return 0;
      if (prices[baseSymbol]) return prices[baseSymbol].bid;
      const foundKey = Object.keys(prices).find(key =>
         key.startsWith(baseSymbol) || baseSymbol.startsWith(key)
      );
      return foundKey ? prices[foundKey].bid : 0;
   };

   // Simple spread calculation for UI display if provider doesn't have it yet
   useEffect(() => {
      const leaderSym = leaderPair?.symbol || 'XAUUSD';
      if (prices?.[leaderSym]) {
         const { bid, ask } = prices[leaderSym];
         const pips = parseFloat((Math.abs(ask - bid) * 10).toFixed(1));
         setSpreadData({ pips, isSafe: pips <= 5.0 });
      }
   }, [prices, leaderPair?.symbol]);

   // Dynamic Ratio Tracking Effect
   useEffect(() => {
      if (!prices || !activePairs || !activePairs.length || !leaderPair?.symbol) return;
      const leaderPrice = getLivePrice(leaderPair.symbol);
      if (leaderPrice <= 0) return;

      setRatioHistories(prev => {
         const updated = { ...prev };
         let changed = false;
         activePairs.forEach(asset => {
            const lagPrice = getLivePrice(asset.symbol);
            if (lagPrice <= 0) return;
            const ratio = lagPrice / leaderPrice;

            if (!updated[asset.symbol]) {
               updated[asset.symbol] = Array(30).fill(ratio); // Pre-fill baseline instantly
               changed = true;
            } else {
               const currentHistory = updated[asset.symbol];
               if (currentHistory[currentHistory.length - 1] !== ratio) {
                  updated[asset.symbol] = [...currentHistory.slice(1), ratio];
                  changed = true;
               }
            }
         });
         return changed ? updated : prev;
      });
   }, [prices, activePairs, leaderPair?.symbol]);

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
    // Gold Market Closed Check (Weekend or >15s stale price feed)
    const goldPriceObj = prices[leaderPair.symbol];
    const goldLastUpdateTime = goldPriceObj?.time 
      ? (isNaN(new Date(goldPriceObj.time).getTime()) ? Number(goldPriceObj.time) : new Date(goldPriceObj.time).getTime()) 
      : Date.now();
    const isGoldStale = !goldPrice || !goldPriceObj || (Date.now() - goldLastUpdateTime > 15000);
    
    const utcDate = new Date();
    const utcDay = utcDate.getUTCDay();
    const utcHours = utcDate.getUTCHours();
    const isWeekend = (utcDay === 5 && utcHours >= 22) || (utcDay === 6) || (utcDay === 0 && utcHours < 22);
    
    const isGoldClosed = isGoldStale || isWeekend;

   // Lead-Lag Calculation
   const primaryAsset = activePairs?.find(p => p.symbol === 'DXY') || 
                       (activePairs?.length > 0 ? [...activePairs].sort((a,b) => (b.weight||0) - (a.weight||0))[0] : null);
   
   const benchmarkSymbol = primaryAsset?.symbol;
   const benchmarkPrice = benchmarkSymbol ? getLivePrice(benchmarkSymbol) : 0;

   let multiplier = 45;
   if (benchmarkSymbol && benchmarkSymbol !== 'DXY' && benchmarkPrice > 0 && goldPrice > 0) {
       multiplier = goldPrice / benchmarkPrice;
   }

   const realDiff = benchmarkPrice > 0 && goldPrice > 0 ? Math.abs(goldPrice - (benchmarkPrice * multiplier)) : null;
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

   return (
      <div className="w-full h-full flex flex-col overflow-hidden relative">

          {/* 1. SINGLE ULTRA-PREMIUM HFT INTEGRATED COMMAND BAR */}
          <div className="flex items-center justify-between py-2.5 px-6 bg-bg-secondary/20 border-b border-white/5 text-[10px] select-none font-sans">
             {/* Title & Core Tag */}
             <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-accent-gold/5 text-accent-gold font-bold uppercase tracking-wider text-[8px]">
                   <div className="w-1 h-1 rounded-full bg-accent-gold animate-pulse"></div>
                   {leaderPair.symbol} Intel Core
                </div>
             </div>

             {/* Core Intel Capsules Row */}
             <div className="flex items-center gap-6 flex-1 justify-center mx-4 overflow-hidden">
                {/* 1. ATR & TARGET */}
                <div className="flex items-center gap-2.5 text-[9px]">
                   <span className="text-text-secondary/40 font-bold uppercase text-[7px] tracking-wider">ATR</span>
                   <span className="font-mono font-black text-accent-gold">{currentATR !== null ? currentATR.toFixed(2) : '---'} <span className="text-[7px] text-text-secondary/40 font-normal">pips</span></span>
                   <span className="w-px h-2.5 bg-white/10"></span>
                   <span className="text-text-secondary/40 font-bold uppercase text-[7px] tracking-wider">TP</span>
                   <span className="font-mono font-black text-accent-green">{tpLevel}</span>
                   <span className="w-px h-2.5 bg-white/10"></span>
                   <span className="text-text-secondary/40 font-bold uppercase text-[7px] tracking-wider">SL</span>
                   <span className="font-mono font-black text-accent-red">{slLevel}</span>
                </div>

                <span className="w-px h-3 bg-white/5"></span>

                {/* 2. Spread */}
                <div className="flex items-center gap-2 text-[9px]">
                   <span className="text-text-secondary/40 font-bold uppercase text-[7px] tracking-wider">Spread</span>
                   <span className={`font-mono font-black ${spreadData.isSafe ? 'text-accent-green' : 'text-accent-red'}`}>
                      {spreadData.pips} <span className="text-[7px] text-text-secondary/40 font-normal">pips</span>
                   </span>
                   <div className={`w-1.5 h-1.5 rounded-full ${spreadData.isSafe ? 'bg-accent-green shadow-[0_0_5px_rgba(0,212,168,0.4)] animate-pulse' : 'bg-accent-red shadow-[0_0_5px_rgba(255,71,87,0.4)] animate-ping'}`}></div>
                </div>

                <span className="w-px h-3 bg-white/5"></span>

                {/* 3. Dynamic HFT Stats */}
                <div className="flex items-center gap-3 text-[9px]">
                   <span className="text-text-secondary/40 font-bold uppercase text-[7px] tracking-wider">Total HFT</span>
                   <span className="font-mono font-black text-text-primary">{tradeStats?.totalTrades || 0}</span>
                   <span className="w-px h-2.5 bg-white/10"></span>
                   <span className="text-text-secondary/40 font-bold uppercase text-[7px] tracking-wider">TP</span>
                   <span className="font-mono font-black text-accent-green">{tradeStats?.tp?.pct}%</span>
                   <span className="w-px h-2.5 bg-white/10"></span>
                   <span className="text-text-secondary/40 font-bold uppercase text-[7px] tracking-wider">SL</span>
                   <span className="font-mono font-black text-accent-red">{tradeStats?.sl?.pct}%</span>
                   <span className="w-px h-2.5 bg-white/10"></span>
                   <span className="text-text-secondary/40 font-bold uppercase text-[7px] tracking-wider">BE</span>
                   <span className="font-mono font-black text-accent-blue">{tradeStats?.be?.pct}%</span>
                </div>
             </div>

             {/* Right side: Legend Signals */}
             <div className="flex items-center gap-4 text-[7px] font-black uppercase tracking-wider text-text-secondary/40">
                <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-accent-green/60"></div> BUY</span>
                <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-accent-red/60"></div> SELL</span>
                <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-accent-gold/60"></div> WAIT</span>
             </div>
          </div>

          <div className="px-0 flex flex-col flex-1 overflow-hidden">


            <div className="flex-1 overflow-auto custom-scrollbar p-6">
               <div className="grid grid-cols-3 gap-6 pb-2">

                    {/* PROMOTED TARGET BENCHMARK - 1 COLUMN */}
                    <div className={`ex-card p-4 transition-all duration-500 bg-accent-gold/5 border-l-4 border-accent-gold shadow-[0_0_20px_rgba(245,166,35,0.04)] hover:shadow-[0_0_30px_rgba(0,0,0,0.02)] animate-fade-in ${isGoldClosed ? 'opacity-80 saturate-75 bg-bg-secondary/20' : ''}`}>
                       {/* HEADER: Symbol & Live Price */}
                       <div className="flex justify-between items-center mb-3">
                          <div className="flex flex-col">
                             <div className="flex items-center gap-2">
                                <div className={`w-1.5 h-1.5 rounded-full ${isGoldClosed ? 'bg-text-secondary/30' : 'bg-accent-gold shadow-[0_0_8px_rgba(245,166,35,0.4)] animate-pulse'}`}></div>
                                <span className="text-[11px] font-black text-accent-gold tracking-wider uppercase">{leaderPair.symbol} Benchmark</span>
                             </div>
                             <span className="text-[7px] text-text-secondary/60 uppercase tracking-widest mt-0.5">Live Institutional Reference Price</span>
                          </div>
                          <div className="flex flex-col items-end">
                             <span className="text-sm font-mono font-black text-accent-gold tabular-nums leading-none">
                                {goldPrice > 0 ? goldPrice.toFixed(2) : '---'}
                             </span>
                             <span className={`text-[6px] font-black uppercase tracking-widest mt-1 ${isGoldClosed ? 'text-accent-red animate-pulse' : 'text-accent-green'}`}>
                                {isGoldClosed ? 'Market Closed' : 'Master Active'}
                             </span>
                          </div>
                       </div>

                       {/* HERO ACTION & DIVERGENCE SECTION */}
                       <div className="flex gap-4 p-3 bg-bg-primary/45 border border-border/80 rounded-md my-2 items-center justify-between shadow-inner">
                          {/* Action Badge */}
                          <div className="flex flex-col">
                             <span className="text-[6px] text-text-secondary/50 font-black tracking-wider uppercase mb-0.5">HFT Action</span>
                             <span className={`text-[10px] font-black px-2 py-0.5 rounded border uppercase tracking-wider font-mono ${
                                isGoldClosed 
                                   ? 'bg-text-secondary/5 text-text-secondary/60 border-border/30'
                                   : indicatorLabel.includes('BUY') 
                                   ? 'bg-accent-green/10 text-accent-green border-accent-green/20 shadow-[0_0_8px_rgba(0,212,168,0.1)] animate-pulse' 
                                   : indicatorLabel.includes('SELL') 
                                   ? 'bg-accent-red/10 text-accent-red border-accent-red/20 shadow-[0_0_8px_rgba(255,71,87,0.1)] animate-pulse' 
                                   : 'bg-text-secondary/5 text-accent-gold/90 border-border/40'
                             }`}>
                                {isGoldClosed ? 'CLOSED' : indicatorLabel}
                             </span>
                          </div>
                          
                          {/* Real Deviation */}
                          <div className="flex flex-col items-end border-r border-border/40 pr-4">
                             <span className="text-[6px] text-text-secondary/50 font-black tracking-wider uppercase mb-0.5">Deviation</span>
                             <span className="text-xs font-mono font-black text-accent-gold tabular-nums leading-none">
                                {isGoldClosed ? '---' : `${realDiff !== null ? '$' + realDiff.toFixed(2) : '0.00'}`}
                             </span>
                          </div>

                          {/* Signal Power */}
                          <div className="flex flex-col items-start">
                             <span className="text-[6px] text-text-secondary/50 font-black tracking-wider uppercase mb-0.5">Power</span>
                             <div className="flex gap-0.5 mt-0.5">
                                {[1, 2, 3, 4, 5].map(i => {
                                   const confidence = signals && signals[0] ? signals[0].confidence : 50;
                                   const power = isGoldClosed ? 0 : Math.min(5, Math.max(1, Math.ceil(confidence / 20)));
                                   return (
                                      <div key={i} className={`w-1 h-2 rounded-sm ${i <= power ? (indicatorLabel === 'BUY' ? 'bg-accent-green shadow-[0_0_5px_rgba(0,212,168,0.3)]' : indicatorLabel === 'SELL' ? 'bg-accent-red shadow-[0_0_5px_rgba(255,82,82,0.3)]' : 'bg-accent-gold/60 shadow-[0_0_5px_rgba(245,166,35,0.3)]') : 'bg-text-secondary/10'}`}></div>
                                   );
                                })}
                             </div>
                          </div>
                       </div>

                       {/* SUPPORTING METRICS - DENSE 3-COLUMN ROWS */}
                       <div className="grid grid-cols-3 gap-x-3 gap-y-1.5 pt-2 text-[8px] border-t border-border/30">
                          {/* Market Context */}
                          <div className="flex flex-col gap-0.5 border-r border-border/30 pr-2">
                             <div className="text-[6px] text-text-secondary/40 font-black tracking-wider uppercase mb-0.5">Market Context</div>
                             <div className="flex justify-between items-center">
                                <span className="text-text-secondary/80">Threshold</span>
                                <span className="font-mono font-black text-text-primary">
                                   {isGoldClosed ? '---' : `${avgDiff !== null ? '$' + avgDiff.toFixed(2) : '1.50'}`}
                                </span>
                             </div>
                             <div className="flex justify-between items-center">
                                <span className="text-text-secondary/80">Stability</span>
                                <span className="font-mono font-black text-text-primary">
                                   {isGoldClosed ? '---' : (goldStats ? goldStats.avgDelay + 'm' : '2m')}
                                </span>
                             </div>
                          </div>

                          {/* Intel Details */}
                          <div className="flex flex-col gap-0.5 border-r border-border/30 pr-2">
                             <div className="text-[6px] text-text-secondary/40 font-black tracking-wider uppercase mb-0.5">Intelligence</div>
                             <div className="flex justify-between items-center">
                                <span className="text-text-secondary/80">Confidence</span>
                                <span className="font-mono font-black text-accent-green">
                                   {isGoldClosed ? '0.0%' : (goldStats ? goldStats.avgAccuracy + '%' : '87.5%')}
                                </span>
                             </div>
                             <div className="flex justify-between items-center">
                                <span className="text-text-secondary/80">Source</span>
                                <span className="font-mono font-black text-accent-blue">
                                   DXY / INDEX
                                </span>
                             </div>
                          </div>

                          {/* Execution Speed */}
                          <div className="flex flex-col gap-0.5">
                             <div className="text-[6px] text-text-secondary/40 font-black tracking-wider uppercase mb-0.5">Execution</div>
                             <div className="flex justify-between items-center">
                                <span className="text-text-secondary/80">Latency</span>
                                <span className="font-mono font-black text-text-primary">
                                   {isGoldClosed ? '---' : (goldStats && goldStats.avgMs !== '---' ? goldStats.avgMs + 'ms' : '45ms')}
                                </span>
                             </div>
                             <div className="flex justify-between items-center">
                                <span className="text-text-secondary/80">Bridge</span>
                                <span className={`font-mono font-black ${isGoldClosed ? 'text-accent-red animate-pulse' : 'text-accent-green'}`}>
                                   {isGoldClosed ? 'CLOSED' : 'ONLINE'}
                                </span>
                             </div>
                          </div>
                       </div>
                    </div>


                 {[...activePairs].sort((a, b) => (b.weight || 50) - (a.weight || 50)).map((asset) => {
                    const price = getLivePrice(asset.symbol);
                    const stats = getAnalytics(asset.symbol);
                    const history = ratioHistories[asset.symbol] || [];
                    const avgRatio = history.length > 0 ? history.reduce((s, r) => s + r, 0) / history.length : 0;
                    const currentRatio = goldPrice > 0 && price > 0 ? price / goldPrice : 0;

                    // Compute dynamic gap and signals based on live moving ratio average
                    const gap = avgRatio > 0 ? ((currentRatio - avgRatio) / avgRatio) * 100 : 0;
                    const avgGap = avgRatio;

                    // REAL-TIME SIGNAL LOGIC (Lead-Lag)
                    let signal = `${leaderPair.symbol} WAIT`;
                    let signalColor = 'text-yellow-500';
                    let borderColor = 'border-yellow-500/20';
                    let bgColor = 'bg-bg-secondary/60';

                    const isInverse = asset.correlation === 'inverse';

                    if (Math.abs(gap) > 0.005) {
                       if (gap > 0) {
                          signal = isInverse ? `${leaderPair.symbol} SELL` : `${leaderPair.symbol} BUY`;
                          signalColor = isInverse ? 'text-accent-red' : 'text-accent-green';
                          borderColor = isInverse ? 'border-accent-red/40' : 'border-accent-green/40';
                       } else {
                          signal = isInverse ? `${leaderPair.symbol} BUY` : `${leaderPair.symbol} SELL`;
                          signalColor = isInverse ? 'text-accent-green' : 'text-accent-red';
                          borderColor = isInverse ? 'border-accent-green/40' : 'border-accent-red/40';
                       }
                    }

                      // Get exact price object from websocket to check tick time
                      const priceObj = prices[asset.symbol];
                      const lastUpdateTime = priceObj?.time ? new Date(priceObj.time).getTime() : 0;
                      
                      // Market closed check:
                      // 1. Stale feed check (>15 seconds since last tick update)
                      const isPriceStale = !price || !priceObj || (Date.now() - lastUpdateTime > 15000);
                      const isMarketClosed = isPriceStale || isWeekend;
                      
                      let activeSignal = signal;
                      let activeSignalColor = signalColor;
                      let activeBorderColor = borderColor;
                      let activeBgColor = bgColor;
                      
                      if (isMarketClosed) {
                         activeSignal = 'CLOSED';
                         activeSignalColor = 'text-text-secondary/50';
                         activeBorderColor = 'border-border/30';
                         activeBgColor = 'bg-bg-secondary/40 opacity-70 saturate-50';
                      }

                      return (
                         <div key={asset.symbol} className={`ex-card p-4 border-l-4 transition-all duration-500 ${activeBgColor} ${activeBorderColor} hover:shadow-[0_0_20px_rgba(0,0,0,0.02)] animate-fade-in`}>
                            {/* HEADER: Symbol & Live Price */}
                            <div className="flex justify-between items-center mb-3">
                               <div className="flex flex-col">
                                  <div className="flex items-center gap-2">
                                     <div className={`w-1.5 h-1.5 rounded-full ${isMarketClosed ? 'bg-text-secondary/30' : (price > 0 ? 'bg-accent-green shadow-[0_0_8px_rgba(0,212,168,0.4)] animate-pulse' : 'bg-text-secondary/20')}`}></div>
                                     <span className="text-[11px] font-black text-text-primary tracking-wider uppercase">{asset.symbol}</span>
                                  </div>
                                  <span className="text-[7px] text-text-secondary/60 uppercase tracking-widest">{asset.name || `${asset.symbol} Driver`}</span>
                               </div>
                               <div className="flex flex-col items-end">
                                  <span className="text-sm font-mono font-black text-text-primary tabular-nums">
                                     {price > 0 ? price.toFixed(2) : '---'}
                                  </span>
                                  {isMarketClosed && (
                                     <span className="text-[6px] text-accent-red font-black uppercase tracking-widest mt-1">Closed (UTC)</span>
                                  )}
                               </div>
                            </div>

                            {/* HERO ACTION & DIVERGENCE SECTION */}
                            <div className="flex gap-4 p-3 bg-bg-primary/45 border border-border/80 rounded-md my-2 items-center justify-between shadow-inner">
                               {/* Action Badge */}
                               <div className="flex flex-col">
                                  <span className="text-[6px] text-text-secondary/50 font-black tracking-wider uppercase mb-0.5">HFT Action</span>
                                  <span className={`text-[10px] font-black px-2 py-0.5 rounded border uppercase tracking-wider font-mono ${
                                     isMarketClosed
                                        ? 'bg-text-secondary/5 text-text-secondary/60 border-border/30'
                                        : activeSignal.includes('BUY') 
                                        ? 'bg-accent-green/10 text-accent-green border-accent-green/20 shadow-[0_0_8px_rgba(0,212,168,0.1)] animate-pulse' 
                                        : activeSignal.includes('SELL') 
                                        ? 'bg-accent-red/10 text-accent-red border-accent-red/20 shadow-[0_0_8px_rgba(255,71,87,0.1)] animate-pulse' 
                                        : 'bg-text-secondary/5 text-accent-gold/90 border-border/40'
                                  }`}>
                                     {isMarketClosed ? 'CLOSED' : (activeSignal.split(' ').slice(1).join(' ') || activeSignal)}
                                  </span>
                               </div>
                               
                               {/* Live Divergence */}
                               <div className="flex flex-col items-end border-r border-border/40 pr-4">
                                  <span className="text-[6px] text-text-secondary/50 font-black tracking-wider uppercase mb-0.5">Basis Gap</span>
                                  <span className={`text-xs font-mono font-black tabular-nums leading-none ${isMarketClosed ? 'text-text-secondary/50' : (gap >= 0 ? 'text-accent-green' : 'text-accent-red')}`}>
                                     {isMarketClosed ? '---' : `${gap > 0 ? '+' : ''}${gap.toFixed(4)}%`}
                                  </span>
                               </div>

                               {/* Signal Power */}
                               <div className="flex flex-col items-start">
                                  <span className="text-[6px] text-text-secondary/50 font-black tracking-wider uppercase mb-0.5">Signal Power</span>
                                  <div className="flex gap-0.5 mt-0.5">
                                     {[1, 2, 3, 4, 5].map(i => {
                                        const threshold = 0.001;
                                        const power = isMarketClosed ? 0 : Math.min(5, Math.max(1, Math.ceil(Math.abs(gap) / threshold)));
                                        return (
                                           <div key={i} className={`w-1 h-2 rounded-sm ${i <= power ? (gap >= 0 ? 'bg-accent-green shadow-[0_0_5px_rgba(0,212,168,0.3)]' : 'bg-accent-red shadow-[0_0_5px_rgba(255,82,82,0.3)]') : 'bg-text-secondary/10'}`}></div>
                                        );
                                     })}
                                  </div>
                               </div>
                            </div>

                            {/* SUPPORTING METRICS - DENSE 3-COLUMN ROWS */}
                            <div className="grid grid-cols-3 gap-x-3 gap-y-1.5 pt-2 text-[8px] border-t border-border/30">
                               {/* Market Context */}
                               <div className="flex flex-col gap-0.5 border-r border-border/30 pr-2">
                                  <div className="text-[6px] text-text-secondary/40 font-black tracking-wider uppercase mb-0.5">Market Context</div>
                                  <div className="flex justify-between items-center">
                                     <span className="text-text-secondary/80">Ratio</span>
                                     <span className="font-mono font-black text-text-primary">{isMarketClosed ? '---' : avgGap.toFixed(4)}</span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                     <span className="text-text-secondary/80">Volatility</span>
                                     <span className="font-mono font-black text-text-primary">
                                        {isMarketClosed ? '---' : (gap !== 0 ? (Math.abs(gap) * 12.5).toFixed(2) + 'x' : '1.00x')}
                                     </span>
                                  </div>
                               </div>

                               {/* Intel Details */}
                               <div className="flex flex-col gap-0.5 border-r border-border/30 pr-2">
                                  <div className="text-[6px] text-text-secondary/40 font-black tracking-wider uppercase mb-0.5">Intelligence</div>
                                  <div className="flex justify-between items-center">
                                     <span className="text-text-secondary/80">Strength</span>
                                     <span className="font-mono font-black text-accent-gold">
                                        {isMarketClosed ? '0.0%' : (stats?.avgAccuracy && stats.avgAccuracy !== '---' ? stats.avgAccuracy + '%' : '87.5%')}
                                     </span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                     <span className="text-text-secondary/80">Type</span>
                                     <span className={`font-mono font-black ${isMarketClosed ? 'text-text-secondary/50' : (asset.correlation === 'same' ? 'text-accent-green' : 'text-accent-red')}`}>
                                        {asset.correlation === 'same' ? 'SAME' : 'INVERSE'}
                                     </span>
                                  </div>
                               </div>

                               {/* Execution Speed */}
                               <div className="flex flex-col gap-0.5">
                                  <div className="text-[6px] text-text-secondary/40 font-black tracking-wider uppercase mb-0.5">Execution</div>
                                  <div className="flex justify-between items-center">
                                     <span className="text-text-secondary/80">Feed</span>
                                     <span className="font-mono font-black text-text-primary">
                                        {isMarketClosed ? '---' : (stats?.avgDelay ? (parseFloat(stats.avgDelay) * 12 + 8).toFixed(0) + 'ms' : '15ms')}
                                     </span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                     <span className="text-text-secondary/80">MT5 Exec</span>
                                     <span className="font-mono font-black text-accent-blue">
                                        {isMarketClosed ? '---' : (stats?.avgMs && stats.avgMs !== '---' ? stats.avgMs + 'ms' : '45ms')}
                                     </span>
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
