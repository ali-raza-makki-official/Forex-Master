const fs = require('fs');
const content = fs.readFileSync('server/server.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, index) => {
  if (line.includes('was_correct')) {
    console.log(`Line ${index + 1}: ${line}`);
  }
});
