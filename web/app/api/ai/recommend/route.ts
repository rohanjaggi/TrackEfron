import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { filmRecommendTool, musicRecommendTool } from "@/lib/ai/tools";
import type {
  FilmRecommendation,
  MusicRecommendation,
  MusicRecsResponse,
  RawFilmPick,
  RecsResponse,
  RightNow,
} from "@/lib/ai/types";
import { AIError, makeAI } from "@/lib/recs/ai-call";
import { CACHE_DAYS, isCacheValid } from "@/lib/recs/cache";
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
    return NextResponse.json({ error: "Failed to generate recommendations", code: "PROVIDER_ERROR" }, { status: 500 });
  }
}

async function readCache(supabase: Supabase, userId: string, mode: "film" | "music"): Promise<CacheRow | null> {
  const { data } = await supabase
    .from("ai_recommendation_cache")
    .select("recommendations, expires_at, log_count_at_generation")
    .eq("user_id", userId)
    .eq("mode", mode)
    .maybeSingle();
  return (data as CacheRow | null) ?? null;
}

async function writeCache(
  supabase: Supabase,
  userId: string,
  mode: "film" | "music",
  recommendations: unknown,
  logCount: number,
) {
  const now = new Date();
  await supabase.from("ai_recommendation_cache").upsert(
    {
      user_id: userId,
      mode,
      recommendations,
      generated_at: now.toISOString(),
      log_count_at_generation: logCount,
      expires_at: new Date(now.getTime() + CACHE_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    },
    { onConflict: "user_id,mode" },
  );
}

async function filmRecs(supabase: Supabase, userId: string, refresh: boolean): Promise<RecsResponse<FilmRecommendation>> {
  const [cache, logsRes, watchlistRes, dnaRes] = await Promise.all([
    readCache(supabase, userId, "film"),
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
  const logs = (logsRes.data ?? []) as WatchLogRow[];

  if (!refresh && Array.isArray(cache?.recommendations) && isCacheValid(cache, logs.length, new Date())) {
    return { status: "ok", items: cache!.recommendations as FilmRecommendation[] };
  }

  const result = await buildFilmRecs({
    logs,
    watchlist: watchlistRes.data ?? [],
    tasteDNA: dnaRes.data ?? null,
    yearsOf: (all) => fetchLogYears(all, (type, id) => (type === "movie" ? getMovieDetails(id) : getTvDetails(id))),
    gather: gatherFilmCandidates,
    lookup: makeFilmLookup(searchByTitleYear),
    ai: makeAI<{ picks: RawFilmPick[] }>({ supabase, userId, tool: filmRecommendTool }),
  });

  if (result.status === "ok") await writeCache(supabase, userId, "film", result.items, logs.length);
  return result;
}

async function musicRecs(supabase: Supabase, userId: string, refresh: boolean): Promise<MusicRecsResponse> {
  const [cache, logsRes, queueRes, dnaRes] = await Promise.all([
    readCache(supabase, userId, "music"),
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
  const logs = (logsRes.data ?? []) as ListenLogRow[];

  // Old rows stored a bare array; only the { items, right_now } shape is valid.
  const cached = cache?.recommendations as { items?: MusicRecommendation[]; right_now?: RightNow | null } | undefined;
  if (!refresh && cached && Array.isArray(cached.items) && isCacheValid(cache, logs.length, new Date())) {
    return { status: "ok", items: cached.items, right_now: cached.right_now ?? null };
  }

  let tops = null;
  try {
    const token = await getValidToken(supabase, userId);
    if (token) tops = await fetchSpotifyTops(token);
  } catch {
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

  if (result.status === "ok") {
    await writeCache(supabase, userId, "music", { items: result.items, right_now: result.right_now }, logs.length);
  }
  return result;
}
