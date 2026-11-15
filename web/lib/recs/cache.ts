import type { ServerSupabase as Supabase } from "@/lib/api/auth";
export type CacheMode = "film_explanations" | "music";
type CacheRow = { recommendations: unknown; expires_at: string; log_count_at_generation: number };

const CACHE_DAYS = 7;
/** A legitimately empty result is kept this long so page views do not rebuild it. */
const EMPTY_CACHE_HOURS = 1;

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

/** How many recently recommended titles a refresh keeps out: about three refreshes' worth. */
export const SHOWN_HISTORY = 60;

export type ShownFilm = { tmdb_id: number; media_type: "movie" | "tv"; title: string };

/**
 * The titles to keep out of the next refresh: this batch first, then the
 * earlier history, one entry per title, cut to `max` with the oldest dropped.
 */
export function nextShownHistory(batch: ShownFilm[], previous: ShownFilm[], max = SHOWN_HISTORY): ShownFilm[] {
  const seen = new Set<string>();
  const out: ShownFilm[] = [];
  for (const f of [...batch, ...previous]) {
    const key = `${f.media_type}:${f.tmdb_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ tmdb_id: f.tmdb_id, media_type: f.media_type, title: f.title });
    if (out.length >= max) break;
  }
  return out;
}

export async function readCache(supabase: Supabase, userId: string, mode: CacheMode): Promise<CacheRow | null> {
  const { data, error } = await supabase
    .from("ai_recommendation_cache")
    .select("recommendations, expires_at, log_count_at_generation")
    .eq("user_id", userId)
    .eq("mode", mode)
    .maybeSingle();
  if (error) {
    console.error("recommendation cache read failed:", error.message);
    return null;
  }
  return (data as CacheRow | null) ?? null;
}

export async function writeCache(
  supabase: Supabase,
  userId: string,
  mode: CacheMode,
  recommendations: unknown,
  logCount: number,
  status: "ok" | "empty",
) {
  const now = new Date();
  const { error } = await supabase.from("ai_recommendation_cache").upsert(
    {
      user_id: userId,
      mode,
      recommendations,
      generated_at: now.toISOString(),
      log_count_at_generation: logCount,
      expires_at: cacheExpiry(status, now).toISOString(),
    },
    { onConflict: "user_id,mode" },
  );
  if (error) console.error("ai_recommendation_cache write failed:", error.message);
}
