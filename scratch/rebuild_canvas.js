const fs = require('fs');

const targetPath = 'c:\\Users\\Ali Raza Makki\\Desktop\\New folder\\gold-scalper\\components\\LeadLagCanvas.jsx';

const newHeaderPath = 'c:\\Users\\Ali Raza Makki\\Desktop\\New folder\\gold-scalper\\scratch\\new_header.jsx';
const newBenchmarkPath = 'c:\\Users\\Ali Raza Makki\\.gemini\\antigravity\\brain\\34e7999d-8e84-4de6-96d3-7ad1fd2a341a\\scratch\\new_benchmark.jsx';
const newMapPath = 'c:\\Users\\Ali Raza Makki\\.gemini\\antigravity\\brain\\34e7999d-8e84-4de6-96d3-7ad1fd2a341a\\scratch\\new_map.jsx';

// 1. Read first 126 lines
let canvasContent = fs.readFileSync(targetPath, 'utf8');
let lines = canvasContent.split(/\r?\n/);
const componentTop = lines.slice(0, 126).join('\n');

// 2. Read new unescaped components
const newHeader = fs.readFileSync(newHeaderPath, 'utf8');
const newBenchmark = fs.readFileSync(newBenchmarkPath, 'utf8');
const newMap = fs.readFileSync(newMapPath, 'utf8');

const finalCode = componentTop + "\n" +
"   return (\n" +
"      <div className=\"w-full h-full flex flex-col overflow-hidden relative\">\n\n" +
newHeader + "\n\n" +
"            <div className=\"flex-1 overflow-auto custom-scrollbar p-6\">\n" +
"               <div className=\"grid grid-cols-3 gap-6 pb-2\">\n\n" +
newBenchmark + "\n\n" +
"                 {[...activePairs].sort((a, b) => (b.weight || 50) - (a.weight || 50)).map((asset) => {\n" +
"                    const price = getLivePrice(asset.symbol);\n" +
"                    const stats = getAnalytics(asset.symbol);\n" +
"                    const history = ratioHistories[asset.symbol] || [];\n" +
"                    const avgRatio = history.length > 0 ? history.reduce((s, r) => s + r, 0) / history.length : 0;\n" +
"                    const currentRatio = goldPrice > 0 && price > 0 ? price / goldPrice : 0;\n\n" +
"                    // Compute dynamic gap and signals based on live moving ratio average\n" +
"                    const gap = avgRatio > 0 ? ((currentRatio - avgRatio) / avgRatio) * 100 : 0;\n" +
"                    const avgGap = avgRatio;\n\n" +
"                    // REAL-TIME SIGNAL LOGIC (Lead-Lag)\n" +
"                    let signal = `${leaderPair.symbol} WAIT`;\n" +
"                    let signalColor = 'text-yellow-500';\n" +
"                    let borderColor = 'border-yellow-500/20';\n" +
"                    let bgColor = 'bg-bg-secondary/60';\n\n" +
"                    const isInverse = asset.correlation === 'inverse';\n\n" +
"                    if (Math.abs(gap) > 0.005) {\n" +
"                       if (gap > 0) {\n" +
"                          signal = isInverse ? `${leaderPair.symbol} SELL` : `${leaderPair.symbol} BUY`;\n" +
"                          signalColor = isInverse ? 'text-accent-red' : 'text-accent-green';\n" +
"                          borderColor = isInverse ? 'border-accent-red/40' : 'border-accent-green/40';\n" +
"                       } else {\n" +
"                          signal = isInverse ? `${leaderPair.symbol} BUY` : `${leaderPair.symbol} SELL`;\n" +
"                          signalColor = isInverse ? 'text-accent-green' : 'text-accent-red';\n" +
"                          borderColor = isInverse ? 'border-accent-green/40' : 'border-accent-red/40';\n" +
"                       }\n" +
"                    }\n\n" +
newMap + "\n" +
"                 })}\n" +
"               </div>\n" +
"            </div>\n" +
"         </div>\n" +
"      </div>\n" +
"   );\n" +
"}\n";

fs.writeFileSync(targetPath, finalCode, 'utf8');
console.log('STATUS: SUCCESS - LeadLagCanvas.jsx completely rebuilt from clean, robust blocks!');
