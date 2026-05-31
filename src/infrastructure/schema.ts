export const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  currency TEXT NOT NULL,
  balance REAL NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  external_txn_id TEXT NOT NULL UNIQUE,
  account_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL,
  booking_date TEXT NOT NULL,
  description TEXT,
  merchant_category_code TEXT,
  merchant_name TEXT,
  txn_type TEXT NOT NULL,
  raw_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(account_id) REFERENCES accounts(id)
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, booking_date);
CREATE INDEX IF NOT EXISTS idx_transactions_account_date ON transactions(account_id, booking_date);
CREATE INDEX IF NOT EXISTS idx_transactions_mcc ON transactions(merchant_category_code);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_booking_date ON transactions(booking_date);

CREATE TABLE IF NOT EXISTS merchant_categories (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category_group TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sync_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL,
  synced_accounts INTEGER NOT NULL DEFAULT 0,
  new_transactions INTEGER NOT NULL DEFAULT 0,
  duplicate_transactions INTEGER NOT NULL DEFAULT 0,
  synced_from TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_sync_runs_user_started ON sync_runs(user_id, started_at DESC);
`;

