const cron = require('node-cron');
const { getDB } = require('./db');

function startSelfTrainer(broadcastFn) {
  // Run hourly
  cron.schedule('0 * * * *', async () => {
    console.log('[TRAINER] Starting hourly self-training...');
    
    const conn = await getDB();
    
    // Get all verified signals from last 7 days
    const [signals] = await conn.execute(`
      SELECT trigger_pair, expected_delay_minutes, actual_result_pips,
             expected_move_pips, was_correct
      FROM scalp_signals 
      WHERE was_correct IS NOT NULL 
      AND created_at > NOW() - INTERVAL 7 DAY
    `);
    
    if (signals.length === 0) {
      console.log('[TRAINER] No verified signals found in the last 7 days.');
      return;
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
      
      console.log(`[TRAINER] Updated ${pair}: Accuracy=${accuracy.toFixed(1)}% Lag=${avgLag.toFixed(1)}min Samples=${data.length}`);
    }
    
    // Broadcast updates to frontend if callback exists
    if (broadcastFn) {
      const [allWeights] = await conn.execute('SELECT * FROM model_weights');
      broadcastFn({ 
        event: 'training_complete', 
        timestamp: Date.now(),
        weights: allWeights.map(w => ({
          pair: w.pair,
          points: w.sample_count,
          correlation: (w.avg_price_impact * 100).toFixed(0) + '%',
          accuracy: w.accuracy_rate.toFixed(0) + '%'
        }))
      });
    }
  });
  
  console.log('[TRAINER] Self-training service initialized (Hourly Cron)');
}

module.exports = { startSelfTrainer };
