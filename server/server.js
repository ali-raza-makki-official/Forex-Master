require('dotenv').config({ path: '../.env.local' });

// ── ENVIRONMENT CONFIGURATION VALIDATION SHIELD ──
const fs = require('fs');
const path = require('path');
const envPath = path.resolve(__dirname, '../.env.local');

if (!fs.existsSync(envPath)) {
  console.warn(`[SERVER SETUP ⚠️] .env.local configuration file was not found at: ${envPath}. Falling back to default system values.`);
} else {
  console.log(`[SERVER SETUP 🟢] Configuration file successfully verified at: ${envPath}`);
}

if (!process.env.DATABASE_URL) {
  console.warn('[SERVER SETUP ⚠️] DATABASE_URL env variable is missing! Falling back to local default: mysql://root:@localhost:3306/gold_scalper');
}

const WebSocket = require('ws');
const http = require('http');
const { v4: uuidv4 } = require('uuid');

const { savePriceToDB, saveTradeLog } = require('./db');
const db = require('./db');
const { calculateATR } = require('./atr');
const { detectSignal } = require('./signalDetector');
const { checkAndUpdateLocks } = require('./progressiveLock');
const { onPriceTick } = require('./atrEngine');
const { startSpreadBroadcast } = require('./spreadMonitor');
const { initTelegram } = require('./telegramAlert');
const { getNewsStatus } = require('./newsFilter');
const { checkRiskSafety } = require('./riskGuard');
const { getActiveSessionName } = require('./sessionFilter');
const { getHistoryLogs, getSystemSettings } = require('./db');
const { startSelfTrainer } = require('./selfTrainer');
let cachedLeaderSymbol = 'XAUUSD';
db.getSystemSettings().then(settings => {
  if (settings && settings.leader_symbol) {
    cachedLeaderSymbol = settings.leader_symbol;
    console.log(`[SERVER] Leader symbol cached: ${cachedLeaderSymbol}`);
  }
}).catch(err => {
  console.warn('[SERVER] Failed to load initial leader symbol cache:', err.message);
});

const PORT = (process.env.PORT && process.env.PORT !== '3000' && process.env.PORT !== '3002') ? parseInt(process.env.PORT) : 3001;
const wss = new WebSocket.Server({ port: PORT });

// Separate WebSocket server for frontend on port 3002
const FRONTEND_PORT = process.env.FRONTEND_PORT || 3002;
const frontendWss = new WebSocket.Server({ port: FRONTEND_PORT });
const frontendClients = new Set();

