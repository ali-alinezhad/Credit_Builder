import { describe, expect, it } from "vitest";
import { computeReliabilityScore, type StoredTransaction } from "../src/domain/scoring";

const categoryGroupByCode = {
  "9001": "income",
  "5411": "essential",
  "4900": "essential",
  "6540": "savings",
  "6012": "fees",
  "7995": "high_risk"
};

function tx(partial: Partial<StoredTransaction>): StoredTransaction {
  return {
    external_txn_id: partial.external_txn_id ?? crypto.randomUUID(),
    amount: partial.amount ?? 0,
    booking_date: partial.booking_date ?? "2026-01-01",
    merchant_category_code: partial.merchant_category_code ?? null,
    txn_type: partial.txn_type ?? "debit"
  };
}

describe("computeReliabilityScore", () => {
  it("produces a high score for stable income and savings", () => {
    const transactions: StoredTransaction[] = [
      tx({ external_txn_id: "1", amount: 2500, booking_date: "2025-09-28", merchant_category_code: "9001", txn_type: "credit" }),
      tx({ external_txn_id: "2", amount: 2600, booking_date: "2025-10-28", merchant_category_code: "9001", txn_type: "credit" }),
      tx({ external_txn_id: "3", amount: 2550, booking_date: "2025-11-28", merchant_category_code: "9001", txn_type: "credit" }),
      tx({ external_txn_id: "4", amount: 2480, booking_date: "2025-12-28", merchant_category_code: "9001", txn_type: "credit" }),
      tx({ external_txn_id: "5", amount: 2520, booking_date: "2026-01-28", merchant_category_code: "9001", txn_type: "credit" }),
      tx({ external_txn_id: "6", amount: 2500, booking_date: "2026-02-28", merchant_category_code: "9001", txn_type: "credit" }),
      tx({ external_txn_id: "7", amount: -900, booking_date: "2025-09-03", merchant_category_code: "5411", txn_type: "debit" }),
      tx({ external_txn_id: "8", amount: -850, booking_date: "2025-10-03", merchant_category_code: "5411", txn_type: "debit" }),
      tx({ external_txn_id: "9", amount: -870, booking_date: "2025-11-03", merchant_category_code: "5411", txn_type: "debit" }),
      tx({ external_txn_id: "10", amount: -870, booking_date: "2025-12-03", merchant_category_code: "4900", txn_type: "debit" }),
      tx({ external_txn_id: "11", amount: -860, booking_date: "2026-01-03", merchant_category_code: "4900", txn_type: "debit" }),
      tx({ external_txn_id: "12", amount: -850, booking_date: "2026-02-03", merchant_category_code: "5411", txn_type: "debit" }),
      tx({ external_txn_id: "13", amount: 300, booking_date: "2026-01-10", merchant_category_code: "6540", txn_type: "credit" })
    ];

    const result = computeReliabilityScore({
      transactions,
      categoryGroupByCode,
      essentialCodes: ["5411", "4900"],
      months: ["2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02"],
      windowStart: "2025-09-01",
      from: "2026-02-28"
    });

    expect(result.reliabilityIndex).toBeGreaterThanOrEqual(60);
    expect(["MEDIUM", "HIGH"]).toContain(result.scoreBand);
    expect(result.metrics.income_regularity).toBe(1);
    expect(result.metrics.late_fee_events).toBe(0);
  });

  it("penalizes fees and high-risk spending", () => {
    const transactions: StoredTransaction[] = [
      tx({ external_txn_id: "a", amount: 1200, booking_date: "2025-10-01", merchant_category_code: "9001", txn_type: "credit" }),
      tx({ external_txn_id: "b", amount: -600, booking_date: "2025-10-02", merchant_category_code: "5411", txn_type: "debit" }),
      tx({ external_txn_id: "c", amount: -300, booking_date: "2025-10-03", merchant_category_code: "7995", txn_type: "debit" }),
      tx({ external_txn_id: "d", amount: -15, booking_date: "2025-10-04", merchant_category_code: "6012", txn_type: "debit" }),
      tx({ external_txn_id: "e", amount: -15, booking_date: "2025-10-05", merchant_category_code: "6012", txn_type: "debit" })
    ];

    const result = computeReliabilityScore({
      transactions,
      categoryGroupByCode,
      essentialCodes: ["5411", "4900"],
      months: ["2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02"],
      windowStart: "2025-09-01",
      from: "2026-02-28"
    });

    expect(result.metrics.late_fee_events).toBe(2);
    expect(result.reliabilityIndex).toBeLessThan(70);
  });
});

