const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'components', 'LeadLagCanvas.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// Normalize line endings to LF
content = content.replace(/\r\n/g, '\n');

// 1. Update the destructuring line (Line 7)
const oldDestructure = `   const { prices, hftAnalytics, tradeStats, gapStats, atr, activePairs, leaderPair, signals, liveScore } = useWebSocket();`;
const newDestructure = `   const { prices, hftAnalytics, tradeStats, gapStats, atr, activePairs, leaderPair, signals, liveScore, systemSettings } = useWebSocket();`;

if (content.includes(oldDestructure)) {
    content = content.replace(oldDestructure, newDestructure);
    console.log("Successfully destructured systemSettings!");
} else {
    console.log("Destructure replace failed, attempting regex search...");
    const destructureRegex = /const\s+\{\s*prices,\s*hftAnalytics,\s*tradeStats,\s*gapStats,\s*atr,\s*activePairs,\s*leaderPair,\s*signals,\s*liveScore\s*\}\s*=\s*useWebSocket\(\);/;
    if (destructureRegex.test(content)) {
        content = content.replace(destructureRegex, newDestructure);
        console.log("Successfully destructured systemSettings via regex!");
    } else {
        console.log("Error: could not find destructuring line.");
    }
}

// 2. Perform the rest of the dynamic replacements inside the radar gauge
const oldRadarBlock = `                         {/* SUPPORTING METRICS - DENSE 3-COLUMN ROWS */}                         {/* HFT TRIGGER RADAR GAUGE (Slim & Transparent) */}
                          <div className="mt-3.5 space-y-2 animate-fade-in px-1">
                             <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider">
                                <span className="text-text-secondary flex items-center gap-1.5">
                                   <span className="animate-pulse">📡</span> Trade Trigger Radar
                                </span>
                                <span className={\`font-mono text-xs font-black \${
                                   !liveScore ? 'text-text-secondary/50' :
                                   (liveScore.score >= liveScore.threshold) ? 'text-accent-green animate-pulse' :
                                   (liveScore.score >= liveScore.threshold * 0.7) ? 'text-accent-gold' : 'text-text-secondary'
                                }\`}>
                                   {liveScore ? \`Score: \${liveScore.score}/\${liveScore.threshold}\` : 'WAITING FOR MOMENTUM...'}
                                </span>
                             </div>

                             {/* Dynamic Progress Bar (Slim h-1.5) */}
                             <div className="relative w-full h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                                {/* Required Threshold Indicator Dot */}
                                <div className="absolute top-0 bottom-0 w-1 bg-accent-gold opacity-80 left-[85%] z-10" title="Execution Threshold (85%)"></div>
                                
                                {/* Live Score Fill */}
                                <div 
                                   className={\`h-full rounded-full transition-all duration-500 ease-out \${
                                      !liveScore ? 'w-0' :
                                      (liveScore.score >= liveScore.threshold) ? 'bg-accent-green shadow-[0_0_12px_#10b981]' :
                                      (liveScore.score >= liveScore.threshold * 0.7) ? 'bg-accent-gold shadow-[0_0_12px_#f59e0b]' : 'bg-accent-blue opacity-60'
                                   }\`}
                                   style={{ 
                                      width: \`\${liveScore ? Math.min(100, (liveScore.score / (liveScore.threshold || 100)) * 100) : 0}%\` 
                                   }}
                                ></div>
                             </div>

                             {/* Slim Contextual Info & Status */}
                             <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-text-secondary/50 pt-0.5">
                                <div className="flex gap-3">
                                   <span>0% Idle</span>
                                   <span className="text-accent-gold">Threshold (85%)</span>
                                </div>
                                <span className={\`font-mono font-black \${
                                   !liveScore ? 'text-text-secondary/80' :
                                   (liveScore.score >= liveScore.threshold) ? 'text-accent-green' :
                                   (liveScore.score >= liveScore.threshold * 0.7) ? 'text-accent-gold' : 'text-text-secondary/70'
                                }\`}>
                                   {!liveScore ? 'SCANNING MARKETS...' :
                                    (liveScore.score >= liveScore.threshold) ? '⚡ READY!' :
                                    (liveScore.score >= liveScore.threshold * 0.7) ? '📈 MOMENTUM' :
                                    '⏳ LOW MOMENTUM'}
                                </span>
                             </div>
                          </div>`;