frontendWss.on('connection', async (ws) => {
  frontendClients.add(ws);
  
  // Load saved settings from DB
  try {
    const settings = await getSystemSettings();
    if (settings) {
      let parsedLagging = [];
      try {
        if (settings.lagging_symbols) {
          if (settings.lagging_symbols.startsWith('[')) {
            parsedLagging = JSON.parse(settings.lagging_symbols);
          } else {
            parsedLagging = settings.lagging_symbols.split(',').map(s => ({ symbol: s, correlation: 'same', weight: 50 }));
          }
        }
      } catch(e) {}
      
      ws.send(JSON.stringify({ 
        event: 'architecture_sync', 
        leader: settings.leader_symbol,
        laggingPairs: parsedLagging
      }));
    }
  } catch (err) {
    console.error('[DB ERROR] Failed to load initial architecture:', err.message);
  }
  
  // Send current prices immediately on connect
  ws.send(JSON.stringify({ event: 'init', prices: livePrices }));

  // Send cached symbols for discovery if they exist
  if (cachedSymbols) {
    const count = cachedSymbols.split(',').length;
    console.log(`[SERVER] Sending ${count} cached symbols to new frontend connection.`);
    ws.send(JSON.stringify({ event: 'mt5_symbols', symbols: cachedSymbols }));
  } else {
    console.log('[SERVER] No cached symbols found for new frontend connection.');
  }
  
  // Handle messages from frontend
  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data);
      if (msg.event === 'update_architecture') {
        console.log('[SERVER] Architecture Update:', msg);
        
        // Persist to Database
        try {
          const pool = await db.getDB();
          await pool.execute(
            'UPDATE system_settings SET leader_symbol = ?, lagging_symbols = ? WHERE id = 1',
            [msg.leader, JSON.stringify(msg.laggingPairs || [])]
          );
          
          await pool.execute('DELETE FROM system_intelligence_pairs WHERE setting_id = 1');
          for (let p of (msg.laggingPairs || [])) {
            await pool.execute(
              'INSERT INTO system_intelligence_pairs (setting_id, symbol, correlation, weight) VALUES (1, ?, ?, ?)',
              [p.symbol, p.correlation || 'same', p.weight || 50]
            );
          }
          cachedLeaderSymbol = msg.leader;
          console.log('[SERVER] Architecture saved to DB and leader cached:', cachedLeaderSymbol);
        } catch (dbErr) {
          console.error('[DB ERROR] Failed to persist architecture:', dbErr.message);
        }

        if (getActiveMT5() && getActiveMT5().readyState === WebSocket.OPEN) {
          const lagSyms = (msg.laggingPairs || []).map(p => p.symbol);
          const allSymbolsToTrack = [msg.leader, ...lagSyms].join(',');
          getActiveMT5().send(JSON.stringify({
            action: 'set_symbols',
            symbols: allSymbolsToTrack
          }));
        }
      } else if (msg.action === 'trade') {
        // ── RATE LIMIT GUARD ──
        const now = Date.now();
        if (now - lastManualTradeTime < 2000) {
          console.warn('[SECURITY] 🛡️ Manual trade rate-limit hit. Rejecting execution.');
          ws.send(JSON.stringify({ event: 'trade_response', success: false, error: 'Rate limit exceeded: Please wait 2 seconds between orders.' }));
          return;
        }
        lastManualTradeTime = now;

        // ── EMERGENCY CONTROL CHECK ──
        if (!autoScalpEnabled) {
          console.warn('[SERVER] 🛡️ Trade Execution Blocked: System is halted / Emergency Stop is active (autoScalpEnabled = false).');
          broadcastToFrontend({
            event: 'trade_response',
            success: false,
            error: 'Trade Blocked: Emergency Stop is active'
          });
          return;
        }

        // ── INPUT VALIDATION & SANITIZATION ──
        const symbolRegex = /^[A-Z0-9.\-_/]{2,15}$/i;
        if (!msg.symbol || typeof msg.symbol !== 'string' || !symbolRegex.test(msg.symbol)) {
          console.warn(`[SECURITY WARN] 🛡️ Rejected trade attempt with malformed/unauthorized symbol: "${msg.symbol}"`);
          ws.send(JSON.stringify({ event: 'trade_response', success: false, error: 'Invalid trading symbol value' }));
          return;
        }

        executeTrade(msg.symbol, msg.type, msg.volume, msg.sl, msg.tp);
      } else if (msg.action === 'close') {
        closePosition(msg.ticket, msg.volume);
      } else if (msg.action === 'get_symbols') {
        if (getActiveMT5() && getActiveMT5().readyState === WebSocket.OPEN) {
          getActiveMT5().send(JSON.stringify({ action: 'get_all_symbols' }));
        }
      } else if (msg.action === 'set_auto_scalp') {
        autoScalpEnabled = !!msg.enabled;
        console.log(`[SERVER] Auto-Scalp changed to: ${autoScalpEnabled} (Min Confidence: ${msg.minConfidence}%)`);
        
        // Update in DB
        const conn = await db.getDB();
        await conn.execute(
          'UPDATE system_settings SET auto_scalp_enabled = ?, min_confidence = ?, updated_at = NOW() WHERE id = 1',
          [autoScalpEnabled ? 1 : 0, msg.minConfidence || 85]
        );

        broadcastToFrontend({ 
          event: 'hft_analytics', 
          systemSettings: { 
            auto_scalp_enabled: autoScalpEnabled,
            min_confidence: msg.minConfidence 
          } 
        });
      } else if (msg.action === 'emergency_stop') {
        autoScalpEnabled = false;
        // Close all open positions via MT5
        for (const pos of latestPositions) {
          getActiveMT5().send(JSON.stringify({
            action: 'close',
            id: uuidv4(),
            ticket: pos.id,
            volume: pos.volume
          }));
        }
        // Send Telegram alert
        const { sendRiskAlert } = require('./telegramAlert');
        sendRiskAlert('EMERGENCY STOP EXECUTED', 'All positions closed via terminal manual override.');
        broadcastToFrontend({ event: 'emergency_stop_confirmed' });
      } else if (msg.action === 'update_risk_settings') {
        const lotSize = parseFloat(msg.lot_size) || 0.01;
        const dailyLossLimit = parseFloat(msg.daily_loss_limit) || 50.0;
        const maxSpread = parseFloat(msg.max_spread) || 5.0;
        const newsBufferMins = parseInt(msg.news_buffer_mins) || 30;
        const sessionFilterEnabled = msg.session_filter_enabled !== undefined ? (msg.session_filter_enabled ? 1 : 0) : 1;

        const conn = await db.getDB();
        await conn.execute(
          'UPDATE system_settings SET lot_size = ?, daily_loss_limit = ?, max_spread = ?, news_buffer_mins = ?, session_filter_enabled = ?, updated_at = NOW() WHERE id = 1',
          [lotSize, dailyLossLimit, maxSpread, newsBufferMins, sessionFilterEnabled]
        );
        console.log(`[SERVER] Risk settings updated: Lot=${lotSize}, Limit=${dailyLossLimit}, Spread=${maxSpread}, NewsBuffer=${newsBufferMins}, SessionFilterEnabled=${sessionFilterEnabled}`);
        
        // Broadcast new settings to all connected frontend clients
        const updatedSettings = await db.getSystemSettings();
        broadcastToFrontend({
          event: 'hft_analytics',
          systemSettings: updatedSettings
        });
      }
    } catch(e) {
      console.error('[SERVER] Frontend message error:', e.message);
    }
  });
  
  ws.on('close', () => frontendClients.delete(ws));
});

