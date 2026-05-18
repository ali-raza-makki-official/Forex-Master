const mysql = require('mysql2/promise');

async function main() {
  const pool = mysql.createPool({
    uri: 'mysql://root:@localhost:3306/gold_scalper'
  });
  
  try {
    console.log('[HEALER] Commencing database repair on trade outcomes...');
    
    // 1. SL corrections (any negative profit must be SL)
    const [resSL] = await pool.execute(`
      UPDATE trade_log 
      SET outcome = 'SL' 
      WHERE profit < 0 AND closed_at IS NOT NULL AND outcome != 'SL'
    `);
    console.log(`[HEALER] Corrected Stop Loss (SL) outcomes: ${resSL.affectedRows} rows`);

    // 2. TP corrections (any profit >= 10.00 must be TP)
    const [resTP] = await pool.execute(`
      UPDATE trade_log 
      SET outcome = 'TP' 
      WHERE profit >= 10.00 AND closed_at IS NOT NULL AND outcome != 'TP'
    `);
    console.log(`[HEALER] Corrected Take Profit (TP) outcomes: ${resTP.affectedRows} rows`);

    // 3. BE corrections (any profit between 0.00 and 10.00 must be BE)
    const [resBE] = await pool.execute(`
      UPDATE trade_log 
      SET outcome = 'BE' 
      WHERE profit >= 0.00 AND profit < 10.00 AND closed_at IS NOT NULL AND outcome != 'BE'
    `);
    console.log(`[HEALER] Corrected Break Even (BE) outcomes: ${resBE.affectedRows} rows`);
    
    console.log('[HEALER] Database repair successfully executed!');
  } catch (err) {
    console.error('[HEALER] Error repairing database:', err);
  } finally {
    await pool.end();
  }
}

main();
