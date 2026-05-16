import { useWebSocket } from '@/components/WebSocketProvider';

export default function LivePriceTicker() {
  const { prices, activePairs, leaderPair } = useWebSocket();
  
  if (!prices || Object.keys(prices).length === 0) {
    return <div className="p-2 px-4 bg-bg-secondary text-text-secondary text-[10px] uppercase tracking-widest font-bold">Waiting for MT5 feeds...</div>;
  }

  // Combine leader and active pairs for display
  const displaySymbols = [leaderPair.symbol, ...activePairs.map(p => p.symbol)];

  return (
    <div className="flex items-center justify-end h-10 px-4 gap-2 w-full overflow-x-auto custom-scrollbar no-scrollbar">
      {displaySymbols.map(symbol => {
        const data = prices[symbol];
        if (!data) return null;
        
        return (
          <div key={symbol} className="flex items-center gap-2 px-3 h-7 bg-bg-tertiary/30 rounded transition-colors shrink-0">
            <span className={`text-[10px] font-black ${symbol === 'XAUUSD' ? 'text-accent-gold' : 'text-text-secondary'}`}>
              {symbol}
            </span>
            <span className="text-xs font-mono font-bold text-text-primary">
              {typeof data.bid === 'number' ? data.bid.toFixed(symbol.includes('JPY') ? 3 : 2) : data.bid}
            </span>
            <span className={`text-[9px] font-bold ${parseFloat(data.change || 0) >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
              {data.change ? (parseFloat(data.change) >= 0 ? '+' : '') + data.change + '%' : '0.00%'}
            </span>
          </div>
        );
      })}
    </div>
  );
}