function broadcastToFrontend(data) {
  const str = JSON.stringify(data);
  
  // Cache symbols if they are broadcasted
  if (data.event === 'mt5_symbols') cachedSymbols = data.symbols;

  for (const client of frontendClients) {
    if (client.readyState === WebSocket.OPEN) client.send(str);
  }
}


// Helper to handle positions closed outside the dashboard (TP/SL/MT5 Manual)
const closedTicketsInProgress = new Set();

async function handleExternalClosure(pos) {
  const ticketId = String(pos.id || pos.ticket);
  if (closedTicketsInProgress.has(ticketId)) return;
  closedTicketsInProgress.add(ticketId);
  
  setTimeout(() => {
    closedTicketsInProgress.delete(ticketId);
  }, 30000);

  try {
    const conn = await db.getDB();
    // Mark as closed. Since we don't have the final profit yet from heartbeat (it's gone),
    // we use the last known profit if available in the 'pos' object.
    await conn.execute(`
      UPDATE trade_log 
      SET closed_at = NOW(),
          profit = ?,
          close_price = ?
      WHERE ticket = ? AND closed_at IS NULL
    `, [pos.profit || 0, pos.price || 0, pos.id]);
    
    broadcastToFrontend({ 
      event: 'external_close', 
      ticket: pos.id, 
      symbol: pos.symbol,
      profit: pos.profit 
    });
  } catch (e) {
    console.error(`[SERVER] Error handling external closure for ${pos.id}:`, e.message);
  }
}

// Store latest prices in memory for ultra-fast access
const livePrices = {};
const priceHistory = {}; // Last 60 seconds of prices per symbol
let latestPositions = [];
let latestBalance = 0;
let autoScalpEnabled = true;
let lastManualTradeTime = 0;
const STATE_FILE = path.join(__dirname, 'daily_balance_state.json');

let startOfDayBalance = 0;
let lastBalanceResetDate = '';

try {
  if (fs.existsSync(STATE_FILE)) {
    const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    const today = new Date().toDateString();
    if (data.date === today) {
      startOfDayBalance = parseFloat(data.startOfDayBalance) || 0;
      lastBalanceResetDate = data.date || '';
      console.log(`[SERVER] Restored start-of-day balance from state file: $${startOfDayBalance} (Date: ${lastBalanceResetDate})`);
    } else {
      console.log(`[SERVER] Stale state file date (${data.date}) vs today (${today}). Initializing fresh daily balance.`);
    }
  }
} catch (err) {
  console.warn('[SERVER] Failed to load daily balance state file:', err.message);
}

let cachedSymbols = null; // Store for new frontend connections
const pendingTrades = new Map();
const lastTradeTime = new Map(); // Track last execution timestamp per symbol to prevent race conditions

// Clean up stale pending trade entries (older than 60 seconds) to prevent unbounded memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [id, val] of pendingTrades.entries()) {
    if (val && val.timestamp && now - val.timestamp > 60000) {
      if (val.timeoutId) clearTimeout(val.timeoutId);
      pendingTrades.delete(id);
      console.warn(`[SERVER] 🧹 Garbage Collector: Cleaned up stale trade transaction ID: ${id}`);
    }
  }
}, 30000);

