const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

async function sync() {
  const uri = process.env.DATABASE_URL || 'mysql://root:@localhost:3306/gold_scalper';
  console.log('Connecting to database:', uri);
  const conn = await mysql.createConnection(uri);

  console.log('Truncating old trade logs to establish real history...');
  await conn.execute('TRUNCATE TABLE trade_log');

  const trades = [
    { ticket: 16340408, symbol: 'XAUUSD', trade_type: 'BUY', volume: 0.1, entry_price: 4540.087, close_price: 4538.510, profit: -15.77, created_at: '2026-05-18 06:16:46', closed_at: '2026-05-18 06:17:25' },
    { ticket: 16340466, symbol: 'XAUUSD', trade_type: 'BUY', volume: 0.1, entry_price: 4537.912, close_price: 4537.292, profit: -6.20, created_at: '2026-05-18 06:17:45', closed_at: '2026-05-18 06:17:45' },
    { ticket: 16340546, symbol: 'XAUUSD', trade_type: 'BUY', volume: 0.1, entry_price: 4534.996, close_price: 4534.600, profit: -3.96, created_at: '2026-05-18 06:18:51', closed_at: '2026-05-18 06:18:55' },
    { ticket: 16340966, symbol: 'XAUUSD', trade_type: 'BUY', volume: 0.1, entry_price: 4547.751, close_price: 4548.050, profit: 2.99, created_at: '2026-05-18 06:25:19', closed_at: '2026-05-18 06:25:33' },
    { ticket: 16341166, symbol: 'XAUUSD', trade_type: 'SELL', volume: 0.1, entry_price: 4541.117, close_price: 4541.647, profit: -5.30, created_at: '2026-05-18 06:27:48', closed_at: '2026-05-18 06:27:49' },
    { ticket: 16341182, symbol: 'XAUUSD', trade_type: 'SELL', volume: 0.1, entry_price: 4540.211, close_price: 4540.763, profit: -5.52, created_at: '2026-05-18 06:28:19', closed_at: '2026-05-18 06:28:22' },
    { ticket: 16342156, symbol: 'XAUUSD', trade_type: 'BUY', volume: 0.1, entry_price: 4539.975, close_price: 4540.310, profit: 3.35, created_at: '2026-05-18 06:46:01', closed_at: '2026-05-18 06:46:25' },
    { ticket: 16342213, symbol: 'XAUUSD', trade_type: 'BUY', volume: 0.1, entry_price: 4543.050, close_price: 4543.379, profit: 3.29, created_at: '2026-05-18 06:46:39', closed_at: '2026-05-18 06:46:52' },
    { ticket: 16343872, symbol: 'XAUUSD', trade_type: 'SELL', volume: 0.1, entry_price: 4540.369, close_price: 4539.785, profit: 5.84, created_at: '2026-05-18 07:21:41', closed_at: '2026-05-18 07:24:21' },
    { ticket: 16344086, symbol: 'XAUUSD', trade_type: 'BUY', volume: 0.1, entry_price: 4543.453, close_price: 4551.430, profit: 79.77, created_at: '2026-05-18 07:25:55', closed_at: '2026-05-18 07:29:41' },
    { ticket: 16344401, symbol: 'XAUUSD', trade_type: 'BUY', volume: 0.1, entry_price: 4550.756, close_price: 4551.460, profit: 7.04, created_at: '2026-05-18 07:29:44', closed_at: '2026-05-18 07:30:07' },
    { ticket: 16344551, symbol: 'XAUUSD', trade_type: 'BUY', volume: 0.1, entry_price: 4555.907, close_price: 4556.227, profit: 3.20, created_at: '2026-05-18 07:30:29', closed_at: '2026-05-18 07:30:48' },
    { ticket: 16344604, symbol: 'XAUUSD', trade_type: 'BUY', volume: 0.1, entry_price: 4558.723, close_price: 4558.511, profit: -2.12, created_at: '2026-05-18 07:30:56', closed_at: '2026-05-18 07:31:00' },
    { ticket: 16344635, symbol: 'XAUUSD', trade_type: 'BUY', volume: 0.1, entry_price: 4558.294, close_price: 4558.640, profit: 3.46, created_at: '2026-05-18 07:31:10', closed_at: '2026-05-18 07:32:19' },
    { ticket: 16344720, symbol: 'XAUUSD', trade_type: 'BUY', volume: 0.1, entry_price: 4559.426, close_price: 4554.393, profit: -50.33, created_at: '2026-05-18 07:32:23', closed_at: '2026-05-18 07:36:03' },
    { ticket: 16344963, symbol: 'XAUUSD', trade_type: 'SELL', volume: 0.1, entry_price: 4553.277, close_price: 4553.527, profit: -2.50, created_at: '2026-05-18 07:36:09', closed_at: '2026-05-18 07:36:25' },
    { ticket: 16344989, symbol: 'XAUUSD', trade_type: 'SELL', volume: 0.1, entry_price: 4552.746, close_price: 4552.879, profit: -1.33, created_at: '2026-05-18 07:36:37', closed_at: '2026-05-18 07:38:18' },
    { ticket: 16345080, symbol: 'XAUUSD', trade_type: 'SELL', volume: 0.1, entry_price: 4552.706, close_price: 4552.886, profit: -1.80, created_at: '2026-05-18 07:38:22', closed_at: '2026-05-18 07:38:57' },
    { ticket: 16345181, symbol: 'XAUUSD', trade_type: 'SELL', volume: 0.1, entry_price: 4552.793, close_price: 4553.013, profit: -2.20, created_at: '2026-05-18 07:40:09', closed_at: '2026-05-18 07:40:15' },
    { ticket: 16345242, symbol: 'XAUUSD', trade_type: 'SELL', volume: 0.1, entry_price: 4553.242, close_price: 4544.330, profit: 89.12, created_at: '2026-05-18 07:40:22', closed_at: '2026-05-18 07:49:53' },
    { ticket: 16345897, symbol: 'XAUUSD', trade_type: 'SELL', volume: 0.1, entry_price: 4540.935, close_price: 4541.329, profit: -3.94, created_at: '2026-05-18 07:51:13', closed_at: '2026-05-18 07:51:31' },
    { ticket: 16345929, symbol: 'XAUUSD', trade_type: 'SELL', volume: 0.1, entry_price: 4541.256, close_price: 4541.240, profit: 0.16, created_at: '2026-05-18 07:51:51', closed_at: '2026-05-18 07:52:12' },
    { ticket: 16346254, symbol: 'XAUUSD', trade_type: 'BUY', volume: 0.1, entry_price: 4546.724, close_price: 4547.001, profit: 2.77, created_at: '2026-05-18 07:57:35', closed_at: '2026-05-18 07:58:31' },
    { ticket: 16346325, symbol: 'XAUUSD', trade_type: 'BUY', volume: 0.1, entry_price: 4546.519, close_price: 4547.184, profit: 6.65, created_at: '2026-05-18 07:59:54', closed_at: '2026-05-18 08:00:52' },
    { ticket: 16346425, symbol: 'XAUUSD', trade_type: 'BUY', volume: 0.1, entry_price: 4545.727, close_price: 4546.430, profit: 7.03, created_at: '2026-05-18 08:01:47', closed_at: '2026-05-18 08:04:57' }
  ];

  console.log(`Inserting ${trades.length} verified real trades from MT5 terminal screenshot...`);
  for (const t of trades) {
    await conn.execute(
      'INSERT INTO trade_log (ticket, symbol, trade_type, volume, entry_price, close_price, profit, created_at, closed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [t.ticket, t.symbol, t.trade_type, t.volume, t.entry_price, t.close_price, t.profit, t.created_at, t.closed_at]
    );
  }

  console.log('✅ Real MT5 trade history synchronized successfully!');
  await conn.end();
}

sync().catch(console.error);
