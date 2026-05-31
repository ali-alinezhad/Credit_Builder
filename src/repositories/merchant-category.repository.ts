import { getDb } from "../infrastructure/db";
import type { Category } from "../infrastructure/banking-api.client";
import type { CategoryMap } from "../domain/scoring";

export function upsertCategories(categories: Category[]): void {
  const db = getDb();
  const stmt = db.prepare(
    `
    INSERT INTO merchant_categories (code, name, category_group, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(code) DO UPDATE SET
      name = excluded.name,
      category_group = excluded.category_group,
      updated_at = CURRENT_TIMESTAMP
  `
  );

  const trx = db.transaction(() => {
    for (const category of categories) {
      stmt.run(category.code, category.name, category.group);
    }
  });
  trx();
}

export function countMerchantCategories(): number {
  const db = getDb();
  return Number((db.prepare(`SELECT COUNT(1) as c FROM merchant_categories`).get() as { c: number }).c);
}

export function loadCategoryMap(): CategoryMap {
  const db = getDb();
  const rows = db
    .prepare(`SELECT code, category_group FROM merchant_categories`)
    .all() as Array<{ code: string; category_group: string }>;

  const out: CategoryMap = {};
  for (const row of rows) {
    out[row.code] = row.category_group;
  }
  return out;
}

