const fs = require('fs');
const content = fs.readFileSync('server/server.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, index) => {
  if (line.includes('UPDATE trade_log')) {
    console.log(`Line ${index + 1}: ${line}`);
  }
});
