import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { filmRecommendTool, musicRecommendTool } from "@/lib/ai/tools";
import type {
  FilmRecommendation,
  MusicRecommendation,
  MusicRecsResponse,
  RawFilmPick,
  SpotifyTops,
  RecsResponse,
  RightNow,
} from "@/lib/ai/types";
import { AIError, makeAI } from "@/lib/recs/ai-call";
import { cacheExpiry, isCacheValid, nextShownHistory, type ShownFilm } from "@/lib/recs/cache";
import { buildFilmRecs } from "@/lib/recs/film/build";
import { gatherFilmCandidates } from "@/lib/recs/film/candidates";
import { makeFilmLookup } from "@/lib/recs/film/lookup";
import type { WatchLogRow } from "@/lib/recs/film/select-logs";
import { fetchLogYears } from "@/lib/recs/film/years";
import { buildMusicRecs, type ListenLogRow } from "@/lib/recs/music/build";
import { fetchSpotifyTops } from "@/lib/recs/music/tops";
import { getValidToken } from "@/lib/spotify/pkce";
import { searchSpotify } from "@/lib/spotify/spotify";
import { getMovieDetails, getTvDetails, searchByTitleYear } from "@/lib/tmdb/tmdb";

export const maxDuration = 300;

// The film cache keeps its existing mode value because the repo has no schema file to confirm a new one is allowed.
const FILM_MODE = "film_explanations";
const MUSIC_MODE = "music";
type CacheMode = typeof FILM_MODE | typeof MUSIC_MODE;

type Supabase = Awaited<ReturnType<typeof createClient>>;
type CacheRow = { recommendations: unknown; expires_at: string; log_count_at_generation: number };

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") || "music";
  const refresh = searchParams.get("refresh") === "true";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (mode !== "film" && mode !== "music") {
    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  }

  try {
    const body = mode === "film" ? await filmRecs(supabase, user.id, refresh) : await musicRecs(supabase, user.id, refresh);
    return NextResponse.json(body);
  } catch (e) {
    if (e instanceof AIError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.code === "NO_API_KEY" ? 402 : 500 });
    }
    console.error("recommend route failed:", e);
    return NextResponse.json({ error: "Failed to generate recommendations", code: "PROVIDER_ERROR" }, { status: 500 });
  }
}

async function readCache(supabase: Supabase, userId: string, mode: CacheMode): Promise<CacheRow | null> {
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

async function writeCache(
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

async function filmRecs(supabase: Supabase, userId: string, refresh: boolean): Promise<RecsResponse<FilmRecommendation>> {
  const [cache, logsRes, watchlistRes, dnaRes] = await Promise.all([
    readCache(supabase, userId, FILM_MODE),
    supabase
      .from("watch_logs")
      .select(
        "tmdb_id, title, media_type, rating, review, plot_rating, cinematography_rating, acting_rating, soundtrack_rating, pacing_rating, casting_rating, watched_date",
      )
      .eq("user_id", userId)
      .order("watched_date", { ascending: false }),
    supabase.from("watchlist").select("tmdb_id, media_type").eq("user_id", userId),
    supabase.from("taste_dna").select("fingerprint, film_profile, blind_spots").eq("user_id", userId).maybeSingle(),
  ]);
  if (logsRes.error) throw new Error(`watch_logs read failed: ${logsRes.error.message}`);
  if (watchlistRes.error) throw new Error(`watchlist read failed: ${watchlistRes.error.message}`);
  const logs = (logsRes.data ?? []) as WatchLogRow[];

  // Old rows stored a bare array; only the { items } shape is valid.
  const cachedFilm = cache?.recommendations as { items?: FilmRecommendation[]; shown?: ShownFilm[] } | undefined;
  if (!refresh && cachedFilm && Array.isArray(cachedFilm.items) && isCacheValid(cache, logs.length, new Date())) {
    return { status: cachedFilm.items.length ? "ok" : "empty", items: cachedFilm.items };
  }

  // A refresh asks for something new, so it keeps out what was recommended recently.
  // Any other rebuild (a new log, an expired cache) starts the history again.
  const avoid =
    refresh && cachedFilm && Array.isArray(cachedFilm.items)
      ? nextShownHistory(cachedFilm.items, Array.isArray(cachedFilm.shown) ? cachedFilm.shown : [])
      : [];

  const result = await buildFilmRecs({
    logs,
    watchlist: watchlistRes.data ?? [],
    tasteDNA: dnaRes.data ?? null,
    yearsOf: (all) => fetchLogYears(all, (type, id) => (type === "movie" ? getMovieDetails(id) : getTvDetails(id))),
    gather: gatherFilmCandidates,
    lookup: makeFilmLookup(searchByTitleYear),
    ai: makeAI<{ picks: RawFilmPick[] }>({ supabase, userId, tool: filmRecommendTool }),
    avoid,
  });

  if (result.status === "ok" || result.status === "empty") {
    const shown = nextShownHistory(result.items, avoid);
    await writeCache(supabase, userId, FILM_MODE, { items: result.items, shown }, logs.length, result.status);
  }
  return result;
}

async function musicRecs(supabase: Supabase, userId: string, refresh: boolean): Promise<MusicRecsResponse> {
  const [cache, logsRes, queueRes, dnaRes] = await Promise.all([
    readCache(supabase, userId, MUSIC_MODE),
    supabase
      .from("listen_logs")
      .select(
        "spotify_id, title, artist, media_type, rating, review, lyrics_rating, production_rating, vocals_rating, melody_rating, replay_rating, energy_rating",
      )
      .eq("user_id", userId)
      .order("listened_date", { ascending: false }),
    supabase.from("music_queue").select("spotify_id, title, artist").eq("user_id", userId),
    supabase.from("taste_dna").select("fingerprint, music_profile").eq("user_id", userId).maybeSingle(),
  ]);
  if (logsRes.error) throw new Error(`listen_logs read failed: ${logsRes.error.message}`);
  if (queueRes.error) throw new Error(`music_queue read failed: ${queueRes.error.message}`);
  const logs = (logsRes.data ?? []) as ListenLogRow[];

  // Old rows stored a bare array; only the { items, right_now } shape is valid.
  const cached = cache?.recommendations as { items?: MusicRecommendation[]; right_now?: RightNow | null } | undefined;
  if (!refresh && cached && Array.isArray(cached.items) && isCacheValid(cache, logs.length, new Date())) {
    return { status: cached.items.length ? "ok" : "empty", items: cached.items, right_now: cached.right_now ?? null };
  }

  let tops: SpotifyTops | null = null;
  try {
    const token = await getValidToken(supabase, userId);
    if (token) tops = await fetchSpotifyTops(token);
  } catch (e) {
    console.error("Spotify tops fetch failed, continuing without it:", e);
    // Spotify listening is optional context; carry on without it.
  }

  const result = await buildMusicRecs({
    logs,
    queue: queueRes.data ?? [],
    tops,
    tasteDNA: dnaRes.data ?? null,
    search: searchSpotify,
    ai: makeAI<{ recommendations: MusicRecommendation[] }>({ supabase, userId, tool: musicRecommendTool }),
  });

  if (result.status === "ok" || result.status === "empty") {
    await writeCache(
      supabase,
      userId,
      MUSIC_MODE,
      { items: result.items, right_now: result.right_now },
      logs.length,
      result.status,
    );
  }
  return result;
}
