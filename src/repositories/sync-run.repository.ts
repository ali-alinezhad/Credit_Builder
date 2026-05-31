import { getDb } from "../infrastructure/db";

export function createStartedSyncRun(userId: string): number {
  const db = getDb();
  const runInsert = db.prepare(
    `INSERT INTO sync_runs (user_id, status, started_at) VALUES (?, 'started', CURRENT_TIMESTAMP)`
  );
  return Number(runInsert.run(userId).lastInsertRowid);
}

export function completeSyncRun(params: {
  runId: number;
  syncedAccounts: number;
  newTransactions: number;
  duplicateTransactions: number;
  syncedFrom: string;
}): void {
  const db = getDb();
  db.prepare(
    `
    UPDATE sync_runs
    SET status = 'completed', finished_at = CURRENT_TIMESTAMP,
        synced_accounts = ?, new_transactions = ?, duplicate_transactions = ?, synced_from = ?
    WHERE id = ?
  `
  ).run(
    params.syncedAccounts,
    params.newTransactions,
    params.duplicateTransactions,
    params.syncedFrom,
    params.runId
  );
}

export function failSyncRun(runId: number, errorMessage: string): void {
  const db = getDb();
  db.prepare(
    `
    UPDATE sync_runs
    SET status = 'failed', finished_at = CURRENT_TIMESTAMP, error_message = ?
    WHERE id = ?
  `
  ).run(errorMessage, runId);
}

