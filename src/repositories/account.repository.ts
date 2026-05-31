import { getDb } from "../infrastructure/db";
import type { Account } from "../infrastructure/banking-api.client";

export function upsertAccount(account: Account): void {
  const db = getDb();
  const stmt = db.prepare(
    `
    INSERT INTO accounts (id, user_id, type, currency, balance, name, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      user_id = excluded.user_id,
      type = excluded.type,
      currency = excluded.currency,
      balance = excluded.balance,
      name = excluded.name,
      updated_at = CURRENT_TIMESTAMP
  `
  );

  stmt.run(account.id, account.user_id, account.type, account.currency, account.balance, account.name);
}

