export const CACHE_DAYS = 7;

export function isCacheValid(
  row: { expires_at: string; log_count_at_generation: number } | null,
  logCount: number,
  now: Date,
): boolean {
  if (!row) return false;
  if (row.log_count_at_generation !== logCount) return false;
  return new Date(row.expires_at).getTime() > now.getTime();
}
