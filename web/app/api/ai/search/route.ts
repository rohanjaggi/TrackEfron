import { requireUser } from "@/lib/api/auth";
import { aiErrorStatus } from "@/lib/api/ai-status";
import { NextResponse } from "next/server";
import { callAI } from "@/lib/ai/provider";
import { vibeSearchTool } from "@/lib/ai/tools";
import { VIBE_SEARCH_SYSTEM, buildVibeSearchUserPrompt } from "@/lib/ai/prompts";
import { searchSpotify } from "@/lib/spotify/spotify";
import { getPoster, tmdbGet, type TmdbResult } from "@/lib/tmdb/tmdb";
import { mapBounded } from "@/lib/recs/map-bounded";
import type { VibeSearchResult, VibeSearchResponse } from "@/lib/ai/types";

export const maxDuration = 60;

const MAX_RESULTS = 12;
const LOOKUP_CONCURRENCY = 5;

/** The AI's pick matched to a real Spotify or TMDB entry, or null when the lookup fails or finds nothing. */
async function resolveItem(mode: "music" | "film", item: VibeSearchResult): Promise<VibeSearchResult | null> {
  try {
    if (mode === "music") {
      const searchQ = item.artist ? `${item.artist} ${item.title}` : item.title;
      const spotifyResults = await searchSpotify(searchQ, item.type === "track" ? "track" : "album", 3);
      const match = spotifyResults[0];
      if (!match) return null;
      return {
        ...item,
        spotify_id: match.id,
        image_url: match.image_url,
        title: match.name,
        artist: match.artist,
      };
    }
    const mediaType = item.type === "tv" ? "tv" : "movie";
    const data = await tmdbGet<{ results?: TmdbResult[] }>(
      `/search/${mediaType}`,
      item.year ? { query: item.title, year: item.year } : { query: item.title },
      { signal: AbortSignal.timeout(5000) },
    );
    const match = data.results?.[0];
    if (!match) return null;
    return {
      ...item,
      tmdb_id: match.id,
      title: match.title || match.name || item.title,
      poster_url: match.poster_path ? getPoster(match.poster_path, "w342") : null,
    };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { supabase, user } = auth;

  const body = await request.json();
  const { query, mode } = body as { query: string; mode: "music" | "film" };

  if (!query || !mode) {
    return NextResponse.json({ error: "Missing query or mode" }, { status: 400 });
  }

  const recentQuery =
    mode === "music"
      ? supabase
          .from("listen_logs")
          .select("title, artist")
          .eq("user_id", user.id)
          .order("listened_date", { ascending: false })
          .limit(10)
          .then(({ data }) => (data || []).map((l) => `${l.title} by ${l.artist}`))
      : supabase
          .from("watch_logs")
          .select("title")
          .eq("user_id", user.id)
          .order("watched_date", { ascending: false })
          .limit(10)
          .then(({ data }) => (data || []).map((w) => w.title));

  const [{ data: dnaData }, recentItems] = await Promise.all([
    supabase.from("taste_dna").select("fingerprint").eq("user_id", user.id).single(),
    recentQuery,
  ]);

  const userPrompt = buildVibeSearchUserPrompt({
    query,
    mode,
    tasteDNA: dnaData,
    recentItems,
  });

  const result = await callAI({
    supabase,
    userId: user.id,
    tier: "fastest",
    maxTokens: 2000,
    system: VIBE_SEARCH_SYSTEM,
    tool: vibeSearchTool,
    userMessage: userPrompt,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error, code: result.code }, { status: aiErrorStatus(result.code) });
  }

  const aiResponse = result.data as VibeSearchResponse;

  const allowedTypes: readonly string[] = mode === "music" ? ["album", "track"] : ["movie", "tv"];
  const modeResults = (Array.isArray(aiResponse.results) ? aiResponse.results : []).filter(
    (item) => allowedTypes.includes(item.type),
  );

  // Items whose lookup fails or finds nothing are skipped, and the next ones fill their place up to
  // MAX_RESULTS. Each wave looks up only as many items as there are places left to fill.
  const validated: VibeSearchResult[] = [];
  for (let offset = 0; validated.length < MAX_RESULTS && offset < modeResults.length; ) {
    const wave = modeResults.slice(offset, offset + (MAX_RESULTS - validated.length));
    offset += wave.length;
    const found = await mapBounded(wave, LOOKUP_CONCURRENCY, (item) => resolveItem(mode, item));
    for (const f of found) if (f) validated.push(f);
  }

  return NextResponse.json({
    interpretation: aiResponse.interpretation,
    results: validated,
  });
}
