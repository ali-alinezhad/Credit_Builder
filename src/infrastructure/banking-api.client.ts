import { env } from "../config/env";
import { UpstreamApiError } from "../domain/errors";

type DiscoveryResponse = {
  data_range: {
    from: string;
    to: string;
  };
};

type Account = {
  id: string;
  user_id: string;
  type: string;
  currency: string;
  balance: number;
  name: string;
};

type Category = {
  code: string;
  name: string;
  group: string;
};

type Transaction = {
  id: string;
  account_id: string;
  amount: number;
  currency: string;
  date: string;
  description: string;
  merchant_category_code: string | null;
  merchant_name: string;
  type: "credit" | "debit";
};

type TransactionPage = {
  transactions: Transaction[];
  next_cursor: string | null;
};

async function request<T>(path: string): Promise<T> {
  const base = env.bankingApiBaseUrl.replace(/\/$/, "");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.bankingApiTimeoutMs);

  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      headers: {
        Authorization: `Bearer ${env.bankingApiKey}`
      },
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new UpstreamApiError(504, `Banking API timeout after ${env.bankingApiTimeoutMs}ms`);
    }

    throw new UpstreamApiError(
      502,
      `Banking API request failed: ${error instanceof Error ? error.message : String(error)}`
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const body = await response.text();
    throw new UpstreamApiError(response.status, `Banking API failed (${response.status}): ${body}`);
  }

  return response.json() as Promise<T>;
}

export async function getDiscovery(): Promise<DiscoveryResponse> {
  return request<DiscoveryResponse>("/");
}

export async function getAccounts(userId: string): Promise<Account[]> {
  const payload = await request<{ accounts: Account[] }>(`/users/${encodeURIComponent(userId)}/accounts`);
  return payload.accounts;
}

export async function getMerchantCategories(): Promise<Category[]> {
  const payload = await request<{ categories: Category[] }>("/dictionaries/merchant-categories");
  return payload.categories;
}

export async function getTransactionsPage(params: {
  accountId: string;
  from: string;
  to: string;
  cursor: string;
}): Promise<TransactionPage> {
  const query = new URLSearchParams({
    from: params.from,
    to: params.to,
    cursor: params.cursor
  });

  return request<TransactionPage>(`/accounts/${encodeURIComponent(params.accountId)}/transactions?${query.toString()}`);
}

export type { Account, Category, Transaction, TransactionPage };

