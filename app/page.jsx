'use client'; // Main Dashboard Page
import { useState, useEffect } from 'react';
import { useWebSocket } from '@/components/WebSocketProvider';
import LivePriceTicker from '@/components/LivePriceTicker';
import SignalCard from '@/components/SignalCard';
import ProgressiveLockCard from '@/components/ProgressiveLockCard';
import AutoScalpSettings from '@/components/AutoScalpSettings';
import LeadLagCanvas from '@/components/LeadLagCanvas';
import SimpleGoldTerminal from '@/components/SimpleGoldTerminal';
import HistoryPage from '@/components/HistoryPage';
import SettingsPage from '@/components/SettingsPage';
import HFTIndicator from '@/components/HFTIndicator';

export default function Dashboard() {
  const { status, prices, positions, lockStates, balance, socket, systemSettings, historyLogs } = useWebSocket();
  const [activeTab, setActiveTab] = useState('intelligence');
  const [isEngineOpen, setEngineOpen] = useState(false);
  const [isAutoScalpPopupOpen, setAutoScalpPopupOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState('live');
  
  const isAutoScalpEnabled = !!systemSettings?.auto_scalp_enabled;

  const handleHeaderAutoScalpToggle = () => {
    const nextVal = !isAutoScalpEnabled;
    if (socket && socket.readyState === 1) {
      socket.send(JSON.stringify({
        action: 'set_auto_scalp',
        enabled: nextVal,
        minConfidence: systemSettings?.min_confidence || 85
      }));
    }
  };
  
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') || 'dark';
    }
    return 'dark';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [theme]);
  
  const navItems = [
    { id: 'intelligence', label: 'Intelligence', icon: 'M13 10V3L4 14h7v7l9-11h-7z' }, // Bolt icon for Intel
    { id: 'terminal', label: 'Terminal', icon: 'M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { id: 'history', label: 'History', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
    { id: 'settings', label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' }
  ];
  
  return (
    <main className="flex flex-col h-screen bg-bg-primary text-text-primary selection:bg-accent-gold/30 overflow-hidden relative font-sans">
      
      {/* 1. TOP HEADER */}
      <header className="flex justify-between items-center px-6 h-16 bg-bg-secondary border-b border-border z-30 shadow-none">
        <div className="flex items-center gap-5">
           <div className="group relative">
              <div className="absolute -inset-1 bg-accent-gold rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
              <div className="relative w-10 h-10 bg-gradient-to-br from-accent-gold to-yellow-600 rounded-xl flex items-center justify-center shadow-none cursor-pointer hover:scale-105 active:scale-95 transition-all">
                 <span className="text-black text-2xl font-black italic">X</span>
              </div>
           </div>
           
           <div className="flex flex-col">
              <h1 className="text-sm font-black tracking-tighter leading-none text-text-primary flex items-center gap-1.5">
                GOLD SCALPER 
                <span className="text-[7px] bg-accent-gold/10 text-accent-gold px-1.5 py-0.5 rounded border border-accent-gold/20 font-black uppercase">PRO</span>
              </h1>
              <span className="text-[9px] text-accent-gold font-bold uppercase tracking-[0.25em] mt-1 opacity-70">Institutional Terminal</span>
           </div>
           
           <div className="flex items-center gap-2 px-3 h-10 bg-bg-tertiary rounded-xl border border-border">
              <div className={`w-1.5 h-1.5 rounded-full ${status === 'Connected' ? 'bg-accent-green shadow-none animate-pulse' : 'bg-accent-red'}`}></div>
              <span className="text-[8px] font-black tracking-widest text-text-secondary uppercase whitespace-nowrap">{status}</span>
           </div>
        </div>
        
        <div className="flex items-center gap-4">

           {/* ADVANCED BALANCE CARD */}
           <div className="flex items-center gap-3 bg-bg-tertiary border border-border px-4 h-10 rounded-xl relative group overflow-hidden">
              <div className="flex flex-col relative z-10">
                 <span className="text-[6px] text-accent-gold font-black uppercase tracking-[0.2em] leading-none mb-1 opacity-80">Equity Balance</span>
                 <div className="flex items-center gap-1 leading-none">
                    <span className="text-[10px] text-text-secondary/60 font-bold font-mono">$</span>
                    <span className="text-sm font-black text-text-primary tabular-nums tracking-tighter">
                       {balance?.toLocaleString(undefined, {minimumFractionDigits: 2}) || '0.00'}
                    </span>
                 </div>
              </div>
           </div>

             {/* 1. AUTO-SCALP TOGGLE BUTTON */}
             <div className="relative">
                <button
                   onClick={() => setAutoScalpPopupOpen(!isAutoScalpPopupOpen)}
                   className={`w-10 h-10 rounded-xl border flex items-center justify-center cursor-pointer transition-all duration-300 active:scale-95 ${
                      isAutoScalpPopupOpen || isAutoScalpEnabled 
                      ? 'bg-bg-secondary border-accent-gold/50 text-accent-gold shadow-sm shadow-accent-gold/5' 
                      : 'bg-bg-tertiary border-border text-text-primary/80 hover:bg-bg-secondary hover:border-accent-gold/40 hover:text-accent-gold'
                   }`}
                   title="Auto-Scalp Quick Settings"
                >
                   <svg className={`w-5 h-5 ${isAutoScalpEnabled ? 'animate-pulse text-accent-gold' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 5h10a2 2 0 012 2v10a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2zM9 9h6v6H9V9z" />
                   </svg>
                </button>

                {/* Quick Settings Dropdown Popup */}
                {isAutoScalpPopupOpen && (
                   <>
                      <div 
                         className="fixed inset-0 z-40" 
                         onClick={() => setAutoScalpPopupOpen(false)}
                      ></div>
                      
                      <div className="absolute right-0 mt-2.5 w-64 bg-bg-secondary border border-border rounded-xl p-5 z-50 flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
                         <div className="flex flex-col">
                            <span className="text-[7px] text-accent-gold font-black uppercase tracking-[0.25em] mb-1">Quick Console</span>
                            <h4 className="text-xs font-black text-text-primary uppercase">Auto-Scalp Config</h4>
                         </div>
                         
                         {/* 1. Toggle Switch */}
                         <div className="flex items-center justify-between py-2.5 border-y border-border/50">
                            <span className="text-[10px] font-black text-text-primary uppercase">Engine Active</span>
                            <button 
                               onClick={handleHeaderAutoScalpToggle}
                               className={`w-9 h-5 rounded-full relative transition-colors duration-300 ${isAutoScalpEnabled ? 'bg-accent-green' : 'bg-text-secondary/20'}`}
                            >
                               <div 
                                  className="absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all duration-300"
                                  style={{ left: isAutoScalpEnabled ? '18px' : '2px' }}
                               ></div>
                            </button>
                         </div>
                         
                         {/* 2. Confidence Slider */}
                         <div className="space-y-2">
                            <div className="flex justify-between text-[9px] font-black uppercase text-text-secondary">
                               <span>Min Confidence</span>
                               <span className="text-accent-gold">{systemSettings?.min_confidence || 85}%</span>
                            </div>
                            <input 
                               type="range" 
                               min="50" 
                               max="95" 
                               value={systemSettings?.min_confidence || 85} 
                               onChange={(e) => {
                                  const val = parseInt(e.target.value);
                                  if (socket && socket.readyState === 1) {
                                     socket.send(JSON.stringify({ 
                                        action: 'set_auto_scalp', 
                                        enabled: isAutoScalpEnabled,
                                        minConfidence: val
                                     }));
                                  }
                               }}
                               className="w-full h-1 bg-white/5 rounded-lg appearance-none cursor-pointer accent-accent-gold"
                            />
                         </div>
                      </div>
                   </>
                )}
             </div>

             {/* 2. EXECUTION CONSOLE TOGGLE */}
             <button 
                onClick={() => setEngineOpen(!isEngineOpen)}
                className={`w-10 h-10 rounded-xl border flex items-center justify-center cursor-pointer transition-all duration-300 active:scale-95 ${
                   isEngineOpen 
                   ? 'bg-bg-secondary border-accent-gold/50 text-accent-gold shadow-sm shadow-accent-gold/5' 
                   : 'bg-bg-tertiary border-border text-text-primary/80 hover:bg-bg-secondary hover:border-accent-gold/40 hover:text-accent-gold'
                }`}
                title="Toggle Trade Drawer Console"
             >
                <svg className={`w-5 h-5 transition-transform duration-300 ${isEngineOpen ? 'text-accent-gold rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
             </button>

             {/* 3. THEME TOGGLE */}
             <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className={`w-10 h-10 rounded-xl border flex items-center justify-center cursor-pointer transition-all duration-300 active:scale-95 ${
                   theme === 'dark'
                   ? 'bg-bg-secondary border-accent-gold/50 text-accent-gold shadow-sm shadow-accent-gold/5'
                   : 'bg-bg-tertiary border-border text-text-primary/80 hover:bg-bg-secondary hover:border-accent-gold/40 hover:text-accent-gold'
                }`}
                title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
             >
                {theme === 'dark' ? (
                   <svg className="w-5 h-5 text-accent-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
                   </svg>
                ) : (
                   <svg className="w-5 h-5 text-accent-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                   </svg>
                )}
             </button>

             {/* 4. USER PROFILE & BRIDGE STATUS */}
             <div className="relative group">
                <button 
                   className={`w-10 h-10 rounded-xl border flex items-center justify-center cursor-pointer transition-all duration-300 active:scale-95 ${
                      status === 'Connected' 
                      ? 'bg-bg-secondary border-accent-gold/50 text-accent-gold shadow-sm shadow-accent-gold/5' 
                      : 'bg-bg-tertiary border-border text-text-primary/80 hover:bg-bg-secondary hover:border-accent-gold/40 hover:text-accent-gold'
                   }`}
                   title={`Bridge is ${status}`}
                >
                   <span className="text-[10px] font-black tracking-wider uppercase font-sans">AR</span>
                </button>
                <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-bg-secondary ${
                   status === 'Connected' ? 'bg-accent-green animate-pulse shadow-md shadow-accent-green/20' : 'bg-accent-red'
                }`}></div>
             </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
         
         {/* 2. LEFT NAVIGATION RAIL (TABS) - MINIMALIST ICON ONLY */}
         <nav className="w-16 bg-bg-secondary border-r border-border flex flex-col items-center py-8 gap-6 z-20">
            {navItems.map((item) => (
               <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  title={item.label}
                  className={`relative flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-all duration-300 group ${activeTab === item.id ? 'bg-accent-gold/10 text-accent-gold shadow-none' : 'text-text-secondary/40 hover:text-text-primary hover:bg-bg-tertiary/50'}`}
               >
                  <svg className={`w-6 h-6 ${activeTab === item.id ? 'scale-110' : 'group-hover:scale-110'} transition-transform duration-300`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                  </svg>
                  
                  {activeTab === item.id && (
                    <div className="absolute left-0 w-1 h-6 bg-accent-gold rounded-r-full shadow-none"></div>
                  )}
               </button>
            ))}
         </nav>

         {/* 3. MAIN CONTENT AREA */}
         <div className="flex-1 flex flex-col min-w-0 relative">
            


            {/* TAB CONTENT WITH DYNAMIC RENDERING */}
            <section className="flex-1 overflow-y-auto custom-scrollbar px-8 py-6 bg-bg-primary">
               <div className="max-w-[1600px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                  {activeTab === 'intelligence' && <LeadLagCanvas />}
                  {activeTab === 'terminal' && <SimpleGoldTerminal />}
                  {activeTab === 'history' && <HistoryPage />}
                  {activeTab === 'settings' && <SettingsPage />}
               </div>
            </section>

            {/* 4. SLIDEABLE EXECUTION ENGINE (RIGHT SIDE) */}
            <aside 
               className={`absolute top-0 right-0 h-full w-[360px] bg-bg-secondary/98 backdrop-blur-3xl border-l border-border z-30 transform transition-transform duration-700 cubic-bezier(0.19, 1, 0.22, 1) shadow-none ${isEngineOpen ? 'translate-x-0' : 'translate-x-full'}`}
            >
               <div className="p-8 space-y-8 h-full overflow-y-auto custom-scrollbar">
                  <div className="flex items-center justify-between">
                     <div className="flex flex-col">
                        <span className="text-[10px] text-accent-gold font-black uppercase tracking-[0.3em] mb-1">System Control</span>
                        <h2 className="text-sm font-black text-white uppercase italic tracking-widest">Execution Console</h2>
                     </div>
                     <button onClick={() => setEngineOpen(false)} className="p-2.5 hover:bg-white/5 rounded-xl text-white/20 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                     </button>
                  </div>
                  
                  {/* Compact Tab Switcher styled with soft theme */}
                  <div className="flex bg-bg-tertiary p-1 rounded-xl border border-border">
                     <button
                        onClick={() => setDrawerTab('live')}
                        className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${
                           drawerTab === 'live'
                           ? 'bg-bg-secondary text-accent-gold border border-border/40'
                           : 'text-text-secondary hover:text-text-primary'
                        }`}
                     >
                        Live Trades ({positions?.length || 0})
                     </button>
                     <button
                        onClick={() => setDrawerTab('history')}
                        className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${
                           drawerTab === 'history'
                           ? 'bg-bg-secondary text-accent-gold border border-border/40'
                           : 'text-text-secondary hover:text-text-primary'
                        }`}
                     >
                        Trade History ({historyLogs?.length || 0})
                     </button>
                  </div>

                  {/* Tab Panel Content */}
                  {drawerTab === 'live' && (
                     <div className="space-y-4 pt-2">
                        <div className="flex items-center justify-between">
                           <h3 className="text-[10px] font-black text-text-secondary uppercase tracking-[0.2em] italic">Active Exposure Monitor</h3>
                           <div className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse"></span>
                              <span className="text-[8px] font-black text-text-secondary uppercase tracking-widest">LIVE</span>
                           </div>
                        </div>
                        {(!positions || positions.length === 0) ? (
                           <div className="p-12 border border-dashed border-border/40 rounded-xl bg-bg-tertiary/10 text-center select-none">
                              <p className="text-[10px] text-text-secondary uppercase font-black tracking-[0.2em]">Zero Exposure Detected</p>
                           </div>
                        ) : (
                           positions.map(pos => (
                              <ProgressiveLockCard 
                                 key={pos.ticket} 
                                 position={pos} 
                                 lockState={lockStates?.[pos.ticket]} 
                              />
                           ))
                        )}
                     </div>
                  )}

                  {drawerTab === 'history' && (
                     <div className="space-y-3 pt-2">
                        <h3 className="text-[10px] font-black text-text-secondary uppercase tracking-[0.2em] italic mb-1">Recent Closed Logs</h3>
                        {(!historyLogs || historyLogs.length === 0) ? (
                           <div className="p-12 border border-dashed border-border/40 rounded-xl bg-bg-tertiary/10 text-center select-none">
                              <p className="text-[10px] text-text-secondary uppercase font-black tracking-[0.2em]">No Closed Trades</p>
                           </div>
                        ) : (
                           historyLogs.slice(0, 10).map(log => {
                              const isProfit = parseFloat(log.profit) >= 0;
                              return (
                                 <div key={log.ticket || log.id} className="p-4 bg-bg-tertiary/30 border border-border rounded-xl flex flex-col gap-2 hover:border-border/80 transition-colors">
                                    <div className="flex items-center justify-between">
                                       <div className="flex items-center gap-2">
                                          <span className="text-[10px] font-black text-text-primary tracking-tighter uppercase">{log.symbol}</span>
                                          <span className={`text-[7px] font-black px-1.5 py-0.5 rounded border uppercase ${
                                             log.type === 'buy' || log.type === 'BUY'
                                             ? 'bg-accent-green/10 border-accent-green/20 text-accent-green' 
                                             : 'bg-accent-red/10 border-accent-red/20 text-accent-red'
                                          }`}>{log.type}</span>
                                       </div>
                                       <span className={`text-xs font-black font-mono ${isProfit ? 'text-accent-green' : 'text-accent-red'}`}>
                                          {isProfit ? '+' : ''}${parseFloat(log.profit).toFixed(2)}
                                       </span>
                                    </div>
                                    <div className="flex items-center justify-between text-[8px] font-black text-text-secondary uppercase tracking-widest leading-none pt-1 border-t border-border/30">
                                       <span>Lots: {parseFloat(log.lots || log.volume || 0.01).toFixed(2)}</span>
                                       <span className="opacity-60">{log.close_time ? new Date(log.close_time).toLocaleTimeString() : 'Closed'}</span>
                                    </div>
                                 </div>
                              );
                           })
                        )}
                     </div>
                  )}
               </div>
            </aside>

            {/* OVERLAY for Execution Engine */}
            {isEngineOpen && (
               <div 
                  onClick={() => setEngineOpen(false)}
                  className="absolute inset-0 bg-black/40 backdrop-blur-[4px] z-20 transition-all duration-500 animate-in fade-in"
               ></div>
            )}
         </div>
      </div>

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(245, 166, 35, 0.2); border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(245, 166, 35, 0.4); }
        @keyframes slide-up { from { transform: translateY(10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
    </main>
  );
}
