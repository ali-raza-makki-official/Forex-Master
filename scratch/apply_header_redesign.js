const fs = require('fs');
const path = require('path');

const targetPath = 'c:\\Users\\Ali Raza Makki\\Desktop\\New folder\\gold-scalper\\components\\LeadLagCanvas.jsx';
const scratchDir = 'c:\\Users\\Ali Raza Makki\\Desktop\\New folder\\gold-scalper\\scratch';

let canvasContent = fs.readFileSync(targetPath, 'utf8');
const newHeader = fs.readFileSync(path.join(scratchDir, 'new_header.jsx'), 'utf8');

let lines = canvasContent.split(/\r?\n/);

console.log('Original canvas lines count:', lines.length);

// Verify boundary lines for absolute precision
console.log('Line 128 (index 127):', lines[127]);
console.log('Line 129 (index 128):', lines[128]);
console.log('Line 195 (index 194):', lines[194]);
console.log('Line 196 (index 195):', lines[195]);

const cleanedLines = [
   ...lines.slice(0, 128),
   newHeader,
   ...lines.slice(195)
];

fs.writeFileSync(targetPath, cleanedLines.join('\n'), 'utf8');
console.log('STATUS: SUCCESS - LeadLagCanvas.jsx header redesigned with Bloomberg aesthetics!');
