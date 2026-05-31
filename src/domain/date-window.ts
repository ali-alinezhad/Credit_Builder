import { ValidationError } from "./errors";

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function monthKey(dateText: string): string {
  return dateText.slice(0, 7);
}

export function buildSixMonthWindow(from: string): { from: string; windowStart: string; months: string[] } {
  const end = new Date(`${from}T00:00:00.000Z`);
  if (Number.isNaN(end.valueOf())) {
    throw new ValidationError("Invalid from date. Expected YYYY-MM-DD");
  }

  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 5, 1));
  const months: string[] = [];
  for (let i = 0; i < 6; i += 1) {
    const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1));
    months.push(cursor.toISOString().slice(0, 7));
  }

  return {
    from,
    windowStart: toIsoDate(start),
    months
  };
}

export function enumerateDatesInclusive(start: string, end: string): string[] {
  const startDate = new Date(`${start}T00:00:00.000Z`);
  const endDate = new Date(`${end}T00:00:00.000Z`);
  const out: string[] = [];

  for (let d = startDate; d <= endDate; d = new Date(d.getTime() + 24 * 60 * 60 * 1000)) {
    out.push(toIsoDate(d));
  }

  return out;
}

