const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'components', 'LeadLagCanvas.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// Normalize line endings to LF for easier replacement
content = content.replace(/\r\n/g, '\n');

const targetStr = `                         {/* HFT TRIGGER RADAR GAUGE */}
                          <div className="mt-4 p-4 bg-black/45 border border-white/5 rounded-xl space-y-3 animate-fade-in">
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

                             {/* Dynamic Progress Bar */}
                             <div className="relative w-full h-2.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
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

                            {/* Contextual Sub-labels */}
                            <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-text-secondary/50">
                               <span>0% Idle</span>
                               <span className="text-accent-gold">Threshold (85%)</span>
                               <span>100% Signal</span>
                            </div>

                            {/* Contextual Status Box */}
                            <div className="pt-2 flex items-center justify-between border-t border-white/5 text-[9px] font-bold">
                               <span className="text-text-secondary">Radar Status</span>
                               <span className={\`font-black uppercase tracking-wider \${
                                  !liveScore ? 'text-text-secondary/80' :
                                  (liveScore.score >= liveScore.threshold) ? 'text-accent-green' :
                                  (liveScore.score >= liveScore.threshold * 0.7) ? 'text-accent-gold' : 'text-text-secondary/70'
                               }\`}>
                                  {!liveScore ? 'SCANNING MARKETS...' :
                                   (liveScore.score >= liveScore.threshold) ? '⚡ READY FOR EXECUTION!' :
                                   (liveScore.score >= liveScore.threshold * 0.7) ? '📈 MOMENTUM BUILDING (HIGH CONFIDENCE)' :
                                   '⏳ LOW MOMENTUM (WAITING FOR CONFIRMATION)'}
                               </span>
                            </div>
                         </div>`;

const replacementStr = `                         {/* HFT TRIGGER RADAR GAUGE (Slim & Transparent) */}
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

// Try to match ignoring flexible whitespaces and newlines
const normalizedTarget = targetStr.replace(/\s+/g, '');
const normalizedContent = content.replace(/\s+/g, '');

if (normalizedContent.includes(normalizedTarget)) {
    console.log("Target block found! Applying replacement...");
    
    // Fall back to line by line matching or flexible regex
    // Let's escape special regex characters in targetStr
    const escapedTarget = targetStr.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
                                   .replace(/\s+/g, '\\s+');
                                   
    const regex = new RegExp(escapedTarget);
    if (regex.test(content)) {
        content = content.replace(regex, replacementStr);
        fs.writeFileSync(filePath, content, 'utf8');
        console.log("SUCCESS! Replacement applied.");
    } else {
        console.log("Regex match failed, doing a direct string replace...");
        // Let's find index directly by stripping all CR
        const cleanContent = content.replace(/\r/g, '');
        const cleanTarget = targetStr.replace(/\r/g, '');
        const cleanReplacement = replacementStr.replace(/\r/g, '');
        if (cleanContent.includes(cleanTarget)) {
            const index = cleanContent.indexOf(cleanTarget);
            const replaced = cleanContent.slice(0, index) + cleanReplacement + cleanContent.slice(index + cleanTarget.length);
            fs.writeFileSync(filePath, replaced, 'utf8');
            console.log("SUCCESS! Direct clean replace applied.");
        } else {
            console.log("ERROR: Direct clean replace failed.");
        }
    }
} else {
    console.log("ERROR: Target block not found in normalized content.");
}
