// ============================================================
// GOLD SCALPING SYSTEM — HISTORICAL BACKTESTING ENGINE
// Chalao: node server/backtest.js
// ============================================================

const mysql = require('mysql2/promise');
require('dotenv').config({ path: '../.env.local' });

// ── Config ───────────────────────────────────────────────────
const BACKTEST_CONFIG = {
  startDate:        '2024-11-01',   // 6 mahine pehle
  endDate:          '2025-05-16',   // aaj tak
  slippage_pips:    2.5,            // realistic Exness slippage
  spread_pips:      3.0,            // avg Gold spread
  lot_size:         0.01,           // micro lot
  pip_value_usd:    0.10,           // Gold: 0.01 lot = $0.10/pip
  min_confidence:   70,             // signal threshold
  gap_multiplier:   1.0,            // avg_diff se kitna upar = signal
};

// ── Leader weights (starting defaults, self-trainer baad mein badlega) ──
let WEIGHTS = {
  DXY:    { points: 40, min_move_pct: 0.15, lag_minutes: 5  },
  US10Y:  { points: 35, min_move_pct: 0.10, lag_minutes: 3  },
  SPX500: { points: 25, min_move_pct: 0.20, lag_minutes: 8  },
};

// ── Results tracker ──────────────────────────────────────────
const results = {
  total_signals:   0,
  strong_signals:  0,   // score >= 80
  weak_signals:    0,   // score < 80, skipped
  trades_taken:    0,
  wins:            0,
  losses:          0,
  breakeven:       0,
  total_pips:      0,
  total_usd:       0,
  max_drawdown:    0,
  max_streak_win:  0,
  max_streak_loss: 0,
  monthly:         {},  // breakdown per month
  weekly_weights:  [],  // weight recalibrations
  fake_signals:    [],  // where system was wrong
  slippage_cost:   0,
  spread_cost:     0,
};

