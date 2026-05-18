const fs = require('fs');
const path = require('path');

const nextDir = path.join(__dirname, '..', '.next');
if (fs.existsSync(nextDir)) {
  console.log('[CLEANER] Found .next cache directory. Deleting...');
  fs.rmSync(nextDir, { recursive: true, force: true });
  console.log('[CLEANER] Successfully deleted .next cache! Restart your dev server to compile fresh.');
} else {
  console.log('[CLEANER] No .next directory found.');
}
