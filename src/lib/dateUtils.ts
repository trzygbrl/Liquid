// src/lib/dateUtils.ts

/** Whole days elapsed between an ISO timestamp and now. */
export function daysSince(iso: string): number {
  const then = new Date(iso).getTime();
  const now = Date.now();
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

/**
 * A Date as 'YYYY-MM-DD' on the *local* calendar.
 *
 * Deliberately not `toISOString().split('T')[0]`, which converts to UTC first
 * and so names the previous day for the whole Manila morning (UTC+8). Slot
 * dates are plain `date` columns with no timezone, so they have to be compared
 * against the local calendar day, not a UTC instant.
 */
export function isoDate(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

/** Today as 'YYYY-MM-DD' on the local calendar. */
export function todayISO(): string {
  return isoDate(new Date());
}
