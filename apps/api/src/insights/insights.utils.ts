/** Parses a window string like "30d" into a day count; falls back on anything else. */
export function parseWindowDays(window: string | undefined, fallback: number): number {
  if (!window) return fallback;
  const match = window.match(/^(\d+)d$/);
  return match ? parseInt(match[1]!, 10) : fallback;
}

/**
 * Extracts a USD midpoint from free-text salary strings. Deliberately
 * conservative: only recognizes USD patterns (k-range, full range, monthly).
 * Returns null for VND text or anything else — mixing currencies into one
 * median would be meaningless, so those salaries are just excluded rather
 * than guessed at.
 */
export function parseUsdMidpoint(salaryText: string): number | null {
  const kRange = salaryText.match(/\$(\d+(?:\.\d+)?)k\s*[-–—]\s*\$?(\d+(?:\.\d+)?)k/i);
  if (kRange) {
    return ((parseFloat(kRange[1]!) + parseFloat(kRange[2]!)) / 2) * 1000;
  }

  const monthly = salaryText.match(/\$([\d,]+)\s*\/\s*(?:month|mo)\b/i);
  if (monthly) {
    return parseFloat(monthly[1]!.replace(/,/g, '')) * 12;
  }

  const fullRange = salaryText.match(/\$([\d,]{4,})\s*[-–—]\s*\$?([\d,]{4,})/);
  if (fullRange) {
    const a = parseFloat(fullRange[1]!.replace(/,/g, ''));
    const b = parseFloat(fullRange[2]!.replace(/,/g, ''));
    return (a + b) / 2;
  }

  return null;
}

export function formatUsd(amount: number): string {
  if (amount >= 1000) return `$${Math.round(amount / 1000)}k`;
  return `$${Math.round(amount)}`;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

export interface BucketPlan {
  since: Date;
  bucketMs: number;
  bucketCount: number;
  labels: string[];
}

export function computeBuckets(windowDays: number, bucketSize: 'day' | 'week'): BucketPlan {
  const bucketDays = bucketSize === 'week' ? 7 : 1;
  const bucketMs = bucketDays * 86_400_000;
  const bucketCount = Math.max(1, Math.ceil(windowDays / bucketDays));
  const since = new Date(Date.now() - windowDays * 86_400_000);
  const labels = Array.from({ length: bucketCount }, (_, i) =>
    new Date(since.getTime() + i * bucketMs).toISOString().slice(0, 10),
  );
  return { since, bucketMs, bucketCount, labels };
}

export function bucketIndex(date: Date, since: Date, bucketMs: number, bucketCount: number): number {
  const idx = Math.floor((date.getTime() - since.getTime()) / bucketMs);
  return Math.max(0, Math.min(bucketCount - 1, idx));
}