const newRadarBlock = `                         {/* SUPPORTING METRICS - DENSE 3-COLUMN ROWS */}                         {/* HFT TRIGGER RADAR GAUGE (Slim & Transparent) */}
                          <div className="mt-3.5 space-y-2 animate-fade-in px-1">
                             <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider">
                                <span className="text-text-secondary flex items-center gap-1.5">
                                   <span className="animate-pulse">📡</span> Trade Trigger Radar
                                </span>
                                <span className={\`font-mono text-xs font-black \${
                                   !liveScore ? 'text-text-secondary/50' :
                                   (liveScore.score >= liveScore.threshold) ? 'text-accent-green animate-pulse' :
                                   (liveScore.score >= liveScore.threshold * 0.7) ? 'text-accent-gold' : 'text-text-secondary'
                                }\`}>
                                   {liveScore 
                                      ? \`Score: \${liveScore.score}/\${liveScore.threshold} (\${Math.round((liveScore.score / (liveScore.threshold || 100)) * 100)}%)\` 
                                      : 'WAITING FOR MOMENTUM...'}
                                </span>
                             </div>

                             {/* Dynamic Progress Bar (Slim h-1.5) */}
                             <div className="relative w-full h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                                {/* Required Threshold Indicator Dot (Positioned Live based on Settings!) */}
                                <div 
                                   className="absolute top-0 bottom-0 w-1 bg-accent-gold opacity-80 z-10 transition-all duration-300" 
                                   style={{ left: \`\${systemSettings?.min_confidence || 85}%\` }}
                                   title={\`Execution Threshold (\${systemSettings?.min_confidence || 85}%)\`}
                                ></div>
                                
                                {/* Live Score Fill */}
                                <div 
                                   className={\`h-full rounded-full transition-all duration-500 ease-out \${
                                      !liveScore ? 'w-0' :
                                      (liveScore.score >= liveScore.threshold) ? 'bg-accent-green shadow-[0_0_12px_#10b981]' :
                                      (liveScore.score >= liveScore.threshold * 0.7) ? 'bg-accent-gold shadow-[0_0_12px_#f59e0b]' : 'bg-accent-blue opacity-60'
                                   }\`}
                                   style={{ 
                                      width: \`\${liveScore ? Math.min(100, (liveScore.score / (liveScore.threshold || 100)) * 100) : 0}%\` 
                                   }}
                                ></div>
                             </div>

                             {/* Slim Contextual Info & Status */}
                             <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-text-secondary/50 pt-0.5">
                                <div className="flex gap-3">
                                   <span>0% Idle</span>
                                   <span className="text-accent-gold">Threshold (\${systemSettings?.min_confidence || 85}%)</span>
                                </div>
                                <span className={\`font-mono font-black \${
                                   !liveScore ? 'text-text-secondary/80' :
                                   (liveScore.score >= liveScore.threshold) ? 'text-accent-green' :
                                   (liveScore.score >= liveScore.threshold * 0.7) ? 'text-accent-gold' : 'text-text-secondary/70'
                                }\`}>
                                   {!liveScore ? 'SCANNING MARKETS...' :
                                    (liveScore.score >= liveScore.threshold) ? '⚡ READY!' :
                                    (liveScore.score >= liveScore.threshold * 0.7) ? '📈 MOMENTUM' :
                                    '⏳ LOW MOMENTUM'}
                                </span>
                             </div>
                          </div>`;

// Replace ignoring carriage returns
const cleanContent = content.replace(/\r/g, '');
const cleanTarget = oldRadarBlock.replace(/\r/g, '');
const cleanReplacement = newRadarBlock.replace(/\r/g, '');

if (cleanContent.includes(cleanTarget)) {
    const index = cleanContent.indexOf(cleanTarget);
    const replaced = cleanContent.slice(0, index) + cleanReplacement + cleanContent.slice(index + cleanTarget.length);
    fs.writeFileSync(filePath, replaced, 'utf8');
    console.log("SUCCESS! Radar block successfully made dynamic.");
} else {
    console.log("Error: Radar block direct match failed. Retrying with loose space matching...");
    const escapedTarget = oldRadarBlock.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
                                      .replace(/\s+/g, '\\s+');
    const regex = new RegExp(escapedTarget);
    if (regex.test(content)) {
        content = content.replace(regex, newRadarBlock);
        fs.writeFileSync(filePath, content, 'utf8');
        console.log("SUCCESS! Made dynamic via regex.");
    } else {
        console.log("FATAL ERROR: Could not match radar block.");
    }
}