// Periodically sync system settings from DB to in-memory cache every 10 seconds to prevent staleness
setInterval(async () => {
  try {
    const settings = await db.getSystemSettings();
    if (settings) {
      if (settings.leader_symbol && settings.leader_symbol !== cachedLeaderSymbol) {
        cachedLeaderSymbol = settings.leader_symbol;
        console.log(`[SERVER SYNC] Leader symbol dynamically refreshed from DB: ${cachedLeaderSymbol}`);
      }
      const dbAutoScalp = !!settings.auto_scalp_enabled;
      if (dbAutoScalp !== autoScalpEnabled) {
        autoScalpEnabled = dbAutoScalp;
        console.log(`[SERVER SYNC] Auto-Scalp status dynamically refreshed from DB: ${autoScalpEnabled}`);
      }
    }
  } catch (err) {
    console.error('[SERVER SYNC] Failed to sync settings from DB:', err.message);
  }
}, 10000);

// Run lock checker every 5 seconds with overlapping execution guard
let isProcessingLocks = false;
setInterval(async () => {
  if (isProcessingLocks) return;
  if (!getActiveMT5() || !latestPositions.length) return;
  
  isProcessingLocks = true;
  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Lock Checker execution timed out (4000ms)')), 4000)
    );
    await Promise.race([
      checkAndUpdateLocks(
        latestPositions,       // From latest heartbeat
        livePrices,            // Live bid/ask from MT5
        getActiveMT5(),        // WebSocket to MT5
        db,                    // MySQL connection
        broadcastToFrontend    // Broadcast function to notify frontend
      ),
      timeoutPromise
    ]);
  } catch (err) {
    console.error('[SERVER] Lock update failed:', err.message);
  } finally {
    isProcessingLocks = false;
  }
}, 5000);

// Broadcast HFT Analytics, Trade Stats & Gap Analytics from DB (Last 50,000 Records) every 10 seconds
// Fixed to have overlapping execution guard to prevent MySQL database hogging / connection pool timeouts
let isProcessingAnalytics = false;
setInterval(async () => {
  if (isProcessingAnalytics) return;
  isProcessingAnalytics = true;
  try {
    const analytics = await db.getHFTAnalytics();
    const tradeStats = await db.getTradeStats();
    const gapStats = await db.getGapAnalytics();
    const goldATR = await calculateATR('XAUUSD', 14);
    const startBalance = startOfDayBalance || latestBalance;
    const riskStatus = checkRiskSafety(tradeStats, latestBalance, startBalance);
    const sessionName = getActiveSessionName();
    const historyLogs = await getHistoryLogs();
    const systemSettings = await getSystemSettings();
    
    // Calculate Daily Stats
    const today = new Date().toISOString().split('T')[0];
    const todayTrades = historyLogs.filter(log => log.closed_at && log.closed_at.startsWith(today));
    const dailyPL = todayTrades.reduce((sum, t) => sum + parseFloat(t.profit || 0), 0);
    const winRate = todayTrades.length > 0 
      ? ((todayTrades.filter(t => parseFloat(t.profit) > 0).length / todayTrades.length) * 100).toFixed(1) 
      : 0;
    const maxDD = Math.max(0, ...todayTrades.map(t => Math.abs(parseFloat(t.drawdown || 0))));

    broadcastToFrontend({ 
      event: 'hft_analytics', 
      data: analytics,
      tradeStats: tradeStats,
      gapStats: gapStats,
      atr: goldATR,
      newsStatus: await getNewsStatus(),
      riskStatus: riskStatus,
      sessionName: sessionName,
      historyLogs: historyLogs,
      systemSettings: systemSettings,
      dailyStats: {
        tradesToday: todayTrades.length,
        winRate: winRate,
        dailyPL: dailyPL,
        drawdown: maxDD,
        limitReached: todayTrades.length >= 10 || dailyPL <= -50 // Example limit
      }
    });
  } catch (e) {
    console.error('[SERVER] Analytics error:', e.message);
  } finally {
    isProcessingAnalytics = false;
  }
}, 2000);