async function runBacktest() {
  console.log('\n═══════════════════════════════════════════');
  console.log('  GOLD SCALPING BACKTEST ENGINE');
  console.log(`  Period: ${BACKTEST_CONFIG.startDate} → ${BACKTEST_CONFIG.endDate}`);
  console.log(`  Slippage: ${BACKTEST_CONFIG.slippage_pips} pips | Spread: ${BACKTEST_CONFIG.spread_pips} pips`);
  console.log('═══════════════════════════════════════════\n');

  const db = await mysql.createPool(
    process.env.DATABASE_URL 
      ? {
          uri: process.env.DATABASE_URL,
          waitForConnections: true,
          connectionLimit: 5,
        }
      : {
          host: process.env.DB_HOST || 'localhost',
          user: process.env.DB_USER || 'root',
          password: process.env.DB_PASSWORD || '',
          database: process.env.DB_NAME || 'gold_scalper',
          waitForConnections: true,
          connectionLimit: 5,
        }
  );

  // ── Step 1: Load all price data ──────────────────────────
  console.log('[STEP 1] Loading historical price data...');
  const [rows] = await db.execute(`
    SELECT symbol, bid, ask, timestamp
    FROM price_data
    WHERE timestamp BETWEEN ? AND ?
    ORDER BY timestamp ASC
  `, [BACKTEST_CONFIG.startDate, BACKTEST_CONFIG.endDate]);

  if (rows.length < 1000) {
    console.error(`[ERROR] Only ${rows.length} records found. Need at least 1000 to backtest.`);
    await db.end();
    process.exit(1);
  }
  console.log(`[OK] Loaded ${rows.length.toLocaleString()} price records.\n`);

  // ── Organize by symbol ───────────────────────────────────
  const bySymbol = {};
  for (const row of rows) {
    if (!bySymbol[row.symbol]) bySymbol[row.symbol] = [];
    bySymbol[row.symbol].push({
      price: (parseFloat(row.bid) + parseFloat(row.ask)) / 2,
      bid:   parseFloat(row.bid),
      ask:   parseFloat(row.ask),
      time:  new Date(row.timestamp).getTime(),
    });
  }

  // Handle Exness suffixes
  const goldKey = Object.keys(bySymbol).find(k => k.startsWith('XAUUSD'));
  const goldData = bySymbol[goldKey];
  
  if (!goldData || goldData.length < 100) {
    console.error('[ERROR] Not enough XAUUSD data. Check symbol name in price_data table.');
    await db.end();
    process.exit(1);
  }

  // ── Step 2: Weekly weight recalibration setup ────────────
  console.log('[STEP 2] Preparing weekly weight recalibration windows...');
  const weeks = getWeekBoundaries(BACKTEST_CONFIG.startDate, BACKTEST_CONFIG.endDate);
  console.log(`[OK] ${weeks.length} weekly windows prepared.\n`);

  // ── Step 3: Simulate week by week ───────────────────────
  console.log('[STEP 3] Running simulation...\n');

  let runningBalance     = 0;
  let peakBalance        = 0;
  let currentDrawdown    = 0;
  let streakWin          = 0;
  let streakLoss         = 0;
  let currentStreakWin   = 0;
  let currentStreakLoss  = 0;

  for (const week of weeks) {
    // Recalibrate weights using data BEFORE this week
    const newWeights = recalibrateWeights(bySymbol, week.start, rows);
    if (newWeights) {
      WEIGHTS = newWeights;
      results.weekly_weights.push({
        week:  week.label,
        weights: { ...newWeights }
      });
    }

    // Get gold ticks for this week
    const weekGold = goldData.filter(
      g => g.time >= week.start && g.time < week.end
    );

    // Simulate each gold tick
    for (let i = 50; i < weekGold.length; i++) {
      const tick = weekGold[i];

      // Check session (London + NY only in UTC)
      if (!isGoodSession(tick.time)) continue;

      // Check news window (hardcoded major events)
      if (isNewsWindow(tick.time)) continue;

      // Check spread
      const spread = (tick.ask - tick.bid) * 10;
      if (spread > 5) continue;

      // Calculate leader moves (last 2 minutes)
      const leaderMoves = {};
      for (const leader of ['DXY', 'US10Y', 'SPX500']) {
        const lData = findLeaderData(bySymbol, leader);
        if (!lData) continue;
        const move = getLeaderMove2Min(lData, tick.time);
        if (move !== null) leaderMoves[leader] = move;
      }

      if (Object.keys(leaderMoves).length === 0) continue;

      // Score signal
      const signal = scoreSignal(leaderMoves);
      if (!signal) continue;

      results.total_signals++;

      if (signal.score < BACKTEST_CONFIG.min_confidence) {
        results.weak_signals++;
        continue;
      }

      results.strong_signals++;
      results.trades_taken++;

      // Simulate trade with slippage
      const totalCost = BACKTEST_CONFIG.slippage_pips + BACKTEST_CONFIG.spread_pips;
      results.slippage_cost += BACKTEST_CONFIG.slippage_pips * BACKTEST_CONFIG.pip_value_usd;
      results.spread_cost   += BACKTEST_CONFIG.spread_pips   * BACKTEST_CONFIG.pip_value_usd;

      // ATR-based TP/SL (simplified: use rolling 14-candle ATR)
      const atr   = calcATR(weekGold, i);
      const slPips = Math.max(6, atr * 10 * 1.0);
      const tpPips = slPips * 1.5;

      // Look forward to see if TP or SL was hit first
      const outcome = simulateTrade(
        weekGold, i, signal.direction,
        tick.bid, tick.ask,
        slPips, tpPips
      );

      // Month bucket
      const monthKey = new Date(tick.time).toISOString().slice(0, 7);
      if (!results.monthly[monthKey]) {
        results.monthly[monthKey] = { trades: 0, wins: 0, losses: 0, pips: 0 };
      }

      if (outcome === 'WIN') {
        const pips = tpPips - totalCost;
        results.wins++;
        results.total_pips += pips;
        results.total_usd  += pips * BACKTEST_CONFIG.pip_value_usd;
        runningBalance     += pips * BACKTEST_CONFIG.pip_value_usd;
        results.monthly[monthKey].wins++;
        results.monthly[monthKey].pips += pips;
        currentStreakWin++;
        currentStreakLoss = 0;
        streakWin = Math.max(streakWin, currentStreakWin);

      } else if (outcome === 'LOSS') {
        const pips = -(slPips + totalCost);
        results.losses++;
        results.total_pips += pips;
        results.total_usd  += pips * BACKTEST_CONFIG.pip_value_usd;
        runningBalance     += pips * BACKTEST_CONFIG.pip_value_usd;
        results.monthly[monthKey].losses++;
        results.monthly[monthKey].pips += pips;
        results.fake_signals.push({
          time:      new Date(tick.time).toISOString(),
          direction: signal.direction,
          trigger:   signal.mainTrigger,
          lostPips:  (slPips + totalCost).toFixed(1),
          score:     signal.score,
        });
        currentStreakLoss++;
        currentStreakWin  = 0;
        streakLoss = Math.max(streakLoss, currentStreakLoss);

      } else {
        results.breakeven++;
        results.monthly[monthKey].pips += 0;
      }

      results.monthly[monthKey].trades++;

      // Track drawdown
      peakBalance    = Math.max(peakBalance, runningBalance);
      currentDrawdown = peakBalance - runningBalance;
      results.max_drawdown = Math.max(results.max_drawdown, currentDrawdown);
    }

    process.stdout.write(`  Week ${week.label} done — Balance: $${runningBalance.toFixed(2)}\r`);
  }

  results.max_streak_win  = streakWin;
  results.max_streak_loss = streakLoss;

  await db.end();
  printReport(results, runningBalance);
}

