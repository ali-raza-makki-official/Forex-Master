const mysql = require('mysql2/promise');

async function migrate() {
  const uri = process.env.DATABASE_URL || 'mysql://root:@localhost:3306/gold_scalper';
  let conn;
  try {
    console.log('Connecting to database:', uri);
    conn = await mysql.createConnection(uri);
    console.log('✅ Connected to database successfully!');
  } catch(e) {
    console.error('❌ Database connection failed:', e.message);
    console.error('Please check if MySQL server is running and your DATABASE_URL environment variable is correct.');
    process.exit(1);
  }
  
  console.log('Starting comprehensive schema migration...');
  
  // 1. Update system_settings columns
  const [ssColumns] = await conn.execute("SHOW COLUMNS FROM system_settings");
  const ssColNames = ssColumns.map(c => c.Field);

  const ssToUpdate = [
    { name: 'leader_symbol', type: "VARCHAR(20) DEFAULT 'XAUUSD'" },
    { name: 'lagging_symbols', type: "TEXT" },
    { name: 'lot_size', type: "DECIMAL(5,2) DEFAULT 0.01" },
    { name: 'daily_loss_limit', type: "DECIMAL(8,2) DEFAULT 50.00" },
    { name: 'max_spread', type: "DECIMAL(4,1) DEFAULT 5.0" },
    { name: 'news_buffer_mins', type: "INT DEFAULT 30" },
    { name: 'min_confidence', type: "INT DEFAULT 85" }
  ];

  for (const col of ssToUpdate) {
    if (!ssColNames.includes(col.name)) {
      console.log(`Adding ${col.name} to system_settings...`);
      await conn.execute(`ALTER TABLE system_settings ADD COLUMN ${col.name} ${col.type}`);
    }
  }

  // 2. Update trade_log columns
  const [tlColumns] = await conn.execute("SHOW COLUMNS FROM trade_log");
  const tlColNames = tlColumns.map(c => c.Field);

  if (tlColNames.includes('exit_price') && !tlColNames.includes('close_price')) {
    console.log('Renaming exit_price to close_price in trade_log...');
    await conn.execute("ALTER TABLE trade_log CHANGE COLUMN exit_price close_price DECIMAL(10,5) NULL");
  }

  if (tlColNames.includes('profit_usd') && !tlColNames.includes('profit')) {
    console.log('Renaming profit_usd to profit in trade_log...');
    await conn.execute("ALTER TABLE trade_log CHANGE COLUMN profit_usd profit DECIMAL(8,2) NULL");
  }

  if (!tlColNames.includes('closed_at')) {
    console.log('Adding closed_at to trade_log...');
    await conn.execute("ALTER TABLE trade_log ADD COLUMN closed_at DATETIME NULL");
  }

  // 3. Create system_intelligence_pairs table
  console.log('Ensuring system_intelligence_pairs table exists...');
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS system_intelligence_pairs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      setting_id INT DEFAULT 1,
      symbol VARCHAR(20),
      correlation ENUM('same','inverse') DEFAULT 'same',
      weight TINYINT DEFAULT 50,
      FOREIGN KEY (setting_id) REFERENCES system_settings(id)
    )
  `);

  // 4. Create lock_events table
  console.log('Ensuring lock_events table exists...');
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS lock_events (
      id          BIGINT AUTO_INCREMENT PRIMARY KEY,
      ticket      BIGINT NOT NULL,
      symbol      VARCHAR(20),
      profit_pips DECIMAL(8,1),
      lock_pips   DECIMAL(8,1),
      lock_price  DECIMAL(10,5),
      zone        ENUM('ENTRY','EARLY','MID','STRONG','MONSTER'),
      created_at  DATETIME DEFAULT NOW(),
      INDEX idx_ticket (ticket),
      INDEX idx_created (created_at)
    )
  `);

  console.log('Migration complete!');
  await conn.end();
}

migrate().catch(e => {
    console.error('Migration failed:', e.message);
    process.exit(1);
});
