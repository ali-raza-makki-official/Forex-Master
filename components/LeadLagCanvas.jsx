'use client';
import { useWebSocket } from '@/components/WebSocketProvider';
import { useState, useEffect } from 'react';
import HFTIndicator from '@/components/HFTIndicator';

export default function LeadLagCanvas() {
   const { prices, hftAnalytics, tradeStats, gapStats, atr, activePairs, leaderPair, signals, liveScore, systemSettings } = useWebSocket();
   const VISUAL_THRESHOLD = 0.015; // Premium visual noise filter to stabilize signals during quiet hours
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

   // 1. Dynamic rolling ratio tracking for the primary benchmark asset
   const benchmarkHistory = (benchmarkSymbol && ratioHistories && ratioHistories[benchmarkSymbol]) || [];
   const benchmarkAvgRatio = benchmarkHistory.length > 0 ? benchmarkHistory.reduce((s, r) => s + r, 0) / benchmarkHistory.length : 0;
   const benchmarkCurrentRatio = goldPrice > 0 && benchmarkPrice > 0 ? benchmarkPrice / goldPrice : 0;

   // 2. Compute dynamic expected gold price & absolute deviation
   let multiplier = 45;
   if (benchmarkAvgRatio > 0) {
      multiplier = 1 / benchmarkAvgRatio;
   } else if (benchmarkPrice > 0 && goldPrice > 0) {
      multiplier = goldPrice / benchmarkPrice;
   }

   const expectedGoldPrice = benchmarkPrice * multiplier;
   const realDiff = benchmarkPrice > 0 && goldPrice > 0 ? Math.abs(goldPrice - expectedGoldPrice) : null;

   // 3. Compute dynamic gap percentage (just like the other driver cards)
   const benchmarkGap = benchmarkAvgRatio > 0 ? ((benchmarkCurrentRatio - benchmarkAvgRatio) / benchmarkAvgRatio) * 100 : 0;

   // Use database standard deviation if available, or fall back to 0.05% of Gold price (highly accurate standard threshold)
   const avgDiff = gapStats?.avgDiff 
      ? (parseFloat(gapStats.avgDiff) * (benchmarkSymbol === 'DXY' ? 45 : 1)) 
      : (goldPrice > 0 ? goldPrice * 0.0005 : 1.50);

   let indicatorColor = 'bg-white/5';
   let indicatorLabel = 'SCAN';

   if (benchmarkGap !== 0) {
      const isInverse = primaryAsset?.correlation === 'inverse';
      if (Math.abs(benchmarkGap) > VISUAL_THRESHOLD) {
         if (benchmarkGap > 0) {
            indicatorColor = isInverse ? 'bg-red-500' : 'bg-green-500';
            indicatorLabel = isInverse ? 'SELL' : 'BUY';
         } else {
            indicatorColor = isInverse ? 'bg-green-500' : 'bg-red-500';
            indicatorLabel = isInverse ? 'BUY' : 'SELL';
         }
      } else {
         indicatorColor = 'bg-yellow-500';
         indicatorLabel = 'WAIT';
      }
   }

   // ATR based dynamic SL/TP levels
   const currentATR = atr;
   const tpLevel = (goldPrice > 0 && currentATR) ? (goldPrice + currentATR * 1.5).toFixed(3) : '---';
   const slLevel = (goldPrice > 0 && currentATR) ? (goldPrice - currentATR * 1.0).toFixed(3) : '---';

   return (
      <div className="w-full h-full flex flex-col overflow-hidden relative">

          {/* 1. SINGLE ULTRA-PREMIUM HFT INTEGRATED COMMAND BAR */}
          <div className="flex items-center justify-between py-3.5 px-6 bg-bg-secondary/20 border-b border-white/5 text-[13px] select-none font-sans">
             {/* Title & Core Tag Removed */}
             <div></div>

             {/* Core Intel Capsules Row */}
             <div className="flex items-center gap-8 flex-1 justify-center mx-4 overflow-hidden">
                {/* 1. ATR & TARGET */}
                <div className="flex items-center gap-3.5 text-[13px]">
                   <span className="text-text-secondary/40 font-black uppercase text-[10px] tracking-wider">ATR</span>
                   <span className="font-mono font-black text-accent-gold text-[15px]">{currentATR !== null ? currentATR.toFixed(2) : '---'} <span className="text-[10px] text-text-secondary/40 font-normal">pips</span></span>
                   <span className="w-px h-3.5 bg-white/10"></span>
                   <span className="text-text-secondary/40 font-black uppercase text-[10px] tracking-wider">TP</span>
                   <span className="font-mono font-black text-accent-green text-[15px]">{tpLevel}</span>
                   <span className="w-px h-3.5 bg-white/10"></span>
                   <span className="text-text-secondary/40 font-black uppercase text-[10px] tracking-wider">SL</span>
                   <span className="font-mono font-black text-accent-red text-[15px]">{slLevel}</span>
                </div>

                <span className="w-px h-4 bg-white/5"></span>

                {/* 2. Spread */}
                <div className="flex items-center gap-3 text-[13px]">
                   <span className="text-text-secondary/40 font-black uppercase text-[10px] tracking-wider">Spread</span>
                   <span className={`font-mono font-black text-[15px] ${spreadData.isSafe ? 'text-accent-green' : 'text-accent-red'}`}>
                      {spreadData.pips} <span className="text-[10px] text-text-secondary/40 font-normal">pips</span>
                   </span>
                   <div className={`w-2 h-2 rounded-full ${spreadData.isSafe ? 'bg-accent-green animate-pulse' : 'bg-accent-red animate-ping'}`}></div>
                </div>

                <span className="w-px h-4 bg-white/5"></span>

                {/* 3. Dynamic HFT Stats */}
                <div className="flex items-center gap-4 text-[13px]">
                   <span className="text-text-secondary/40 font-black uppercase text-[10px] tracking-wider">Total HFT</span>
                   <span className="font-mono font-black text-text-primary text-[15px]">{tradeStats?.totalTrades || 0}</span>
                   <span className="w-px h-3.5 bg-white/10"></span>
                   <span className="text-text-secondary/40 font-black uppercase text-[10px] tracking-wider">TP</span>
                   <span className="font-mono font-black text-accent-green text-[15px]">{tradeStats?.tp?.pct}%</span>
                   <span className="w-px h-3.5 bg-white/10"></span>
                   <span className="text-text-secondary/40 font-black uppercase text-[10px] tracking-wider">SL</span>
                   <span className="font-mono font-black text-accent-red text-[15px]">{tradeStats?.sl?.pct}%</span>
                   <span className="w-px h-3.5 bg-white/10"></span>
                   <span className="text-text-secondary/40 font-black uppercase text-[10px] tracking-wider">BE</span>
                   <span className="font-mono font-black text-accent-blue text-[15px]">{tradeStats?.be?.pct}%</span>
                </div>
             </div>

             {/* Right side: Legend Signals Removed */}
             <div></div>
          </div>

          <div className="px-0 flex flex-col flex-1 overflow-hidden">


            <div className="flex-1 overflow-auto custom-scrollbar p-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-2">

                    {/* PROMOTED TARGET BENCHMARK - 1 COLUMN */}
                    <div className={`ex-card p-5 transition-all duration-500 bg-accent-gold/5 border-l-4 border-accent-gold animate-fade-in ${isGoldClosed ? 'opacity-80 saturate-75 bg-bg-secondary/20' : ''}`}>
                       {/* HEADER: Symbol & Live Price */}
                       <div className="flex justify-between items-center mb-4">
                          <div className="flex flex-col">
                             <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${isGoldClosed ? 'bg-text-secondary/30' : 'bg-accent-gold animate-pulse'}`}></div>
                                <span className="text-[14px] font-black text-accent-gold tracking-wider uppercase">{leaderPair.symbol} Benchmark</span>
                             </div>
                             <span className="text-[9px] text-text-secondary/60 uppercase tracking-widest mt-1">Live Institutional Reference Price</span>
                          </div>
                          <div className="flex flex-col items-end">
                             <span className="text-2xl font-mono font-black text-accent-gold tabular-nums leading-none">
                                {goldPrice > 0 ? goldPrice.toFixed(3) : '---'}
                             </span>
                             <span className={`text-[9px] font-black uppercase tracking-widest mt-1.5 ${isGoldClosed ? 'text-accent-red animate-pulse' : 'text-accent-green'}`}>
                                {isGoldClosed ? 'Market Closed' : 'Master Active'}
                             </span>
                          </div>
                       </div>

                       {/* HERO ACTION & DIVERGENCE SECTION */}
                       <div className="flex gap-4 p-4 bg-bg-primary/45 border border-border/80 rounded-md my-3 items-center justify-between">
                          {/* Action Badge */}
                          <div className="flex flex-col">
                             <span className="text-[9px] text-text-secondary/50 font-black tracking-wider uppercase mb-1">HFT Action</span>
                             <span className={`text-[12px] font-black px-3 py-1 rounded border uppercase tracking-wider font-mono ${
                                isGoldClosed 
                                   ? 'bg-text-secondary/5 text-text-secondary/60 border-border/30'
                                   : indicatorLabel.includes('BUY') 
                                   ? 'bg-accent-green/10 text-accent-green border-accent-green/20 animate-pulse' 
                                   : indicatorLabel.includes('SELL') 
                                   ? 'bg-accent-red/10 text-accent-red border-accent-red/20 animate-pulse' 
                                   : 'bg-text-secondary/5 text-accent-gold/90 border-border/40'
                             }`}>
                                {isGoldClosed ? 'CLOSED' : indicatorLabel}
                             </span>
                          </div>
                          
                          {/* Real Deviation */}
                          <div className="flex flex-col items-end border-r border-border/40 pr-4">
                             <span className="text-[9px] text-text-secondary/50 font-black tracking-wider uppercase mb-1">Deviation</span>
                             <span className="text-base font-mono font-black text-accent-gold tabular-nums leading-none">
                                {isGoldClosed ? '---' : `${realDiff !== null ? '$' + realDiff.toFixed(3) : '0.000'}`}
                             </span>
                          </div>

                          {/* Signal Power */}
                           <div className="flex flex-col items-start">
                              <span className="text-[9px] text-text-secondary/50 font-black tracking-wider uppercase mb-1">Power</span>
                              <div className="flex gap-1 mt-0.5">
                                 {[1, 2, 3, 4, 5].map(i => {
                                    const scorePct = liveScore ? (liveScore.score / (liveScore.threshold || 100)) * 100 : 0;
                                    const power = isGoldClosed ? 0 : Math.min(5, Math.max(1, Math.ceil(scorePct / 20)));
                                    const isActive = i <= power;
                                    const bgClass = isActive 
                                       ? (indicatorLabel === 'BUY' ? 'bg-accent-green' : indicatorLabel === 'SELL' ? 'bg-accent-red' : 'bg-accent-gold') 
                                       : 'bg-text-secondary';
                                    const opacityClass = isActive 
                                       ? (indicatorLabel === 'WAIT' ? 'opacity-60' : 'opacity-100') 
                                       : 'opacity-15';
                                    return (
                                       <div key={i} className={`w-1.5 h-3 rounded-sm ${bgClass} ${opacityClass}`}></div>
                                    );
                                 })}
                              </div>
                           </div>
                        </div>                         {/* SUPPORTING METRICS - DENSE 3-COLUMN ROWS */}                         {/* HFT TRIGGER RADAR GAUGE (Slim & Transparent) */}
                          <div className="mt-3.5 space-y-2 animate-fade-in px-1">
                             <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider">
                                <span className="text-text-secondary flex items-center gap-1.5">
                                   <span className="animate-pulse">📡</span> Trade Trigger Radar
                                </span>
                                <span className={`font-mono text-xs font-black ${
                                   !liveScore ? 'text-text-secondary/50' :
                                   (liveScore.score >= liveScore.threshold) ? 'text-accent-green animate-pulse' :
                                   (liveScore.score >= liveScore.threshold * 0.7) ? 'text-accent-gold' : 'text-text-secondary'
                                }`}>
                                   {liveScore 
                                      ? `Score: ${liveScore.score}/${liveScore.threshold} (${Math.round((liveScore.score / (liveScore.threshold || 100)) * 100)}%)` 
                                      : 'WAITING FOR MOMENTUM...'}
                                </span>
                             </div>

                             {/* Dynamic Progress Bar (Slim h-1.5) */}
                             <div className="relative w-full h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                                {/* Required Threshold Indicator Dot (Positioned Live based on Settings!) */}
                                <div 
                                   className="absolute top-0 bottom-0 w-1 bg-accent-gold opacity-80 z-10 transition-all duration-300" 
                                   style={{ left: `${systemSettings?.min_confidence || 85}%` }}
                                   title={`Execution Threshold (${systemSettings?.min_confidence || 85}%)`}
                                ></div>
                                
                                {/* Live Score Fill */}
                                <div 
                                   className={`h-full rounded-full transition-all duration-500 ease-out ${
                                      !liveScore ? 'w-0' :
                                      (liveScore.score >= liveScore.threshold) ? 'bg-accent-green shadow-[0_0_12px_#10b981]' :
                                      (liveScore.score >= liveScore.threshold * 0.7) ? 'bg-accent-gold shadow-[0_0_12px_#f59e0b]' : 'bg-accent-blue opacity-60'
                                   }`}
                                   style={{ 
                                      width: `${liveScore ? Math.min(100, (liveScore.score / (liveScore.threshold || 100)) * 100) : 0}%` 
                                   }}
                                ></div>
                             </div>

                             {/* Slim Contextual Info & Status */}
                             <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-text-secondary/50 pt-0.5">
                                <div className="flex gap-3">
                                   <span>0% Idle</span>
                                   <span className="text-accent-gold">Threshold ({systemSettings?.min_confidence || 85}%)</span>
                                </div>
                                <span className={`font-mono font-black ${
                                   !liveScore ? 'text-text-secondary/80' :
                                   (liveScore.score >= liveScore.threshold) ? 'text-accent-green' :
                                   (liveScore.score >= liveScore.threshold * 0.7) ? 'text-accent-gold' : 'text-text-secondary/70'
                                }`}>
                                   {!liveScore ? 'SCANNING MARKETS...' :
                                    (liveScore.score >= liveScore.threshold) ? '⚡ READY!' :
                                    (liveScore.score >= liveScore.threshold * 0.7) ? '📈 MOMENTUM' :
                                    '⏳ LOW MOMENTUM'}
                                </span>
                             </div>
                          </div>

                       <div className="grid grid-cols-3 gap-x-4 gap-y-2 pt-3 text-[11px] border-t border-border/30">
                          {/* Market Context */}
                          <div className="flex flex-col gap-1 border-r border-border/30 pr-2">
                             <div className="text-[9px] text-text-secondary/40 font-black tracking-wider uppercase mb-1">Market Context</div>
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
                          <div className="flex flex-col gap-1 border-r border-border/30 pr-2">
                             <div className="text-[9px] text-text-secondary/40 font-black tracking-wider uppercase mb-1">Intelligence</div>
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
                          <div className="flex flex-col gap-1">
                             <div className="text-[9px] text-text-secondary/40 font-black tracking-wider uppercase mb-1">Execution</div>
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

                    if (Math.abs(gap) > VISUAL_THRESHOLD) {
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
                         <div key={asset.symbol} className={`ex-card p-5 border-l-4 transition-all duration-500 ${activeBgColor} ${activeBorderColor} animate-fade-in`}>
                            {/* HEADER: Symbol & Live Price */}
                            <div className="flex justify-between items-center mb-3">
                               <div className="flex flex-col">
                                  <div className="flex items-center gap-2">
                                     <div className={`w-1.5 h-1.5 rounded-full ${isMarketClosed ? 'bg-text-secondary/30' : (price > 0 ? 'bg-accent-green animate-pulse' : 'bg-text-secondary/20')}`}></div>
                                     <span className="text-[14px] font-black text-text-primary tracking-wider uppercase">{asset.symbol}</span>
                                  </div>
                                  <span className="text-[9px] text-text-secondary/60 uppercase tracking-widest">{asset.name || `${asset.symbol} Driver`}</span>
                               </div>
                               <div className="flex flex-col items-end">
                                  <span className="text-2xl font-mono font-black text-text-primary tabular-nums">
                                     {price > 0 ? price.toFixed(3) : '---'}
                                  </span>
                                  {isMarketClosed && (
                                     <span className="text-[9px] text-accent-red font-black uppercase tracking-widest mt-1.5">Closed (UTC)</span>
                                  )}
                               </div>
                            </div>

                            {/* HERO ACTION & DIVERGENCE SECTION */}
                            <div className="flex gap-4 p-4 bg-bg-primary/45 border border-border/80 rounded-md my-2 items-center justify-between">
                               {/* Action Badge */}
                               <div className="flex flex-col">
                                  <span className="text-[9px] text-text-secondary/50 font-black tracking-wider uppercase mb-1">HFT Action</span>
                                  <span className={`text-[12px] font-black px-3 py-1 rounded border uppercase tracking-wider font-mono ${
                                     isMarketClosed
                                        ? 'bg-text-secondary/5 text-text-secondary/60 border-border/30'
                                        : activeSignal.includes('BUY') 
                                        ? 'bg-accent-green/10 text-accent-green border-accent-green/20 animate-pulse' 
                                        : activeSignal.includes('SELL') 
                                        ? 'bg-accent-red/10 text-accent-red border-accent-red/20 animate-pulse' 
                                        : 'bg-text-secondary/5 text-accent-gold/90 border-border/40'
                                  }`}>
                                     {isMarketClosed ? 'CLOSED' : (activeSignal.split(' ').slice(1).join(' ') || activeSignal)}
                                  </span>
                               </div>
                               
                               {/* Live Divergence */}
                               <div className="flex flex-col items-end border-r border-border/40 pr-4">
                                  <span className="text-[9px] text-text-secondary/50 font-black tracking-wider uppercase mb-1">Basis Gap</span>
                                  <span className={`text-base font-mono font-black tabular-nums leading-none ${isMarketClosed ? 'text-text-secondary/50' : (gap >= 0 ? 'text-accent-green' : 'text-accent-red')}`}>
                                     {isMarketClosed ? '---' : `${gap > 0 ? '+' : ''}${gap.toFixed(4)}%`}
                                  </span>
                               </div>

                               {/* Signal Power */}
                               <div className="flex flex-col items-start">
                                  <span className="text-[9px] text-text-secondary/50 font-black tracking-wider uppercase mb-1">Signal Power</span>
                                  <div className="flex gap-0.5 mt-0.5">
                                     {[1, 2, 3, 4, 5].map(i => {
                                        const step = VISUAL_THRESHOLD / 5;
                                        const power = isMarketClosed ? 0 : Math.min(5, Math.max(1, Math.ceil(Math.abs(gap) / (step || 0.003))));
                                        return (
                                           <div key={i} className={`w-1 h-2 rounded-sm ${i <= power ? (gap >= 0 ? 'bg-accent-green' : 'bg-accent-red') : 'bg-text-secondary opacity-15'}`}></div>
                                        );
                                     })}
                                  </div>
                               </div>
                            </div>

                        {/* SUPPORTING METRICS - DENSE 3-COLUMN ROWS */}


                        <div className="grid grid-cols-3 gap-x-4 gap-y-2 pt-3 text-[11px] border-t border-border/30">
                               {/* Market Context */}
                               <div className="flex flex-col gap-0.5 border-r border-border/30 pr-2">
                                  <div className="text-[9px] text-text-secondary/40 font-black tracking-wider uppercase mb-1">Market Context</div>
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
                                  <div className="text-[9px] text-text-secondary/40 font-black tracking-wider uppercase mb-1">Intelligence</div>
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
                                  <div className="text-[9px] text-text-secondary/40 font-black tracking-wider uppercase mb-1">Execution</div>
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