// ── Helper: Score signal same as live system ─────────────────
function scoreSignal(leaderMoves) {
  let score = 0;
  let direction = null;
  let mainTrigger = null;
  let confirmations = 0;

  for (const [pair, move] of Object.entries(leaderMoves)) {
    const w = WEIGHTS[pair];
    if (!w || Math.abs(move) < w.min_move_pct) continue;

    const implied = move > 0 ? 'SELL' : 'BUY'; // INVERSE correlation
    if (direction && implied !== direction) return null; // conflict

    direction = implied;
    score += w.points;
    confirmations++;
    if (!mainTrigger || Math.abs(move) > Math.abs(leaderMoves[mainTrigger] || 0)) {
      mainTrigger = pair;
    }
  }

  if (confirmations === 3) score += 20;
  if (!direction || score < 50) return null;

  return { score, direction, mainTrigger, confirmations };
}

// ── Helper: Simulate trade outcome ───────────────────────────
function simulateTrade(goldData, startIdx, direction, bid, ask, slPips, tpPips) {
  const entry   = direction === 'BUY' ? ask : bid;
  const tp      = direction === 'BUY' ? entry + tpPips / 10 : entry - tpPips / 10;
  const sl      = direction === 'BUY' ? entry - slPips / 10 : entry + slPips / 10;
  const maxBars = Math.min(60, goldData.length - startIdx - 1); // max 60 ticks forward

  for (let j = 1; j <= maxBars; j++) {
    const future = goldData[startIdx + j];
    if (!future) break;

    if (direction === 'BUY') {
      if (future.ask >= tp) return 'WIN';
      if (future.bid <= sl) return 'LOSS';
    } else {
      if (future.bid <= tp) return 'WIN';
      if (future.ask >= sl) return 'LOSS';
    }
  }
  return 'BREAKEVEN'; // neither hit in time
}

// ── Helper: Calculate ATR from last 14 ticks ─────────────────
function calcATR(data, idx) {
  if (idx < 1) return null;
  const period = Math.min(14, idx);
  let trSum = 0;
  for (let i = 1; i <= period; i++) {
    const startIdx = idx - i;
    if (startIdx < 0) break;
    const curr = data[idx - i + 1];
    const prev = data[startIdx];
    if (!curr || !prev) continue;
    const tr = Math.max(
      curr.ask - curr.bid,
      Math.abs(curr.price - prev.price)
    );
    trSum += tr;
  }
  return trSum / Math.max(period, 1); // price units
}

// ── Helper: Leader 2-min move ────────────────────────────────
function getLeaderMove2Min(lData, time) {
  const now    = lData.filter(d => d.time <= time).slice(-1)[0];
  const twoMin = lData.filter(d => d.time <= time - 2 * 60 * 1000).slice(-1)[0];
  if (!now || !twoMin || twoMin.price === 0) return null;
  return ((now.price - twoMin.price) / twoMin.price) * 100;
}

