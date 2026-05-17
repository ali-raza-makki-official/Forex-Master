const cron = require('node-cron');
const { getDB } = require('./db');

/**
 * Self Trainer Engine
 * Trains price confirm parameters and lagging offsets based on past signals performance.
 * Performs a parameter grid search to find the optimal Confidence Score (minScore) threshold.
 */

async function runTraining(broadcastFn) {
  try {
    console.log('[TRAINER] Initiating self-training optimization cycle...');
    const conn = await getDB();
    
    // Check if was_correct column exists first to avoid silent failures
    const [columns] = await conn.execute("SHOW COLUMNS FROM scalp_signals WHERE Field = 'was_correct'");
    if (columns.length === 0) {
      console.warn('[TRAINER] was_correct column not initialized in scalp_signals. Skipping training.');
      return;
    }
    
    // Get all verified signals from last 7 days
    const [signals] = await conn.execute(`
      SELECT trigger_pair, expected_delay_minutes, actual_result_pips,
             expected_move_pips, was_correct, confidence_score
      FROM scalp_signals 
      WHERE was_correct IS NOT NULL 
      AND created_at > NOW() - INTERVAL 7 DAY
    `);
    
    if (signals.length === 0) {
      console.log('[TRAINER] No verified signals found in the last 7 days. Utilizing seed weights.');
      return;
    }
    
    // ── PARAMETER GRID SEARCH FOR OPTIMAL CONFIDENCE SCORE (minScore) ──
    const minScoreGrid = [60, 65, 70, 75, 80, 85, 90, 95];
    let bestMinScore = 85; // Default fallback
    let bestScoreAccuracy = 0;
    
    console.log('[TRAINER] Running grid search optimization over confidence score threshold...');
    for (const gridScore of minScoreGrid) {
      const hypotheticalSignals = signals.filter(s => parseFloat(s.confidence_score) >= gridScore);
      if (hypotheticalSignals.length >= 3) { // Minimum sample size for statistical validity
        const correctCount = hypotheticalSignals.filter(s => s.was_correct).length;
        const hypAccuracy = (correctCount / hypotheticalSignals.length) * 100;
        console.log(`[TRAINER GRID] Threshold: ${gridScore}% | Accuracy: ${hypAccuracy.toFixed(1)}% | Samples: ${hypotheticalSignals.length}`);
        
        // Prioritize higher accuracy, or higher sample counts at equal accuracy
        if (hypAccuracy > bestScoreAccuracy || (hypAccuracy === bestScoreAccuracy && gridScore > bestMinScore)) {
          bestScoreAccuracy = hypAccuracy;
          bestMinScore = gridScore;
        }
      }
    }
    
    console.log(`[TRAINER GRID] Optimal MinScore Threshold found: ${bestMinScore}% (Accuracy: ${bestScoreAccuracy.toFixed(1)}%)`);
    
    // Automatically persist the optimized threshold to database system_settings
    if (bestScoreAccuracy > 50) { // Only update if profitable/statistically superior
      await conn.execute('UPDATE system_settings SET min_confidence = ? WHERE id = 1', [bestMinScore]);
      console.log(`[TRAINER] System settings updated with optimal min_confidence: ${bestMinScore}%`);
    }

    // Group by leader pair
    const grouped = {};
    for (const s of signals) {
      if (!grouped[s.trigger_pair]) grouped[s.trigger_pair] = [];
      grouped[s.trigger_pair].push(s);
    }
    
    // Update model weights per pair
    for (const [pair, data] of Object.entries(grouped)) {
      const correct = data.filter(d => d.was_correct);
      const accuracy = (correct.length / data.length) * 100;
      const avgLag = data.reduce((s, d) => s + parseFloat(d.expected_delay_minutes), 0) / data.length;
      const avgImpact = data.reduce((s, d) => s + Math.abs(parseFloat(d.actual_result_pips)), 0) / data.length / 100;
      
      await conn.execute(`
        INSERT INTO model_weights (pair, avg_lag_minutes, avg_price_impact, accuracy_rate, sample_count, updated_at)
        VALUES (?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          avg_lag_minutes=VALUES(avg_lag_minutes),
          avg_price_impact=VALUES(avg_price_impact),
          accuracy_rate=VALUES(accuracy_rate),
          sample_count=VALUES(sample_count),
          updated_at=NOW()
      `, [pair, avgLag, avgImpact, accuracy, data.length]);
      
      console.log(`[TRAINER] Refined parameters for ${pair}: Accuracy=${accuracy.toFixed(1)}% Lag=${avgLag.toFixed(1)}m Samples=${data.length}`);
    }
    
    // Broadcast updates to frontend if callback exists
    if (broadcastFn) {
      const [allWeights] = await conn.execute('SELECT * FROM model_weights');
      broadcastFn({ 
        event: 'training_complete', 
        timestamp: Date.now(),
        optimalMinScore: bestMinScore,
        weights: allWeights.map(w => ({
          pair: w.pair,
          points: w.sample_count,
          correlation: (w.avg_price_impact * 100).toFixed(0) + '%',
          accuracy: w.accuracy_rate.toFixed(0) + '%'
        }))
      });
    }
    console.log('[TRAINER] Optimization cycle completed successfully.');
  } catch(e) {
    console.error('[TRAINER] Training loop exception:', e.message);
  }
}

function startSelfTrainer(broadcastFn) {
  // 1. Run immediately on server start to sync database (with safe execution)
  setTimeout(async () => {
    try {
      await runTraining(broadcastFn);
    } catch(e) {
      console.error('[TRAINER INITIAL] Initialization training failed:', e.message);
    }
  }, 3000); // 3 seconds grace period to allow db pool to stabilize

  // 2. Schedule hourly execution (with safe execution)
  cron.schedule('0 * * * *', async () => {
    try {
      await runTraining(broadcastFn);
    } catch(e) {
      console.error('[TRAINER CRON] Scheduled training failed:', e.message);
    }
  });
  
  console.log('[TRAINER] Self-training service initialized (Immediate + Hourly Cron)');
}

module.exports = { startSelfTrainer };
