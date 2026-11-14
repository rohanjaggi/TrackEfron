export const CACHE_DAYS = 7;
/** A legitimately empty result is kept this long so page views do not rebuild it. */
export const EMPTY_CACHE_HOURS = 1;

export function cacheExpiry(status: "ok" | "empty", now: Date): Date {
  const hours = status === "ok" ? CACHE_DAYS * 24 : EMPTY_CACHE_HOURS;
  return new Date(now.getTime() + hours * 60 * 60 * 1000);
}

export function isCacheValid(
  row: { expires_at: string; log_count_at_generation: number } | null,
  logCount: number,
  now: Date,
): boolean {
  if (!row) return false;
  if (row.log_count_at_generation !== logCount) return false;
  return new Date(row.expires_at).getTime() > now.getTime();
}