function findLeaderData(bySymbol, leader) {
  const variants = [leader, leader + '.m', leader + 'm', leader + '_'];
  for (const v of variants) {
    if (bySymbol[v] && bySymbol[v].length > 10) return bySymbol[v];
  }
  return null;
}

// ── Weekly weight recalibration ───────────────────────────────
function recalibrateWeights(bySymbol, weekStart, allRows) {
  // Use last 4 weeks of data to recalibrate
  const windowStart = weekStart - 28 * 24 * 60 * 60 * 1000;
  const sample = allRows.filter(r => {
    const t = new Date(r.timestamp).getTime();
    return t >= windowStart && t < weekStart;
  });

  if (sample.length < 500) return null; // not enough data yet

  // Calculate actual correlations from sample
  const goldSample = sample.filter(r => r.symbol === 'XAUUSD' || r.symbol === 'XAUUSDm');
  if (goldSample.length < 50) return null;

  const newWeights = { ...WEIGHTS };

  for (const pair of ['DXY', 'US10Y', 'SPX500']) {
    const leaderSample = sample.filter(r =>
      r.symbol === pair || r.symbol === pair + '.m'
    );
    if (leaderSample.length < 20) continue;

    // Simple correlation proxy: count times leader and gold moved inverse
    let agreeCount = 0;
    let total = Math.min(leaderSample.length, goldSample.length) - 1;

    for (let i = 1; i < total; i++) {
      const lMove = leaderSample[i].bid - leaderSample[i-1].bid;
      const gMove = goldSample[i]?.bid  - goldSample[i-1]?.bid;
      if (!gMove) continue;
      if ((lMove > 0 && gMove < 0) || (lMove < 0 && gMove > 0)) agreeCount++;
    }

    if (total < 5) continue;
    const correlation = agreeCount / total;

    // Rescale points: base 40/35/25, adjusted by correlation strength (with non-zero check)
    const basePoints = { DXY: 40, US10Y: 35, SPX500: 25 };
    const correlationFactor = correlation > 0 ? (correlation / 0.6) : 0.5;
    const adjusted = Math.round(basePoints[pair] * correlationFactor);
    newWeights[pair] = {
      ...WEIGHTS[pair],
      points:        Math.max(10, Math.min(50, adjusted)),
      _correlation:  (correlation * 100).toFixed(1) + '%',
    };
  }

  return newWeights;
}

// ── Session + News helpers ────────────────────────────────────
function isGoodSession(time) {
  const h = new Date(time).getUTCHours();
  const d = new Date(time).getUTCDay();
  if (d === 0 || d === 6) return false;       // weekend
  return (h >= 7 && h <= 18);                  // London + NY
}

function isNewsWindow(time) {
  const d = new Date(time).getUTCDay();
  const h = new Date(time).getUTCHours();
  const m = new Date(time).getUTCMinutes();
  const totalMin = h * 60 + m;
  const NEWS = [
    { day: 5, min: 750,  dur: 60 },  // Friday 12:30 NFP
    { day: 3, min: 1080, dur: 90 },  // Wednesday 18:00 FOMC
    { day: 2, min: 750,  dur: 30 },  // Tuesday 12:30 CPI
  ];
  return NEWS.some(n => n.day === d && totalMin >= n.min - 5 && totalMin <= n.min + n.dur);
}

function getWeekBoundaries(startDate, endDate) {
  const weeks = [];
  let current = new Date(startDate).getTime();
  const end   = new Date(endDate).getTime();
  while (current < end) {
    const next = current + 7 * 24 * 60 * 60 * 1000;
    weeks.push({
      start: current,
      end:   Math.min(next, end),
      label: new Date(current).toISOString().slice(0, 10),
    });
    current = next;
  }
  return weeks;
}

