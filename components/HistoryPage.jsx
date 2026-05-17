'use client';
import { useWebSocket } from '@/components/WebSocketProvider';
import { useState } from 'react';

export default function HistoryPage() {
  const { historyLogs, tradeStats, dailyStats, signals } = useWebSocket();
  const [activeCategory, setActiveCategory] = useState('trades');
  const [selectedPair, setSelectedPair] = useState('ALL');

  const categories = [
    { id: 'trades', label: 'Trade Logs', icon: '💰' },
    { id: 'analytics', label: 'Analytics Dashboard', icon: '📊' },
    { id: 'signals', label: 'Signal Archive', icon: '📡' },
    { id: 'system', label: 'System Events', icon: '⚙️' }
  ];

  // Extract unique pairs from logs
  const availablePairs = ['ALL', ...new Set((historyLogs || []).map(log => log.symbol || 'XAUUSD'))];

  const filteredLogs = selectedPair === 'ALL' 
    ? historyLogs 
    : historyLogs.filter(log => (log.symbol || 'XAUUSD') === selectedPair);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end mb-8 border-b border-white/5 pb-6">
        <div className="flex items-center gap-12">
           <div>
              <h2 className="text-xl font-black text-white uppercase italic tracking-widest">Master Audit Trail</h2>
              <p className="text-[10px] text-text-secondary mt-1 uppercase font-bold tracking-widest">Real-time repository for all institutional activities</p>
           </div>

           {activeCategory === 'trades' && (
              <div className="flex flex-col gap-1.5">
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
        
        <div className="flex bg-black/20 p-1 rounded-xl border border-white/5">
           {categories.map(cat => (
              <button
                 key={cat.id}
                 onClick={() => setActiveCategory(cat.id)}
                 className={`px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-300 flex items-center gap-2 ${
                    activeCategory === cat.id 
                    ? 'bg-accent-gold text-black shadow-[0_0_20px_rgba(245,166,35,0.3)]' 
                    : 'text-white/40 hover:text-white/80'
                 }`}
              >
                 <span>{cat.icon}</span>
                 {cat.label}
              </button>
           ))}
        </div>
      </div>

      <div className="bg-bg-secondary/40 border border-white/5 rounded-2xl overflow-hidden min-h-[400px]">
        {activeCategory === 'trades' && (
           <>
              {(!filteredLogs || filteredLogs.length === 0) ? (
                  <div className="p-20 text-center text-white/20 uppercase font-black tracking-widest">
                      No matching trade logs found for {selectedPair}
                  </div>
              ) : (
                  <table className="w-full text-left border-collapse">
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
                          <td className="p-4 text-white/40">{new Date(item.closed_at).toLocaleString()}</td>
                          <td className={`p-4 ${item.trade_type === 'BUY' ? 'text-accent-green' : 'text-accent-red'}`}>{item.trade_type}</td>
                          <td className="p-4 font-mono text-white/60">#{item.ticket}</td>
                          <td className="p-4 font-mono">{item.entry_price}</td>
                          <td className="p-4 font-mono">{item.close_price}</td>
                          <td className={`p-4 font-mono ${item.profit >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                          ${parseFloat(item.profit).toFixed(2)}
                          </td>
                          <td className="p-4 text-right">
                          <span className={`px-2 py-1 rounded-md text-[9px] font-black ${item.profit > 0 ? 'bg-accent-green/20 text-accent-green' : 'bg-accent-red/20 text-accent-red'}`}>
                              {item.profit > 0 ? 'PROFIT' : 'LOSS'}
                          </span>
                          </td>
                      </tr>
                      ))}
                  </tbody>
                  </table>
              )}
           </>
        )}

         {activeCategory === 'analytics' && (
            <div className="p-8">
               <div className="grid grid-cols-4 gap-6 mb-8">
                  <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                     <span className="text-[10px] text-accent-gold uppercase font-black tracking-widest block mb-2">Total Trades (All Time)</span>
                     <span className="text-3xl font-black text-white">{tradeStats?.totalTrades || 0}</span>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                     <span className="text-[10px] text-accent-green uppercase font-black tracking-widest block mb-2">Win Rate (TP Hits)</span>
                     <span className="text-3xl font-black text-accent-green">{tradeStats?.tp?.pct || '0.0'}%</span>
                     <span className="text-xs font-bold text-white/40 block mt-1">{tradeStats?.tp?.count || 0} Trades</span>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                     <span className="text-[10px] text-accent-red uppercase font-black tracking-widest block mb-2">Loss Rate (SL Hits)</span>
                     <span className="text-3xl font-black text-accent-red">{tradeStats?.sl?.pct || '0.0'}%</span>
                     <span className="text-xs font-bold text-white/40 block mt-1">{tradeStats?.sl?.count || 0} Trades</span>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                     <span className="text-[10px] text-accent-blue uppercase font-black tracking-widest block mb-2">Break Even Rate</span>
                     <span className="text-3xl font-black text-accent-blue">{tradeStats?.be?.pct || '0.0'}%</span>
                     <span className="text-xs font-bold text-white/40 block mt-1">{tradeStats?.be?.count || 0} Trades</span>
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-6">
                  <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                     <h3 className="text-sm font-black text-white uppercase tracking-widest mb-6 border-b border-white/10 pb-4">Today's Performance</h3>
                     <div className="space-y-4">
                        <div className="flex justify-between items-center">
                           <span className="text-xs font-bold text-white/60">Trades Today</span>
                           <span className="text-sm font-black text-white">{dailyStats?.tradesToday || 0}</span>
                        </div>
                        <div className="flex justify-between items-center">
                           <span className="text-xs font-bold text-white/60">Today's Win Rate</span>
                           <span className="text-sm font-black text-accent-green">{dailyStats?.winRate || '0.0'}%</span>
                        </div>
                        <div className="flex justify-between items-center">
                           <span className="text-xs font-bold text-white/60">Daily P/L</span>
                           <span className={`text-sm font-black ${dailyStats?.dailyPL >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                              ${dailyStats?.dailyPL?.toFixed(2) || '0.00'}
                           </span>
                        </div>
                        <div className="flex justify-between items-center">
                           <span className="text-xs font-bold text-white/60">Max Drawdown</span>
                           <span className="text-sm font-black text-accent-red">${dailyStats?.drawdown?.toFixed(2) || '0.00'}</span>
                        </div>
                     </div>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                     <h3 className="text-sm font-black text-white uppercase tracking-widest mb-6 border-b border-white/10 pb-4">Best Signal Combinations (Est.)</h3>
                     <div className="space-y-4">
                        <div className="flex justify-between items-center bg-bg-secondary p-3 rounded-lg border border-white/5">
                           <span className="text-xs font-bold text-accent-gold">Gold + DXY (Inverse)</span>
                           <span className="text-xs font-black text-accent-green">94% Accuracy</span>
                        </div>
                        <div className="flex justify-between items-center bg-bg-secondary p-3 rounded-lg border border-white/5">
                           <span className="text-xs font-bold text-accent-gold">Gold + JPY (Same)</span>
                           <span className="text-xs font-black text-accent-green">88% Accuracy</span>
                        </div>
                        <div className="flex justify-between items-center bg-bg-secondary p-3 rounded-lg border border-white/5">
                           <span className="text-xs font-bold text-accent-gold">Best Time of Day</span>
                           <span className="text-xs font-black text-accent-blue">London Open (08:00 UTC)</span>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
         )}

        {activeCategory === 'signals' && (
           <>
              {(!signals || signals.length === 0) ? (
                  <div className="p-20 text-center">
                     <div className="w-16 h-16 bg-accent-gold/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-accent-gold/20">
                        <span className="text-2xl">📡</span>
                     </div>
                     <h3 className="text-sm font-black text-white uppercase tracking-widest mb-2">Signal Archive (HFT Scan)</h3>
                     <p className="text-[10px] text-text-secondary uppercase font-bold max-w-sm mx-auto">Historical lead-lag divergence signals that did not meet execution filters are logged here for neural retraining.</p>
                     <div className="mt-8 text-[9px] font-black text-white/10 uppercase tracking-[0.4em]">Listening for Data...</div>
                  </div>
              ) : (
                  <table className="w-full text-left border-collapse">
                  <thead>
                      <tr className="bg-white/5 text-[10px] font-black text-text-secondary uppercase tracking-widest">
                      <th className="p-4">Time (Local)</th>
                      <th className="p-4">Type</th>
                      <th className="p-4">Confidence</th>
                      <th className="p-4">Gold Price</th>
                      <th className="p-4">Take Profit</th>
                      <th className="p-4">Stop Loss</th>
                      <th className="p-4">Spread</th>
                      <th className="p-4 text-right">Action Status</th>
                      </tr>
                  </thead>
                  <tbody className="text-xs font-bold text-white/80">
                      {signals.map((sig, idx) => (
                      <tr key={sig.id || idx} className="border-t border-white/5 hover:bg-white/[0.02] transition-colors">
                          <td className="p-4 text-white/40">{new Date(sig.timestamp).toLocaleTimeString()}</td>
                          <td className={`p-4 ${sig.type === 'BUY' ? 'text-accent-green' : 'text-accent-red'}`}>{sig.type}</td>
                          <td className="p-4 font-mono text-accent-gold">{sig.confidence}%</td>
                          <td className="p-4 font-mono">${sig.goldPrice}</td>
                          <td className="p-4 font-mono text-accent-green">${sig.tp}</td>
                          <td className="p-4 font-mono text-accent-red">${sig.sl}</td>
                          <td className="p-4 font-mono text-white/60">{sig.spread} pips</td>
                          <td className="p-4 text-right">
                             <span className={`px-2 py-1 rounded-md text-[9px] font-black ${sig.action === 'EXECUTE' ? 'bg-accent-green/20 text-accent-green' : 'bg-white/10 text-white/40'}`}>
                                 {sig.action}
                             </span>
                          </td>
                      </tr>
                      ))}
                  </tbody>
                  </table>
              )}
           </>
        )}

        {activeCategory === 'system' && (
           <div className="p-20 text-center">
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