// Daily DB Pruning for HFT Table Bloat
setInterval(async () => {
  try {
    const pool = await db.getDB();
    // Prune price_data in chunks of 5000 rows to prevent table locking
    let rowsDeleted = 0;
    do {
      const [result] = await pool.execute(
        'DELETE FROM price_data WHERE timestamp < NOW() - INTERVAL 7 DAY LIMIT 5000'
      );
      rowsDeleted = result.affectedRows;
      if (rowsDeleted > 0) {
        // Yield execution to allow concurrent live price inserts
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    } while (rowsDeleted > 0);

    await pool.execute('DELETE FROM trade_log WHERE created_at < NOW() - INTERVAL 90 DAY');
    console.log('[SERVER] DB Pruning completed in non-blocking batches.');
  } catch (err) {
    console.error('[SERVER] DB Pruning error:', err.message);
  }
}, 24 * 60 * 60 * 1000); // 1 Day


// MT5 client reference
const mt5Clients = new Map();
let mt5ClientCounter = 0;
function getActiveMT5() {
  const primary = mt5Clients.get('primary');
  if (primary && primary.readyState === WebSocket.OPEN) return primary;
  const backup = mt5Clients.get('backup');
  if (backup && backup.readyState === WebSocket.OPEN) return backup;
  return null;
}

wss.on('connection', (ws, req) => {
  // ── SECURITY REINFORCEMENT: Token-Based Authentication ──
  const expectedToken = process.env.BRIDGE_AUTH_TOKEN || 'ForexMasterSecureToken2026';
  const urlParams = new URLSearchParams(req.url.split('?')[1]);
  const token = req.headers['authorization']?.split(' ')[1] || urlParams.get('token');
  
  if (expectedToken === 'ForexMasterSecureToken2026') {
    console.warn('[SECURITY WARNING] ⚠️ System is using the default weak token "ForexMasterSecureToken2026". For production safety, please define a strong custom BRIDGE_AUTH_TOKEN in your .env.local and update it in your MT5 Bridge inputs!');
  }

  if (token !== expectedToken) {
    console.warn(`[SERVER] 🛡️ Unauthorized MT5 Bridge connection attempt blocked from ${req.socket.remoteAddress}`);
    ws.close(4003, 'Unauthorized Connection');
    return;
  }

  console.log('[SERVER] MT5 Bridge Connected and Authenticated!');
  const clientId = mt5ClientCounter === 0 ? 'primary' : 'backup';
  mt5ClientCounter++;
  mt5Clients.set(clientId, ws);
  broadcastToFrontend({ event: 'mt5_status', status: 'Connected' });

  // Request all available symbols for discovery
  ws.send(JSON.stringify({
    action: 'get_all_symbols'
  }));

  // Auto-subscribe the MT5 bridge to the configured database symbols on startup/reconnect
  db.getSystemSettings().then(settings => {
    if (settings) {
      let parsedLagging = [];
      try {
        if (settings.lagging_symbols) {
          if (settings.lagging_symbols.startsWith('[')) {
            parsedLagging = JSON.parse(settings.lagging_symbols);
          } else {
            parsedLagging = settings.lagging_symbols.split(',').map(s => ({ symbol: s }));
          }
        }
      } catch(e) {}
      
      const lagSyms = parsedLagging.map(p => p.symbol || p);
      const allSymbolsToTrack = [settings.leader_symbol, ...lagSyms].filter(Boolean).join(',');
      
      if (allSymbolsToTrack) {
        ws.send(JSON.stringify({
          action: 'set_symbols',
          symbols: allSymbolsToTrack
        }));
        console.log(`[SERVER] MT5 subscription auto-initialized for: ${allSymbolsToTrack}`);
      }
    }
  }).catch(err => {
    console.error('[SERVER] Failed to auto-initialize MT5 symbol tracking:', err.message);
  });

  ws.on('message', async (data) => {
    try {
      // Validate incoming frame data format and size (DOS protection)
      if (typeof data !== 'string' && !Buffer.isBuffer(data)) {
        throw new Error('Unsupported binary websocket message format');
      }
      const dataStr = data.toString();
      if (dataStr.length > 100000) { // Enforce 100KB payload ceiling
        throw new Error('Websocket message size limit (100KB) exceeded');
      }
      
      const msg = JSON.parse(dataStr);
      await handleMT5Message(msg, ws);
    } catch(e) {
      console.error('[SERVER] Message processing error:', e.message);
      // Immediately disconnect client on malicious or corrupted payload
      ws.close(4000, 'Invalid message payload');
    }
  });

  ws.on('close', () => {
    console.log('[SERVER] MT5 Bridge Disconnected!');
    mt5Clients.delete(clientId);
    if (mt5ClientCounter > 0) mt5ClientCounter--;
    broadcastToFrontend({ event: 'mt5_status', status: 'Disconnected' });
  });
});

async function handleMT5Message(msg, ws) {
  if (msg.event === 'price_update') {
    if (!livePrices[msg.symbol]) {
      // First tick of the session acts as "Session Open"
      livePrices[msg.symbol] = {
        bid: msg.bid,
        ask: msg.ask,
        open: msg.bid,
        change: "0.00",
        time: Date.now()
      };
    } else {
      const open = livePrices[msg.symbol].open || msg.bid;
      const change = (((msg.bid - open) / open) * 100).toFixed(2);
      livePrices[msg.symbol] = {
        bid: msg.bid,
        ask: msg.ask,
        open: open,
        change: change,
        time: Date.now()
      };
    }
    
    if (!priceHistory[msg.symbol]) priceHistory[msg.symbol] = [];
    priceHistory[msg.symbol].push({ bid: msg.bid, ask: msg.ask, time: Date.now() });
    
    // Dynamic Time-Based Pruning: Keep last 2.5 minutes (150 seconds) of ticks
    const cutoff = Date.now() - (150 * 1000);
    priceHistory[msg.symbol] = priceHistory[msg.symbol].filter(p => p.time >= cutoff);
    
    await savePriceToDB(msg.symbol, msg.bid, msg.ask).catch(e => console.error("DB Error:", e));
    
    onPriceTick(msg.symbol, msg.bid, msg.ask);
    
    if (msg.symbol === cachedLeaderSymbol) {
      try {
        const signal = await detectSignal(livePrices, priceHistory, null, db, broadcastToFrontend);
        
        if (signal && autoScalpEnabled && signal.action === 'EXECUTE') {
          // ── COOLDOWN SHIELD: Prevent HFT Double Execution / Race Conditions ──
          const lastExecTime = lastTradeTime.get(cachedLeaderSymbol) || 0;
          if (Date.now() - lastExecTime < 10000) { // 10 seconds execution cooldown per symbol
            console.log(`[AUTO-SCALP] Cooldown active for ${cachedLeaderSymbol}. Skipping execution.`);
            return;
          }
          
          const hasPending = Array.from(pendingTrades.values()).some(t => t.symbol === cachedLeaderSymbol);
          if (hasPending) {
            console.log(`[AUTO-SCALP] Transaction already in progress for ${cachedLeaderSymbol}. Deferring execution.`);
            return;
          }

          const settings = await db.getSystemSettings();
          
          // ── RISK SHIELD: Dynamic Loss Limit & Daily Drawdown Block ──
          const tradeStats = await db.getTradeStats();
          const dailyLossLimit = parseFloat(settings.daily_loss_limit) || 50.0;
          const startBalance = startOfDayBalance || latestBalance;
          
          const risk = checkRiskSafety(tradeStats, latestBalance, startBalance, dailyLossLimit);
          
          if (risk.isBlocked) {
            console.log(`[RISK SHIELD] 🛡️ Trade Execution Blocked: ${risk.reason}`);
            const { sendRiskAlert } = require('./telegramAlert');
            await sendRiskAlert(risk.reason, `Balance: $${latestBalance} | StartOfDay: $${startBalance} | Limit: $${dailyLossLimit}`, db);
            try {
              const { sendWhatsAppRiskAlert } = require('./whatsappAlert');
              await sendWhatsAppRiskAlert(risk.reason, `Balance: $${latestBalance} | StartOfDay: $${startBalance} | Limit: $${dailyLossLimit}`);
            } catch (waErr) {
              console.error('[WHATSAPP] Risk alert trigger error:', waErr.message);
            }
            return;
          }

          // ── POSITION GUARD: Duplicate & Reversal Conflict Shield ──
          const symbol = cachedLeaderSymbol;
          const type = signal.type;
          
          // Check for duplicate trade (same direction)
          const duplicate = latestPositions.find(p => p.symbol === symbol && p.type === type);
          if (duplicate) {
            console.log(`[POSITION GUARD] 🛡️ Duplicate ${type} trade blocked for ${symbol}. Position #${duplicate.id || duplicate.ticket} already active.`);
            return;
          }

          // Check for opposite trade (reversal scenario)
          const opposite = latestPositions.find(p => p.symbol === symbol && p.type !== type);
          if (opposite) {
            console.log(`[POSITION GUARD] 🔄 Opposite trade detected! Reversing position. Closing active ${opposite.type} #${opposite.id || opposite.ticket} and deferring trade execution to next cycle.`);
            closePosition(opposite.id || opposite.ticket);
            return; // Don't execute the opposite trade in this tick, wait for next heartbeat cycle
          }

          const lotSize = parseFloat(settings.lot_size) || 0.01;
          
          console.log(`[AUTO-SCALP] Executing ${signal.type} | Volume: ${lotSize} | Score: ${signal.score}`);
          executeTrade(cachedLeaderSymbol, signal.type, lotSize, signal.sl, signal.tp);
        }
      } catch (err) {
        console.error('[SERVER] Signal detection / execution error:', err.message);
      }
    }
    
    broadcastToFrontend({ event: 'price_update', ...msg });
  }
  else if (msg.event === 'heartbeat') {
    const newPositions = Array.isArray(msg.positions) ? msg.positions : [];
    
    // Detect TP/SL or manual closures not triggered by the dashboard (with safety check)
    if (Array.isArray(latestPositions)) {
      for (const oldPos of latestPositions) {
        if (!oldPos || (!oldPos.id && !oldPos.ticket)) continue;
        const targetId = oldPos.id || oldPos.ticket;
        const exists = newPositions.find(p => p && String(p.id || p.ticket) === String(targetId));
        if (!exists) {
          console.log(`[SERVER] Position #${targetId} disappeared from heartbeat. Marking as closed.`);
          handleExternalClosure(oldPos).catch(e => console.error("Closure Handle Error:", e));
        }
      }
    }

    latestPositions = newPositions;
    latestBalance   = msg.balance;
    
    // Implement daily balance reset for correct daily drawdown and P/L calculations
    const today = new Date().toDateString();
    if (lastBalanceResetDate !== today && msg.balance) {
      startOfDayBalance = msg.balance;
      lastBalanceResetDate = today;
      console.log(`[SERVER] Daily start-of-day balance reset to: $${startOfDayBalance}`);
      try {
        fs.writeFileSync(STATE_FILE, JSON.stringify({
          startOfDayBalance,
          date: today
        }, null, 2));
      } catch (err) {
        console.error('[SERVER] Failed to persist daily balance state:', err.message);
      }
    }
    broadcastToFrontend({ event: 'heartbeat', ...msg });
  }
  else if (msg.event === 'trade_response') {
    let pending = null;
    // Clear safety timeout if transaction ID matches
    if (msg.id && pendingTrades.has(msg.id)) {
      pending = pendingTrades.get(msg.id);
      const tId = pending && pending.timeoutId ? pending.timeoutId : pending;
      clearTimeout(tId);
      pendingTrades.delete(msg.id);
    }
    
    broadcastToFrontend({ event: 'trade_response', ...msg });
    if (msg.success) {
      try {
        if (msg.is_close) {
          const conn = await db.getDB();
          
          // Fetch entry price and type to calculate precise pips gained and verify scalp signal
          const [trades] = await conn.execute('SELECT entry_price, trade_type, signal_id FROM trade_log WHERE ticket = ?', [msg.ticket]);
          if (trades && trades.length > 0) {
            const trade = trades[0];
            const entryPrice = parseFloat(trade.entry_price);
            const closePrice = parseFloat(msg.price);
            let pipsGained = 0;
            if (entryPrice && closePrice) {
              pipsGained = trade.trade_type === 'BUY' ? (closePrice - entryPrice) * 10 : (entryPrice - closePrice) * 10;
              pipsGained = parseFloat(pipsGained.toFixed(2));
            }
            
            await conn.execute(`
              UPDATE trade_log 
              SET close_price=?, profit=?, pips_gained=?, closed_at=NOW()
              WHERE ticket=?
            `, [msg.price, msg.profit || 0, pipsGained, msg.ticket]);
            console.log(`[SERVER] Trade Log Updated (Closed): Ticket ${msg.ticket}, Profit: ${msg.profit}, Pips: ${pipsGained}`);
            
            // If this trade was triggered by an algorithmic signal, verify it for the self trainer
            if (trade.signal_id) {
              const wasCorrect = (msg.profit || 0) > 0;
              await conn.execute(
                'UPDATE scalp_signals SET was_correct = ?, actual_result_pips = ? WHERE id = ?',
                [wasCorrect ? 1 : 0, pipsGained, trade.signal_id]
              );
              console.log(`[SERVER] 🎯 Scalp Signal Verified: ID ${trade.signal_id}, Correct: ${wasCorrect}, Pips: ${pipsGained}`);
            }
          } else {
            // Fallback update if entry details aren't found in trade log
            await conn.execute(`
              UPDATE trade_log 
              SET close_price=?, profit=?, closed_at=NOW()
              WHERE ticket=?
            `, [msg.price, msg.profit || 0, msg.ticket]);
            console.log(`[SERVER] Trade Log Updated (Closed - Fallback): Ticket ${msg.ticket}, Profit: ${msg.profit}`);
          }
        } else {
          // Populate missing parameters from pending trade cache if available
          if (pending) {
            msg.symbol = msg.symbol || pending.symbol;
            msg.type   = msg.type   || pending.type;
            msg.volume = msg.volume || pending.volume;
          }
          await saveTradeLog(msg);
          console.log(`[SERVER] Trade Log Created (Opened): Ticket ${msg.ticket}`);
        }
      } catch (e) {
        console.error("DB Trade Log Error:", e.message);
      }
    }
  }
  else if (msg.event === 'mt5_symbols') {
    const symbolCount = msg.symbols ? msg.symbols.split(',').length : 0;
    console.log(`[SERVER] Received ${symbolCount} symbols from MT5 bridge.`);
    broadcastToFrontend({ event: 'mt5_symbols', symbols: msg.symbols });
  }
}

function executeTrade(symbol, type, volume, sl, tp) {
  // Input Validation Shield
  if (!symbol || typeof symbol !== 'string') {
    throw new Error('Invalid trade symbol: ' + symbol);
  }
  if (!['BUY', 'SELL'].includes(type)) {
    throw new Error('Invalid trade type: ' + type);
  }
  if (typeof volume !== 'number' || volume <= 0) {
    throw new Error('Invalid trade volume: ' + volume);
  }
  if (sl !== undefined && sl !== null && (typeof sl !== 'number' || sl < 0)) {
    throw new Error('Invalid Stop Loss value: ' + sl);
  }
  if (tp !== undefined && tp !== null && (typeof tp !== 'number' || tp < 0)) {
    throw new Error('Invalid Take Profit value: ' + tp);
  }

  if (!getActiveMT5() || getActiveMT5().readyState !== WebSocket.OPEN) {
    return { success: false, error: 'MT5 not connected' };
  }
  
  const id = uuidv4();
  
  // Safety timeout: If no response in 15 seconds, reply failure to prevent frontend from hanging
  const timeoutId = setTimeout(() => {
    if (pendingTrades.has(id)) {
      console.warn(`[SERVER] ⚠️ Trade execution transaction timeout for ID: ${id}`);
      broadcastToFrontend({
        event: 'trade_response',
        id,
        success: false,
        error: 'MT5 Execution Timeout (15000ms)'
      });
      pendingTrades.delete(id);
    }
  }, 15000);
  
  pendingTrades.set(id, { timeoutId, timestamp: Date.now(), symbol, type, volume });
  lastTradeTime.set(symbol, Date.now());

  getActiveMT5().send(JSON.stringify({
    action: 'trade',
    id,
    symbol,
    type,
    volume,
    sl,
    tp
  }));
  
  return { success: true, id };
}

function closePosition(ticket, volume = 0) {
  if (!getActiveMT5() || getActiveMT5().readyState !== WebSocket.OPEN) return;
  getActiveMT5().send(JSON.stringify({
    action: 'close',
    id: uuidv4(),
    ticket,
    volume
  }));
}

console.log(`[SERVER] MT5 WebSocket listening on ws://localhost:${PORT}`);
console.log(`[SERVER] Frontend WebSocket listening on ws://localhost:${FRONTEND_PORT}`);

initTelegram();
startSpreadBroadcast(livePrices, db, broadcastToFrontend);
startSelfTrainer(broadcastToFrontend);

// Health Check HTTP Endpoint
const HEALTH_PORT = process.env.HEALTH_PORT || 3003;
const healthServer = http.createServer(async (req, res) => {
  if (req.url === '/health') {
    let dbStatus = 'error';
    try {
      await db.getDB();
      dbStatus = 'ok';
    } catch(e) {}
    
    // allow cors
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      mt5: (getActiveMT5() && getActiveMT5().readyState === WebSocket.OPEN) ? 'connected' : 'down',
      db: dbStatus,
      ws_clients: frontendClients.size,
      uptime: process.uptime()
    }));
  } else {
    res.writeHead(404);
    res.end();
  }
});
healthServer.listen(HEALTH_PORT, () => {
  console.log(`[SERVER] Health check endpoint listening on http://localhost:${HEALTH_PORT}/health`);
});

module.exports = { broadcastToFrontend };
