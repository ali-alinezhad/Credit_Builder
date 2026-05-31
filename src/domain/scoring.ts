import { enumerateDatesInclusive, monthKey } from "./date-window";

type StoredTransaction = {
  external_txn_id: string;
  amount: number;
  booking_date: string;
  merchant_category_code: string | null;
  txn_type: "credit" | "debit";
};

type CategoryMap = Record<string, string>;

type ScoreOutput = {
  reliabilityIndex: number;
  scoreBand: "LOW" | "MEDIUM" | "HIGH";
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

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toBand(score: number): "LOW" | "MEDIUM" | "HIGH" {
  if (score >= 75) {
    return "HIGH";
  }
  if (score >= 50) {
    return "MEDIUM";
  }
  return "LOW";
}

function coverageToPoints(ratio: number): number {
  if (ratio <= 0.5) {
    return 0;
  }
  if (ratio <= 1.0) {
    return Math.round(((ratio - 0.5) / 0.5) * 12);
  }
  if (ratio <= 2.0) {
    return Math.round(12 + ((ratio - 1.0) / 1.0) * 10);
  }

  // Above 2x coverage, returns diminish and slowly approach max points.
  const extra = 3 * (1 - Math.exp(-(ratio - 2.0)));
  return Math.round(Math.min(25, 22 + extra));
}

export function computeReliabilityScore(params: {
  transactions: StoredTransaction[];
  categoryGroupByCode: CategoryMap;
  essentialCodes: string[];
  months: string[];
  windowStart: string;
  from: string;
}): ScoreOutput {
  const { transactions, categoryGroupByCode, essentialCodes, months, windowStart, from } = params;

  const monthsWithIncome = new Set<string>();
  const essentialPresence = new Set<string>();
  const incomeByMonth = new Map<string, number>();
  const essentialSpendByMonth = new Map<string, number>();

  let totalIncome = 0;
  let totalEssentialExpenses = 0;
  let totalSpending = 0;
  let savingsCredits = 0;
  let highRiskSpending = 0;
  let lateFeeEvents = 0;

  for (const tx of transactions) {
    const mKey = monthKey(tx.booking_date);
    const group = tx.merchant_category_code ? categoryGroupByCode[tx.merchant_category_code] : undefined;

    if (tx.txn_type === "credit" || group === "income") {
      monthsWithIncome.add(mKey);
      totalIncome += Math.max(0, tx.amount);
      incomeByMonth.set(mKey, (incomeByMonth.get(mKey) ?? 0) + Math.max(0, tx.amount));
    }

    if (tx.amount < 0) {
      totalSpending += Math.abs(tx.amount);
    }

    if (group === "essential" && tx.amount < 0) {
      totalEssentialExpenses += Math.abs(tx.amount);
      essentialSpendByMonth.set(mKey, (essentialSpendByMonth.get(mKey) ?? 0) + Math.abs(tx.amount));
      if (tx.merchant_category_code) {
        essentialPresence.add(`${tx.merchant_category_code}:${mKey}`);
      }
    }

    if (group === "savings" && tx.amount > 0) {
      savingsCredits += tx.amount;
    }

    if (group === "high_risk" && tx.amount < 0) {
      highRiskSpending += Math.abs(tx.amount);
    }

    if (group === "fees") {
      lateFeeEvents += 1;
    }
  }

  const incomeRegularity = monthsWithIncome.size / 6;
  const incomeRegularityPoints = Math.round(incomeRegularity * 25);

  const incomeCoverageRatio = totalEssentialExpenses > 0 ? totalIncome / totalEssentialExpenses : totalIncome > 0 ? 3 : 0;
  const incomeCoveragePoints = coverageToPoints(incomeCoverageRatio);

  const essentialDenominator = 6 * essentialCodes.length;
  const essentialConsistency = essentialDenominator > 0 ? essentialPresence.size / essentialDenominator : 0;
  const essentialConsistencyPoints = Math.round(essentialConsistency * 25);

  const savingsRate = totalIncome > 0 ? savingsCredits / totalIncome : 0;
  const savingsBonus = Math.round(clamp(savingsRate / 0.3, 0, 1) * 25);

  const dailyNet = new Map<string, number>();
  for (const tx of transactions) {
    dailyNet.set(tx.booking_date, (dailyNet.get(tx.booking_date) ?? 0) + tx.amount);
  }
  const allDates = enumerateDatesInclusive(windowStart, from);
  let runningBalance = 0;
  let negativeBalanceDays = 0;
  for (const date of allDates) {
    runningBalance += dailyNet.get(date) ?? 0;
    if (runningBalance < 0) {
      negativeBalanceDays += 1;
    }
  }

  const negativeBalancePenalty = -Math.min(10, Math.round((negativeBalanceDays / allDates.length) * 10));
  const lateFeePenalty = -Math.min(5, lateFeeEvents);

  const highRiskRatio = totalSpending > 0 ? highRiskSpending / totalSpending : 0;
  const highRiskPenalty = -Math.min(5, Math.round(highRiskRatio * 25));

  const resiliencePoints = savingsBonus + negativeBalancePenalty + lateFeePenalty + highRiskPenalty;

  let goodMonths = 0;
  for (const month of months) {
    const mIncome = incomeByMonth.get(month) ?? 0;
    const mEssential = essentialSpendByMonth.get(month) ?? 0;
    if (mIncome > 0 && mIncome >= mEssential) {
      goodMonths += 1;
    }
  }

  const totalScore = clamp(
    incomeRegularityPoints + incomeCoveragePoints + essentialConsistencyPoints + resiliencePoints,
    0,
    100
  );

  const drivers: string[] = [];
  drivers.push(`Income present in ${monthsWithIncome.size}/6 months`);
  drivers.push(`Income covers essential expenses (${round2(incomeCoverageRatio)}x)`);
  if (savingsBonus > 0) {
    drivers.push(`Savings behavior added +${savingsBonus} points`);
  }
  if (negativeBalanceDays > 0) {
    drivers.push(`Estimated ${negativeBalanceDays} negative balance day(s)`);
  }
  if (lateFeeEvents > 0) {
    drivers.push(`${lateFeeEvents} late fee event(s) reduced resilience`);
  }

  return {
    reliabilityIndex: totalScore,
    scoreBand: toBand(totalScore),
    metrics: {
      income_regularity: round2(incomeRegularity),
      income_coverage_ratio: round2(incomeCoverageRatio),
      essential_payments_consistency: round2(essentialConsistency),
      good_months: goodMonths,
      negative_balance_days: negativeBalanceDays,
      late_fee_events: lateFeeEvents
    },
    drivers: drivers.slice(0, 5)
  };
}

export type { StoredTransaction, CategoryMap, ScoreOutput };

