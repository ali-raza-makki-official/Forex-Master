'use client'; // Main Dashboard Page
import { useState } from 'react';
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
  const { status, prices, positions, lockStates, balance } = useWebSocket();
  const [activeTab, setActiveTab] = useState('intelligence');
  const [isEngineOpen, setEngineOpen] = useState(false);
  
  const navItems = [
    { id: 'intelligence', label: 'Intelligence', icon: 'M13 10V3L4 14h7v7l9-11h-7z' }, // Bolt icon for Intel
    { id: 'terminal', label: 'Terminal', icon: 'M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { id: 'history', label: 'History', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
    { id: 'settings', label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' }
  ];
  
  return (
    <main className="flex flex-col h-screen bg-bg-primary text-text-primary selection:bg-accent-gold/30 overflow-hidden relative font-sans">
      
      {/* 1. TOP HEADER */}
      <header className="flex justify-between items-center px-6 h-16 bg-bg-secondary border-b border-border z-30 shadow-xl shadow-black/20">
        <div className="flex items-center gap-5">
           <div className="group relative">
              <div className="absolute -inset-1 bg-accent-gold rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
              <div className="relative w-10 h-10 bg-gradient-to-br from-accent-gold to-yellow-600 rounded-xl flex items-center justify-center shadow-lg shadow-accent-gold/20 cursor-pointer hover:scale-105 active:scale-95 transition-all">
                 <span className="text-black text-2xl font-black italic">X</span>
              </div>
           </div>
           
           <div className="flex flex-col">
              <h1 className="text-sm font-black tracking-tighter leading-none text-white flex items-center gap-1.5">
                GOLD SCALPER 
                <span className="text-[7px] bg-accent-gold/10 text-accent-gold px-1.5 py-0.5 rounded border border-accent-gold/20 font-black uppercase">PRO</span>
              </h1>
              <span className="text-[9px] text-accent-gold font-bold uppercase tracking-[0.25em] mt-1 opacity-70">Institutional Terminal</span>
           </div>
           
           <div className="flex items-center gap-2 px-3 h-10 bg-white/5 rounded-xl border border-white/10">
              <div className={`w-1.5 h-1.5 rounded-full ${status === 'Connected' ? 'bg-accent-green shadow-[0_0_8px_rgba(0,212,168,0.6)] animate-pulse' : 'bg-accent-red'}`}></div>
              <span className="text-[8px] font-black tracking-widest text-text-secondary uppercase whitespace-nowrap">{status}</span>
           </div>
        </div>
        
        <div className="flex items-center gap-4">

           {/* ADVANCED BALANCE CARD */}
           <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-4 h-10 rounded-xl relative group overflow-hidden">
              <div className="flex flex-col relative z-10">
                 <span className="text-[6px] text-accent-gold font-black uppercase tracking-[0.2em] leading-none mb-1 opacity-80">Equity Balance</span>
                 <div className="flex items-center gap-1 leading-none">
                    <span className="text-[10px] text-white/40 font-bold font-mono">$</span>
                    <span className="text-sm font-black text-white tabular-nums tracking-tighter">
                       {balance?.toLocaleString(undefined, {minimumFractionDigits: 2}) || '0.00'}
                    </span>
                 </div>
              </div>
           </div>

           {/* Execution Engine Toggle (Main Entry) */}
           <button 
              onClick={() => setEngineOpen(!isEngineOpen)}
              className={`flex items-center gap-2.5 px-5 h-10 rounded-xl border transition-all duration-500 group ${isEngineOpen ? 'bg-accent-gold text-black border-accent-gold shadow-[0_0_20px_rgba(245,166,35,0.3)]' : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:border-white/20'}`}
           >
              <div className="flex flex-col items-start">
                 <span className={`text-[8px] font-black uppercase tracking-widest leading-none mb-0.5 ${isEngineOpen ? 'text-black' : 'text-accent-gold'}`}>Auto-Scalp</span>
                 <span className="text-[10px] font-black uppercase leading-none">Execution Console</span>
              </div>
              <svg className={`w-4 h-4 transition-transform duration-500 ${isEngineOpen ? 'rotate-180' : 'group-hover:translate-y-0.5'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
           </button>

           <div className="relative group">
              <div className="absolute inset-0 bg-accent-gold rounded-xl blur-[2px] opacity-0 group-hover:opacity-20 transition-opacity"></div>
              <div className="relative w-10 h-10 rounded-xl bg-bg-tertiary border border-white/10 flex items-center justify-center cursor-pointer group-hover:border-accent-gold/40 transition-all active:scale-95">
                 <span className="text-[10px] font-black text-accent-gold uppercase group-hover:text-white transition-colors">AR</span>
              </div>
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-accent-green rounded-full border-2 border-bg-secondary"></div>
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
                  className={`relative flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-all duration-300 group ${activeTab === item.id ? 'bg-accent-gold/10 text-accent-gold shadow-[inset_0_0_12px_rgba(245,166,35,0.05)]' : 'text-white/20 hover:text-white/80 hover:bg-white/5'}`}
               >
                  <svg className={`w-6 h-6 ${activeTab === item.id ? 'scale-110' : 'group-hover:scale-110'} transition-transform duration-300`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                  </svg>
                  
                  {activeTab === item.id && (
                    <div className="absolute left-0 w-1 h-6 bg-accent-gold rounded-r-full shadow-[2px_0_12px_rgba(245,166,35,0.6)]"></div>
                  )}
               </button>
            ))}
         </nav>

         {/* 3. MAIN CONTENT AREA */}
         <div className="flex-1 flex flex-col min-w-0 relative">
            
            {/* Global Price Ribbon (Ticker) - Moved to Right */}
            <div className="bg-bg-secondary/40 border-b border-white/5 backdrop-blur-sm flex justify-end overflow-hidden">
               <LivePriceTicker />
            </div>

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
               className={`absolute top-0 right-0 h-full w-[360px] bg-bg-secondary/98 backdrop-blur-3xl border-l border-border z-30 transform transition-transform duration-700 cubic-bezier(0.19, 1, 0.22, 1) shadow-[-30px_0_60px_rgba(0,0,0,0.7)] ${isEngineOpen ? 'translate-x-0' : 'translate-x-full'}`}
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
                  
                  <AutoScalpSettings />

                  <div className="pt-8 border-t border-white/5">
                     <div className="flex items-center justify-between mb-4">
                        <h2 className="text-[10px] font-black text-text-secondary uppercase tracking-[0.2em] italic">Live Signal Stream</h2>
                        <div className="w-1.5 h-1.5 rounded-full bg-accent-gold animate-ping"></div>
                     </div>
                     <SignalCard />
                  </div>
                  
                  <div className="pt-8 border-t border-white/5 pb-12">
                     <h2 className="text-[10px] font-black text-text-secondary uppercase tracking-[0.2em] mb-5 italic">Active Exposure Monitor</h2>
                     <div className="space-y-4">
                        {(!positions || positions.length === 0) ? (
                           <div className="p-12 border-2 border-dashed border-white/[0.03] rounded-3xl bg-white/[0.01] text-center">
                              <p className="text-[10px] text-white/30 uppercase font-black tracking-[0.2em]">Zero Exposure Detected</p>
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
                  </div>
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
