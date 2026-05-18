import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Automatically spawn the backend Node.js server.js in the background when Next.js starts (skip during build phase)
const isBuildOrLint = 
  process.env.npm_lifecycle_event === 'build' || 
  process.env.npm_lifecycle_event === 'lint' ||
  process.argv.some(arg => arg.includes('build') || arg.includes('lint')) ||
  process.env.NEXT_PHASE === 'phase-production-build';
if (!process.env.BACKEND_SPAWNED && !isBuildOrLint) {
  process.env.BACKEND_SPAWNED = 'true';
  console.log('[SYSTEM STARTUP] 🚀 Auto-launching HFT Backend Server (server.js)...');
  
  const serverPath = path.join(__dirname, 'server', 'server.js');
  const child = spawn('node', [serverPath], {
    stdio: 'inherit',
    detached: false
  });

  // Handle cleanup on exit to kill child server process cleanly
  process.on('exit', () => {
    child.kill();
  });
}

/** @type {import('next').NextConfig} */
const nextConfig = {};

export default nextConfig;
