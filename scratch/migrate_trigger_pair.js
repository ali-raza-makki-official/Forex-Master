const mysql = require('mysql2/promise');

async function run() {
  const uri = process.env.DATABASE_URL || 'mysql://root:@localhost:3306/gold_scalper';
  let conn;
  try {
    conn = await mysql.createConnection(uri);
    console.log('Connected to local MySQL!');
  } catch (err) {
    console.error('MySQL connection failed:', err.message);
    return;
  }

  try {
    // 1. Modify trigger_pair column to VARCHAR(255)
    await conn.execute('ALTER TABLE scalp_signals MODIFY COLUMN trigger_pair VARCHAR(255)');
    console.log('✅ Modified trigger_pair column to VARCHAR(255) successfully!');
  } catch (err) {
    console.error('Failed to modify trigger_pair column:', err.message);
  }

  try {
    // 2. Add action column to scalp_signals table if not exists
    const [columns] = await conn.execute("SHOW COLUMNS FROM scalp_signals");
    const colNames = columns.map(c => c.Field);
    if (!colNames.includes('action')) {
      await conn.execute("ALTER TABLE scalp_signals ADD COLUMN action VARCHAR(20) DEFAULT 'EXECUTE'");
      console.log("✅ Added 'action' column to scalp_signals successfully!");
    } else {
      console.log("ℹ️ 'action' column already exists in scalp_signals.");
    }
  } catch (err) {
    console.error('Failed to update columns:', err.message);
  }

  await conn.end();
}

run().catch(console.error);
