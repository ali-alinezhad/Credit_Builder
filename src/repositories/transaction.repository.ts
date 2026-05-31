import { getDb } from "../infrastructure/db";
import type { StoredTransaction } from "../domain/scoring";
import type { Transaction } from "../infrastructure/banking-api.client";

export function insertTransaction(userId: string, tx: Transaction): boolean {
  const db = getDb();
  const stmt = db.prepare(
    `
    INSERT OR IGNORE INTO transactions (
      external_txn_id, account_id, user_id, amount, currency, booking_date,
      description, merchant_category_code, merchant_name, txn_type, raw_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
  );

  const result = stmt.run(
    tx.id,
    tx.account_id,
    userId,
    tx.amount,
    tx.currency,
    tx.date,
    tx.description,
    tx.merchant_category_code,
    tx.merchant_name,
    tx.type,
    JSON.stringify(tx)
  );

  return result.changes === 1;
}

export function listTransactionsByUserAndDateRange(params: {
  userId: string;
  from: string;
  to: string;
}): StoredTransaction[] {
  const db = getDb();
  return db
    .prepare(
      `
      SELECT external_txn_id, amount, booking_date, merchant_category_code, txn_type
      FROM transactions
      WHERE user_id = ?
        AND booking_date >= ?
        AND booking_date <= ?
      ORDER BY booking_date ASC, external_txn_id ASC
    `
    )
    .all(params.userId, params.from, params.to) as StoredTransaction[];
}

