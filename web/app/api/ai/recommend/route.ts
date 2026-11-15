import { requireUser, type ServerSupabase as Supabase } from "@/lib/api/auth";
import { aiErrorStatus } from "@/lib/api/ai-status";
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
import { isCacheValid, nextShownHistory, readCache, writeCache, type ShownFilm } from "@/lib/recs/cache";
import { buildFilmRecs } from "@/lib/recs/film/build";
import { gatherFilmCandidates } from "@/lib/recs/film/candidates";
import { makeFilmLookup } from "@/lib/recs/film/lookup";
import type { WatchLogRow } from "@/lib/recs/film/select-logs";
import { fetchLogYears } from "@/lib/recs/film/years";
import { buildMusicRecs, type ListenLogRow } from "@/lib/recs/music/build";
import { fetchSpotifyTops } from "@/lib/recs/music/tops";
import { fetchRecentPlays, type RawPlay } from "@/lib/spotify/recent";
import { getValidToken } from "@/lib/spotify/pkce";
import { searchSpotify } from "@/lib/spotify/spotify";
import { getDetails, searchByTitleYear } from "@/lib/tmdb/tmdb";

export const maxDuration = 300;

// The film cache keeps its existing mode value because the repo has no schema file to confirm a new one is allowed.
const FILM_MODE = "film_explanations";
const MUSIC_MODE = "music";


export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") || "music";
  const refresh = searchParams.get("refresh") === "true";

  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { supabase, user } = auth;
  if (mode !== "film" && mode !== "music") {
    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  }

  try {
    const body = mode === "film" ? await filmRecs(supabase, user.id, refresh) : await musicRecs(supabase, user.id, refresh);
    return NextResponse.json(body);
  } catch (e) {
    if (e instanceof AIError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: aiErrorStatus(e.code) });
    }
    console.error("recommend route failed:", e);
    return NextResponse.json({ error: "Failed to generate recommendations", code: "PROVIDER_ERROR" }, { status: 500 });
  }
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
    yearsOf: (all) => fetchLogYears(all, getDetails),
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
  let recent: RawPlay[] | null = null;
  try {
    const token = await getValidToken(supabase, userId);
    if (token) {
      // Spotify listening is optional context; each part fails independently.
      [tops, recent] = await Promise.all([
        fetchSpotifyTops(token).catch((e) => {
          console.error("Spotify tops fetch failed, continuing without it:", e);
          return null;
        }),
        fetchRecentPlays(token).catch((e) => {
          console.error("Spotify recent plays fetch failed, continuing without it:", e);
          return null;
        }),
      ]);
    }
  } catch (e) {
    console.error("Spotify token lookup failed, continuing without Spotify:", e);
  }

  const result = await buildMusicRecs({
    logs,
    queue: queueRes.data ?? [],
    tops,
    recent,
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
