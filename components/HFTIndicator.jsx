'use client';
import { useWebSocket } from '@/components/WebSocketProvider';

/**
 * HFTIndicator - Dynamic Lead-Lag Indicator
 * Visualizes the divergence between the Lead asset (e.g. DXY) and the Lag asset (Gold).
 * Now supports dynamic primary pair detection to prevent hardcoded DXY crashes.
 */
export default function HFTIndicator() {
  const { prices, gapStats, activePairs } = useWebSocket();
  
  const goldPrice = prices?.['XAUUSD']?.bid || 0;
  
  // Dynamically find the primary benchmark (prioritize DXY, otherwise use highest weight)
  const primaryAsset = activePairs?.find(p => p.symbol === 'DXY') || 
                      (activePairs?.length > 0 ? [...activePairs].sort((a,b) => (b.weight||0) - (a.weight||0))[0] : null);
  
  const benchmarkSymbol = primaryAsset?.symbol;
  const benchmarkPrice = benchmarkSymbol ? prices?.[benchmarkSymbol]?.bid || 0 : 0;
  
  // Multiplier calculation (Simple heuristic for UI visualization)
  // If DXY, use 45. Otherwise, calculate a rough ratio if both prices exist.
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
       indicatorColor = 'bg-green-500';
       indicatorLabel = 'BUY';
    } else if (realDiff < avgDiff * 0.5) {
       indicatorColor = 'bg-red-500';
       indicatorLabel = 'SELL';
    } else {
       indicatorColor = 'bg-yellow-500';
       indicatorLabel = 'WAIT';
    }
  }

  return (
    <div className="flex items-center gap-6">
      <div className="flex items-center gap-2 pr-4">
        <div className={`w-2 h-2 rounded-full ${indicatorColor} ${indicatorLabel !== 'SCAN' ? 'animate-pulse' : ''}`}></div>
        <div className="flex flex-col">
            <span className="text-[10px] font-black text-white uppercase tracking-wider">{indicatorLabel}</span>
            <span className="text-[6px] text-text-secondary uppercase font-bold">{benchmarkSymbol || 'AUTO'}</span>
        </div>
      </div>
      <div className="flex items-center gap-4 pl-1">
        <div className="flex flex-col">
          <span className="text-[7px] text-text-secondary font-bold uppercase leading-none mb-0.5">Real Diff</span>
          <span className="text-[10px] font-mono font-black text-accent-gold">{realDiff !== null ? `$${realDiff.toFixed(2)}` : '---'}</span>
        </div>
        <div className="flex flex-col text-right">
          <span className="text-[7px] text-text-secondary font-bold uppercase leading-none mb-0.5">Avg Diff</span>
          <span className="text-[10px] font-mono text-white/40">{avgDiff !== null ? `$${avgDiff.toFixed(2)}` : '---'}</span>
        </div>
      </div>
    </div>
  );
}
