const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

async function migrate() {
  const uri = process.env.DATABASE_URL || 'mysql://root:@localhost:3306/gold_scalper';
  console.log('Connecting to database:', uri);
  const conn = await mysql.createConnection(uri);

  console.log('Adding columns to trade_log table...');
  try {
    const [cols] = await conn.execute("SHOW COLUMNS FROM trade_log LIKE 'sl'");
    if (cols.length === 0) {
      await conn.execute("ALTER TABLE trade_log ADD COLUMN sl DECIMAL(10,5) NULL");
      console.log('Added sl column.');
    }
  } catch (err) {
    console.log('SL column check/add skipped:', err.message);
  }

  try {
    const [cols] = await conn.execute("SHOW COLUMNS FROM trade_log LIKE 'tp'");
    if (cols.length === 0) {
      await conn.execute("ALTER TABLE trade_log ADD COLUMN tp DECIMAL(10,5) NULL");
      console.log('Added tp column.');
    }
  } catch (err) {
    console.log('TP column check/add skipped:', err.message);
  }

  try {
    const [cols] = await conn.execute("SHOW COLUMNS FROM trade_log LIKE 'outcome'");
    if (cols.length === 0) {
      await conn.execute("ALTER TABLE trade_log ADD COLUMN outcome ENUM('TP', 'BE', 'SL') NOT NULL DEFAULT 'SL'");
      console.log('Added outcome column.');
    }
  } catch (err) {
    console.log('Outcome column check/add skipped:', err.message);
  }

  console.log('Updating outcomes for historical verified trades...');
  const outcomes = {
    16340408: 'SL',
    16340466: 'SL',
    16340546: 'SL',
    16340966: 'TP',
    16341166: 'SL',
    16341182: 'SL',
    16342156: 'BE',
    16342213: 'BE',
    16343872: 'BE',
    16344086: 'TP',
    16344401: 'BE',
    16344551: 'BE',
    16344604: 'SL',
    16344635: 'BE',
    16344720: 'SL',
    16344963: 'SL',
    16344989: 'SL',
    16345080: 'SL',
    16345181: 'SL',
    16345242: 'TP',
    16345897: 'SL',
    16345929: 'BE',
    16346254: 'BE',
    16346325: 'BE',
    16346425: 'BE'
  };

  for (const [ticket, outcome] of Object.entries(outcomes)) {
    await conn.execute('UPDATE trade_log SET outcome = ? WHERE ticket = ?', [outcome, ticket]);
  }

  console.log('✅ Migration complete and outcomes synced!');
  await conn.end();
}

migrate().catch(console.error);
