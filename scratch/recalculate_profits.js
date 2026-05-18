const mysql = require('mysql2/promise');

async function main() {
  const pool = mysql.createPool({
    uri: 'mysql://root:@localhost:3306/gold_scalper'
  });
  
  try {
    const [rows] = await pool.execute(`
      SELECT id, ticket, trade_type, volume, entry_price, close_price, profit, outcome 
      FROM trade_log 
      WHERE closed_at > NOW() - INTERVAL 12 HOUR
    `);
    
    console.log(`Analyzing ${rows.length} trades closed in the last 12 hours...`);
    
    let fixedCount = 0;
    for (const r of rows) {
      const entry = parseFloat(r.entry_price);
      const close = parseFloat(r.close_price);
      const vol = parseFloat(r.volume || 0.10);
      const type = r.trade_type;
      
      if (!entry || !close) continue;
      
      let realProfit = 0;
      if (type === 'BUY') {
        realProfit = (close - entry) * vol * 100;
      } else {
        realProfit = (entry - close) * vol * 100;
      }
      
      // Calculate pips: 1.0 USD move = 100 pips (multiplier 100)
      const pipsGained = type === 'BUY' ? (close - entry) * 100 : (entry - close) * 100;
      
      // Outcome classification based on actual profit
      let outcome = 'BE';
      if (realProfit > 5.00) outcome = 'TP';
      else if (realProfit < -5.00) outcome = 'SL';
      
      await pool.execute(`
        UPDATE trade_log 
        SET profit = ?, 
            pips_gained = ?, 
            outcome = ? 
        WHERE id = ?
      `, [realProfit.toFixed(2), pipsGained.toFixed(2), outcome, r.id]);
      
      console.log(`Fixed Ticket #${r.ticket} (${type}) | Entry: ${entry} Exit: ${close} | Real Profit: $${realProfit.toFixed(2)} | Outcome: ${outcome}`);
      fixedCount++;
    }
    
    console.log(`\n🎉 Recalculation complete! Successfully updated ${fixedCount} trades!`);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

main();
