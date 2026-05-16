// server/signalDetector.js — MASTER INTEGRATION

const { getSessionStatus }            = require('./sessionFilter');
const { checkSpread }                 = require('./spreadMonitor');
const { getDynamicSLTP, getVolatilityLabel } = require('./atrEngine');
const { scoreSignal, getScoreDisplay }= require('./signalScorer');
const { sendSignalAlert }             = require('./telegramAlert');

const SCORE_INTERVAL = 500; // 500ms min gap
let lastScoreTime = 0;

async function detectSignal(livePrices, priceHistory, dbWeights, db, broadcastFn) {
  const now = Date.now();
  if (now - lastScoreTime < SCORE_INTERVAL) return;
  lastScoreTime = now;

  const gold = livePrices['XAUUSD'];
  if (!gold) return;

  // ── LAYER 1: Session filter ─────────────────────────────
  const session = await getSessionStatus();
  if (broadcastFn) broadcastFn({ event: 'session_status', ...session });

  if (!session.allowed) {
    console.log(`[SESSION] Blocked: ${session.reason}`);
    return;
  }

  // ── LAYER 2: Spread monitor ─────────────────────────────
  const spread = checkSpread('XAUUSD', gold.bid, gold.ask);
  if (broadcastFn) broadcastFn({ event: 'spread_status', ...spread });

  if (!spread.allowed) {
    console.log(`[SPREAD] Blocked: ${spread.reason}`);
    return;
  }

  // ── Calculate leader moves (last 2 minutes) ─────────────
  const settings = await db.getSystemSettings();
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

  if (parsedLagging.length === 0) return;

  const leaderMoves = {};
  const TWO_MIN = 2 * 60 * 1000;

  for (const pair of parsedLagging) {
    const leader = pair.symbol;
    const history = priceHistory[leader];
    const current = livePrices[leader];
    if (!history || !current) continue;

    const twoMinAgo = history.find(h => h.time >= Date.now() - TWO_MIN);
    if (!twoMinAgo) continue;

    leaderMoves[leader] = {
      move: ((current.bid - twoMinAgo.bid) / twoMinAgo.bid) * 100,
      correlation: pair.correlation || 'same',
      weight: pair.weight || 50
    };
  }

  if (Object.keys(leaderMoves).length === 0) return;

  // ── LAYER 4: Signal scorer ──────────────────────────────
  const score = scoreSignal(leaderMoves, dbWeights, settings.min_confidence || 85);
  if (broadcastFn) broadcastFn({ event: 'score_update', score, display: getScoreDisplay(score.score) });

  if (score.action === 'IGNORE') return;
  if (!score.direction) return;

  // ── LAYER 3: ATR-based SL/TP ────────────────────────────
  const sltp = getDynamicSLTP('XAUUSD', score.direction, gold.bid);
  const vol  = getVolatilityLabel(sltp.atrPips);

  // ── Build signal object ─────────────────────────────────
  const signal = {
    id:                   require('uuid').v4(),
    type:                 score.direction,
    goldPrice:            gold.bid,
    expectedPips:         sltp.tpPips,
    expectedDelayMinutes: getAvgLag(score.breakdown, dbWeights),
    confidence:           (score.score / 120 * 100).toFixed(1),
    score:                score.score,
    grade:                score.grade,
    action:               score.action,
    sl:                   sltp.sl,
    tp:                   sltp.tp,
    slPips:               sltp.slPips,
    tpPips:               sltp.tpPips,
    atr:                  sltp.atr,
    atrPips:              sltp.atrPips,
    volatility:           vol.label,
    spread:               spread.pips,
    session:              session.session,
    newsWarning:          session.newsWarn || null,
    timestamp:            Date.now()
  };

  // ── Save to DB ──────────────────────────────────────────
  try {
    const conn = await db.getDB();
    await conn.execute(`
      INSERT INTO scalp_signals
      (signal_type, trigger_pair, gold_price_at_signal, expected_move_pips,
       expected_delay_minutes, confidence_score, created_at)
      VALUES (?, ?, ?, ?, ?, ?, NOW())
    `, [signal.type, JSON.stringify(Object.keys(score.breakdown).filter(k => score.breakdown[k].confirmed)),
        signal.goldPrice, signal.expectedPips, signal.expectedDelayMinutes, signal.confidence]);
  } catch(e) {
    console.error("[DB] Signal save error:", e.message);
  }

  // ── LAYER 5: Telegram alert ─────────────────────────────
  await sendSignalAlert(signal, sltp, score, session);

  // ── Broadcast to frontend ───────────────────────────────
  if (broadcastFn) broadcastFn({ event: 'new_signal', signal });

  console.log(`[SIGNAL] ${signal.type} | Score: ${score.score} | ${score.grade} | ATR: ${sltp.atrPips} pips | Spread: ${spread.pips} pips`);
  
  return signal;
}

function getAvgLag(breakdown, dbWeights) {
  const confirmed = Object.keys(breakdown).filter(k => breakdown[k].confirmed);
  if (!confirmed.length) return 5;
  const lags = confirmed.map(pair => {
    const w = dbWeights ? dbWeights.find(d => d.pair === pair) : null;
    return w ? parseFloat(w.avg_lag_minutes) : 5;
  });
  return parseFloat((lags.reduce((a, b) => a + b, 0) / lags.length).toFixed(1));
}

module.exports = { detectSignal };
