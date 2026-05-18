const mysql = require('mysql2/promise');

async function main() {
  const pool = mysql.createPool({
    uri: 'mysql://root:@localhost:3306/gold_scalper'
  });
  
  try {
    console.log('[MONITOR] Fetching latest signals from scalp_signals...');
    const [signals] = await pool.execute(`
      SELECT id, signal_type, trigger_pair, gold_price_at_signal, expected_move_pips, confidence_score, action, was_correct, actual_result_pips, created_at 
      FROM scalp_signals 
      ORDER BY id DESC 
      LIMIT 20
    `);
    
    console.log('--- LATEST 20 SIGNALS ---');
    console.log(JSON.stringify(signals, null, 2));

    console.log('\n[MONITOR] Fetching latest active/closed trades from trade_log...');
    const [trades] = await pool.execute(`
      SELECT id, ticket, symbol, trade_type, volume, entry_price, close_price, sl, tp, profit, outcome, created_at, closed_at 
      FROM trade_log 
      ORDER BY id DESC 
      LIMIT 10
    `);
    
    console.log('--- LATEST 10 TRADES ---');
    console.log(JSON.stringify(trades, null, 2));

    console.log('\n[MONITOR] Fetching system settings...');
    const [settings] = await pool.execute('SELECT * FROM system_settings WHERE id = 1');
    console.log('--- SYSTEM SETTINGS ---');
    console.log(JSON.stringify(settings, null, 2));

  } catch (err) {
    console.error('[MONITOR] Error:', err);
  } finally {
    await pool.end();
  }
}

main();
