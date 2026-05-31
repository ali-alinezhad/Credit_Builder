import {
  getAccounts,
  getDiscovery,
  getMerchantCategories,
  getTransactionsPage
} from "../infrastructure/banking-api.client";
import { upsertAccount } from "../repositories/account.repository";
import { upsertCategories } from "../repositories/merchant-category.repository";
import { createStartedSyncRun, completeSyncRun, failSyncRun } from "../repositories/sync-run.repository";
import { insertTransaction } from "../repositories/transaction.repository";

export type SyncSummary = {
  user_id: string;
  synced_accounts: number;
  new_transactions: number;
  duplicate_transactions: number;
  synced_from: string;
};

export async function syncUserTransactions(userId: string): Promise<SyncSummary> {
  const discovery = await getDiscovery();
  const categories = await getMerchantCategories();
  upsertCategories(categories);
  const runId = createStartedSyncRun(userId);

  try {
    const accounts = await getAccounts(userId);
    let newTransactions = 0;
    let duplicateTransactions = 0;
    let syncedFrom = discovery.data_range.from;

    for (const account of accounts) {
      upsertAccount(account);

      let cursor = "";
      do {
        const page = await getTransactionsPage({
          accountId: account.id,
          from: discovery.data_range.from,
          to: discovery.data_range.to,
          cursor
        });

        for (const tx of page.transactions) {
          if (tx.date < syncedFrom) {
            syncedFrom = tx.date;
          }

          const isNew = insertTransaction(userId, tx);
          if (isNew) {
            newTransactions += 1;
          } else {
            duplicateTransactions += 1;
          }
        }

        cursor = page.next_cursor ?? "";
        if (page.next_cursor === null) {
          break;
        }
      } while (cursor.length > 0);
    }

    completeSyncRun({
      runId,
      syncedAccounts: accounts.length,
      newTransactions,
      duplicateTransactions,
      syncedFrom
    });

    return {
      user_id: userId,
      synced_accounts: accounts.length,
      new_transactions: newTransactions,
      duplicate_transactions: duplicateTransactions,
      synced_from: syncedFrom
    };
  } catch (error) {
    failSyncRun(runId, error instanceof Error ? error.message : String(error));

    throw error;
  }
}

