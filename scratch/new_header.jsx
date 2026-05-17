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
