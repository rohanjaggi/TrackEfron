import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { callAI } from "@/lib/ai/provider";
import { vibeSearchTool } from "@/lib/ai/tools";
import { VIBE_SEARCH_SYSTEM, buildVibeSearchUserPrompt } from "@/lib/ai/prompts";
import { searchSpotify } from "@/lib/spotify/spotify";
import type { VibeSearchResult, VibeSearchResponse } from "@/lib/ai/types";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { query, mode } = body as { query: string; mode: "music" | "film" };

  if (!query || !mode) {
    return NextResponse.json({ error: "Missing query or mode" }, { status: 400 });
  }

  const { data: dnaData } = await supabase
    .from("taste_dna")
    .select("fingerprint")
    .eq("user_id", user.id)
    .single();

  let recentItems: string[] = [];
  if (mode === "music") {
    const { data } = await supabase
      .from("listen_logs")
      .select("title, artist")
      .eq("user_id", user.id)
      .order("listened_date", { ascending: false })
      .limit(10);
    recentItems = (data || []).map((l: any) => `${l.title} by ${l.artist}`);
  } else {
    const { data } = await supabase
      .from("watch_logs")
      .select("title")
      .eq("user_id", user.id)
      .order("watched_date", { ascending: false })
      .limit(10);
    recentItems = (data || []).map((w: any) => w.title);
  }

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
    toolName: "vibe_search",
    userMessage: userPrompt,
  });

  if ("error" in result) {
    const status = result.code === "NO_API_KEY" ? 402 : 500;
    return NextResponse.json({ error: result.error, code: result.code }, { status });
  }

  const aiResponse = result.data as VibeSearchResponse;

  const validated: VibeSearchResult[] = [];

  for (const item of aiResponse.results) {
    if (validated.length >= 12) break;

    if (mode === "music") {
      try {
        const searchQ = item.artist ? `${item.artist} ${item.title}` : item.title;
        const spotifyResults = await searchSpotify(searchQ, item.type as "album" | "track", 3);
        const match = spotifyResults[0];
        if (match) {
          validated.push({
            ...item,
            spotify_id: match.id,
            image_url: match.image_url,
            title: match.name,
            artist: match.artist,
          });
        }
      } catch {
        // skip
      }
    } else {
      try {
        const mediaType = item.type === "tv" ? "tv" : "movie";
        const tmdbRes = await fetch(
          `https://api.themoviedb.org/3/search/${mediaType}?query=${encodeURIComponent(item.title)}${item.year ? `&year=${item.year}` : ""}`,
          {
            headers: {
              Authorization: `Bearer ${process.env.TMDB_BEARER_TOKEN}`,
            },
            signal: AbortSignal.timeout(5000),
          }
        );
        if (tmdbRes.ok) {
          const data = await tmdbRes.json();
          const match = data.results?.[0];
          if (match) {
            validated.push({
              ...item,
              tmdb_id: match.id,
              title: match.title || match.name,
              poster_url: match.poster_path
                ? `https://image.tmdb.org/t/p/w185${match.poster_path}`
                : null,
            });
          }
        }
      } catch {
        // skip
      }
    }
  }

  return NextResponse.json({
    interpretation: aiResponse.interpretation,
    results: validated,
  });
}
