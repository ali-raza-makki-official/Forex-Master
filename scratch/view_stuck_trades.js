const mysql = require('mysql2/promise');

async function main() {
  const pool = mysql.createPool({
    uri: 'mysql://root:@localhost:3306/gold_scalper'
  });
  
  try {
    const [rows] = await pool.execute(`
      SELECT id, ticket, symbol, trade_type, volume, entry_price, close_price, sl, tp, profit, outcome, created_at, closed_at 
      FROM trade_log 
      WHERE closed_at > NOW() - INTERVAL 10 MINUTE
    `);
    
    console.log(JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