// ── Final report printer ──────────────────────────────────────
function printReport(r, finalBalance) {
  const winRate = r.trades_taken > 0
    ? ((r.wins / r.trades_taken) * 100).toFixed(1) : 0;
  
  console.log('\n\n═══════════════════════════════════════════');
  console.log('  BACKTEST REPORT');
  console.log('═══════════════════════════════════════════');
  console.log(`  Period       : ${BACKTEST_CONFIG.startDate} → ${BACKTEST_CONFIG.endDate}`);
  console.log(`  Lot size     : ${BACKTEST_CONFIG.lot_size} (micro)`);
  console.log(`  Slippage     : ${BACKTEST_CONFIG.slippage_pips} pips`);
  console.log(`  Spread cost  : ${BACKTEST_CONFIG.spread_pips} pips`);
  console.log('───────────────────────────────────────────');
  console.log(`  Signals generated : ${r.total_signals}`);
  console.log(`    Strong (taken)   : ${r.strong_signals}`);
  console.log(`    Weak (skipped)   : ${r.weak_signals}`);
  console.log(`  Trades taken  : ${r.trades_taken}`);
  console.log(`  Win rate      : ${winRate}%`);
  console.log(`  Wins          : ${r.wins}`);
  console.log(`  Losses        : ${r.losses}`);
  console.log(`  Breakeven     : ${r.breakeven}`);
  console.log('───────────────────────────────────────────');
  console.log(`  Total pips    : ${r.total_pips.toFixed(1)}`);
  console.log(`  Net P&L       : $${finalBalance.toFixed(2)} (0.01 lot)`);
  console.log(`  Max drawdown  : $${r.max_drawdown.toFixed(2)}`);
  console.log(`  Max win streak: ${r.max_streak_win}`);
  console.log(`  Max loss streak: ${r.max_streak_loss}`);
  console.log(`  Slippage cost  : $${r.slippage_cost.toFixed(2)}`);
  console.log(`  Spread cost    : $${r.spread_cost.toFixed(2)}`);
  console.log('───────────────────────────────────────────');
  console.log('  Monthly breakdown:');

  for (const [month, m] of Object.entries(r.monthly)) {
    const mRate = m.trades > 0 ? ((m.wins / m.trades) * 100).toFixed(0) : 0;
    const sign  = m.pips >= 0 ? '+' : '';
    console.log(`    ${month}: ${m.trades} trades | Win: ${mRate}% | Pips: ${sign}${m.pips.toFixed(1)}`);
  }

  console.log('───────────────────────────────────────────');
  if (r.weekly_weights.length > 0) {
    const last = r.weekly_weights[r.weekly_weights.length - 1];
    console.log(`  Latest weights (week ${last.week}):`);
    for (const [pair, w] of Object.entries(last.weights)) {
      console.log(`    ${pair.padEnd(8)}: ${w.points} pts | corr: ${w._correlation || 'N/A'}`);
    }
  }

  console.log('───────────────────────────────────────────');
  if (r.fake_signals.length > 0) {
    console.log(`  Top 5 fake signals (worst losses):`);
    const worst = r.fake_signals
      .sort((a, b) => b.lostPips - a.lostPips)
      .slice(0, 5);
    worst.forEach(s =>
      console.log(`    ${s.time.slice(0,16)} | ${s.direction} | ${s.trigger} | -${s.lostPips} pips | score: ${s.score}`)
    );
  }

  console.log('═══════════════════════════════════════════');

  // Decision helper
  console.log('\n  VERDICT:');
  const netPips = r.total_pips;
  if (netPips > 200 && parseFloat(winRate) > 55) {
    console.log('  ✅ SYSTEM PROFITABLE — Scale to 0.05 lot on demo first.');
  } else if (netPips > 0 && parseFloat(winRate) > 48) {
    console.log('  ⚠️  MARGINAL — Adjust min_confidence or gap_multiplier before live.');
  } else {
    console.log('  ❌ NOT READY — System needs parameter tuning. Do NOT go live.');
  }
  console.log('═══════════════════════════════════════════\n');

  // Save report to JSON
  const fs = require('fs');
  fs.writeFileSync(
    'backtest_report.json',
    JSON.stringify({ config: BACKTEST_CONFIG, results: r, finalBalance }, null, 2)
  );
  console.log('  Report saved to: backtest_report.json\n');
}

runBacktest().catch(err => {
  console.error('[FATAL]', err.message);
  process.exit(1);
});
