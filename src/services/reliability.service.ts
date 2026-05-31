import { buildSixMonthWindow } from "../domain/date-window";
import { NotFoundError } from "../domain/errors";
import { computeReliabilityScore } from "../domain/scoring";
import { getMerchantCategories } from "../infrastructure/banking-api.client";
import { countMerchantCategories, loadCategoryMap, upsertCategories } from "../repositories/merchant-category.repository";
import { listTransactionsByUserAndDateRange } from "../repositories/transaction.repository";

type ReliabilityResponse = {
  user_id: string;
  from: string;
  model_version: "v1";
  calculated_at: string;
  currency: "EUR";
  reliability_index: number;
  score_band: "LOW" | "MEDIUM" | "HIGH";
  metrics: {
    income_regularity: number;
    income_coverage_ratio: number;
    essential_payments_consistency: number;
    good_months: number;
    negative_balance_days: number;
    late_fee_events: number;
  };
  drivers: string[];
};

async function ensureCategoryDictionary(): Promise<void> {
  if (countMerchantCategories() > 0) {
    return;
  }

  const categories = await getMerchantCategories();
  upsertCategories(categories);
}

export async function buildReliabilityIndex(userId: string, from: string): Promise<ReliabilityResponse> {
  await ensureCategoryDictionary();

  const { windowStart, months } = buildSixMonthWindow(from);

  const rows = listTransactionsByUserAndDateRange({ userId, from: windowStart, to: from });

  if (rows.length === 0) {
    throw new NotFoundError(`No locally synced transactions found for user '${userId}' in ${windowStart}..${from}`);
  }

  const categoryMap = loadCategoryMap();
  const essentialCodes = Object.entries(categoryMap)
    .filter(([, group]) => group === "essential")
    .map(([code]) => code);

  const score = computeReliabilityScore({
    transactions: rows,
    categoryGroupByCode: categoryMap,
    essentialCodes,
    months,
    windowStart,
    from
  });

  return {
    user_id: userId,
    from,
    model_version: "v1",
    calculated_at: new Date().toISOString(),
    currency: "EUR",
    reliability_index: score.reliabilityIndex,
    score_band: score.scoreBand,
    metrics: score.metrics,
    drivers: score.drivers
  };
}

export type { ReliabilityResponse };

