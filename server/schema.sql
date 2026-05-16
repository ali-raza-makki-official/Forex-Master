CREATE DATABASE IF NOT EXISTS gold_scalper;
USE gold_scalper;

CREATE TABLE IF NOT EXISTS price_data (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL,
  bid DECIMAL(10,5),
  ask DECIMAL(10,5),
  timestamp DATETIME(3) DEFAULT NOW(3),
  INDEX idx_sym_time (symbol, timestamp)
);

CREATE TABLE IF NOT EXISTS scalp_signals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  signal_type ENUM('BUY','SELL'),
  trigger_pair VARCHAR(20),
  gold_price_at_signal DECIMAL(10,5),
  expected_move_pips DECIMAL(6,2),
  expected_delay_minutes DECIMAL(6,2),
  confidence_score DECIMAL(5,2),
  actual_result_pips DECIMAL(6,2) NULL,
  was_correct BOOLEAN NULL,
  created_at DATETIME DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS model_weights (
  pair VARCHAR(20) PRIMARY KEY,
  avg_lag_minutes DECIMAL(6,2),
  avg_price_impact DECIMAL(6,4),
  accuracy_rate DECIMAL(5,2),
  sample_count INT DEFAULT 0,
  updated_at DATETIME DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trade_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ticket BIGINT,
  signal_id INT NULL,
  symbol VARCHAR(20),
  trade_type ENUM('BUY','SELL'),
  volume DECIMAL(5,2),
  entry_price DECIMAL(10,5),
  close_price DECIMAL(10,5) NULL,
  pips_gained DECIMAL(6,2) NULL,
  profit DECIMAL(8,2) NULL,
  created_at DATETIME DEFAULT NOW(),
  closed_at DATETIME NULL
);

-- Seed default model weights
INSERT IGNORE INTO model_weights (pair, avg_lag_minutes, avg_price_impact, accuracy_rate, sample_count, updated_at) VALUES
  ('DXY',    5.0, 0.0080, 70.0, 0, NOW()),
  ('US10Y',  3.0, 0.0060, 70.0, 0, NOW()),
  ('SPX500', 8.0, 0.0040, 70.0, 0, NOW());

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
);

CREATE TABLE IF NOT EXISTS system_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  auto_scalp_enabled BOOLEAN DEFAULT TRUE,
  risk_per_trade DECIMAL(4,2) DEFAULT 1.0,
  max_daily_drawdown DECIMAL(4,2) DEFAULT 5.0,
  leader_symbol VARCHAR(20) DEFAULT 'XAUUSD',
  lagging_symbols TEXT,
  lot_size DECIMAL(5,2) DEFAULT 0.01,
  daily_loss_limit DECIMAL(8,2) DEFAULT 50.00,
  max_spread DECIMAL(4,1) DEFAULT 5.0,
  news_buffer_mins INT DEFAULT 30,
  telegram_token VARCHAR(255),
  telegram_chat_id VARCHAR(50),
  min_confidence INT DEFAULT 85,
  updated_at DATETIME DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS system_intelligence_pairs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  setting_id INT DEFAULT 1,
  symbol VARCHAR(20),
  correlation ENUM('same','inverse') DEFAULT 'same',
  weight TINYINT DEFAULT 50,
  FOREIGN KEY (setting_id) REFERENCES system_settings(id)
);

INSERT IGNORE INTO system_settings (id, auto_scalp_enabled, risk_per_trade, max_daily_drawdown) 
VALUES (1, TRUE, 1.0, 5.0);
