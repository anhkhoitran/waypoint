/**
 * Day-boundary math fixed to Asia/Ho_Chi_Minh (UTC+7, no DST) — per the
 * Phase 3 plan, streak/heatmap stats must not silently shift with the
 * server's local timezone.
 */
const TZ_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The Asia/Ho_Chi_Minh calendar-day key (YYYY-MM-DD) containing `date`. */
export function dayKey(date: Date): string {
  return new Date(date.getTime() + TZ_OFFSET_MS).toISOString().slice(0, 10);
}

/** Start of the Asia/Ho_Chi_Minh calendar day containing `date`, as a UTC instant. */
export function startOfDay(date: Date): Date {
  const key = dayKey(date);
  return new Date(new Date(`${key}T00:00:00.000Z`).getTime() - TZ_OFFSET_MS);
}

/** End of the Asia/Ho_Chi_Minh calendar day containing `date`, as a UTC instant. */
export function endOfDay(date: Date): Date {
  return new Date(startOfDay(date).getTime() + DAY_MS - 1);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}
