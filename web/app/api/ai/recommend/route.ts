import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { callAI } from "@/lib/ai/provider";
import { musicRecommendTool, filmVerifyTool } from "@/lib/ai/tools";
import {
  MUSIC_RECOMMEND_SYSTEM,
  FILM_VERIFY_SYSTEM,
  buildMusicRecommendUserPrompt,
  buildFilmVerifyUserPrompt,
} from "@/lib/ai/prompts";
import { searchSpotify } from "@/lib/spotify/spotify";
import type { MusicRecommendation, FilmRecommendation } from "@/lib/ai/types";

const CACHE_TTL_HOURS = 24;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") || "music";
  const noCache = searchParams.get("refresh") === "true";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (mode === "music") {
    return handleMusicRecommendations(supabase, user.id, noCache);
  } else if (mode === "film") {
    return handleFilmRecommendations(supabase, user.id, noCache);
  }

  return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
}

async function handleMusicRecommendations(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  noCache: boolean
) {
  if (!noCache) {
    const { data: cached } = await supabase
      .from("ai_recommendation_cache")
      .select("*")
      .eq("user_id", userId)
      .eq("mode", "music")
      .single();

    if (cached && new Date(cached.expires_at) > new Date()) {
      return NextResponse.json(cached.recommendations);
    }
  }

  const [listenRes, queueRes, dnaRes] = await Promise.all([
    supabase.from("listen_logs").select("title, artist, rating, media_type, lyrics_rating, production_rating, vocals_rating, melody_rating, replay_rating, energy_rating").eq("user_id", userId).order("listened_date", { ascending: false }),
    supabase.from("music_queue").select("title, artist").eq("user_id", userId),
    supabase.from("taste_dna").select("fingerprint, music_profile").eq("user_id", userId).single(),
  ]);

  const listenLogs = listenRes.data || [];
  const musicQueue = queueRes.data || [];
  const tasteDNA = dnaRes.data
    ? { fingerprint: dnaRes.data.fingerprint, music_identity: dnaRes.data.music_profile }
    : null;

  if (listenLogs.length === 0) {
    return NextResponse.json([]);
  }

  const userPrompt = buildMusicRecommendUserPrompt({
    tasteDNA,
    listenLogs,
    musicQueue,
  });

  const result = await callAI({
    supabase,
    userId,
    tier: "fast",
    maxTokens: 3000,
    system: MUSIC_RECOMMEND_SYSTEM,
    tool: musicRecommendTool,
    toolName: "recommend_music",
    userMessage: userPrompt,
  });

  if ("error" in result) {
    const status = result.code === "NO_API_KEY" ? 402 : 500;
    return NextResponse.json({ error: result.error, code: result.code }, { status });
  }

  const { recommendations } = result.data as { recommendations: MusicRecommendation[] };

  const validated: MusicRecommendation[] = [];
  for (const rec of recommendations) {
    if (validated.length >= 20) break;
    try {
      const results = await searchSpotify(`${rec.artist} ${rec.title}`, rec.type, 3);
      const match = results.find((r) => {
        const titleMatch = normalize(r.name).includes(normalize(rec.title)) || normalize(rec.title).includes(normalize(r.name));
        const artistMatch = normalize(r.artist).includes(normalize(rec.artist)) || normalize(rec.artist).includes(normalize(r.artist));
        return titleMatch && artistMatch;
      }) || results[0];

      if (match) {
        validated.push({
          ...rec,
          spotify_id: match.id,
          image_url: match.image_url,
          title: match.name,
          artist: match.artist,
          album_name: match.album_name,
          type: match.type,
        });
      }
    } catch {
      // Spotify search failed for this rec — skip it
    }
  }

  const expiresAt = new Date(Date.now() + CACHE_TTL_HOURS * 60 * 60 * 1000).toISOString();
  await supabase.from("ai_recommendation_cache").upsert(
    {
      user_id: userId,
      mode: "music",
      recommendations: validated,
      generated_at: new Date().toISOString(),
      log_count_at_generation: listenLogs.length,
      expires_at: expiresAt,
    },
    { onConflict: "user_id,mode" }
  );

  return NextResponse.json(validated);
}

async function handleFilmRecommendations(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  noCache: boolean
) {
  if (!noCache) {
    const { data: cached } = await supabase
      .from("ai_recommendation_cache")
      .select("*")
      .eq("user_id", userId)
      .eq("mode", "film_explanations")
      .single();

    if (cached && new Date(cached.expires_at) > new Date()) {
      return NextResponse.json(cached.recommendations);
    }
  }

  const mlApiUrl = process.env.ML_API_URL || "http://localhost:8000";
  let mlCandidates: { tmdb_id: number; title: string; media_type: string; poster_url?: string }[] = [];
  try {
    const mlRes = await fetch(`${mlApiUrl}/recommend/${userId}/items?limit=35`, {
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });
    if (mlRes.ok) {
      const { items } = await mlRes.json();
      mlCandidates = Array.isArray(items) ? items : [];
    }
  } catch {
    // ML server may not be running
  }

  if (mlCandidates.length === 0) {
    return NextResponse.json([]);
  }

  const [watchRes, dnaRes] = await Promise.all([
    supabase.from("watch_logs").select("title, rating, review, media_type, plot_rating, cinematography_rating, acting_rating, soundtrack_rating, pacing_rating, casting_rating").eq("user_id", userId).order("watched_date", { ascending: false }),
    supabase.from("taste_dna").select("fingerprint, film_profile").eq("user_id", userId).single(),
  ]);

  const watchLogs = watchRes.data || [];
  const tasteDNA = dnaRes.data
    ? { fingerprint: dnaRes.data.fingerprint, film_identity: dnaRes.data.film_profile }
    : null;

  const userPrompt = buildFilmVerifyUserPrompt({
    tasteDNA,
    watchLogs,
    mlCandidates,
  });

  const result = await callAI({
    supabase,
    userId,
    tier: "fast",
    maxTokens: 4000,
    system: FILM_VERIFY_SYSTEM,
    tool: filmVerifyTool,
    toolName: "verify_film_recommendations",
    userMessage: userPrompt,
  });

  if ("error" in result) {
    // Fall back to ML recs without AI enrichment
    return NextResponse.json(
      mlCandidates.slice(0, 20).map((c) => ({
        ...c,
        explanation: "",
        source: "ml",
      }))
    );
  }

  const { verified } = result.data as { verified: FilmRecommendation[] };

  const final: FilmRecommendation[] = [];
  for (const rec of verified) {
    if (final.length >= 20) break;

    if (rec.source === "ml" && rec.tmdb_id) {
      const original = mlCandidates.find((c) => c.tmdb_id === rec.tmdb_id);
      final.push({
        ...rec,
        poster_url: original?.poster_url || null,
      });
    } else if (rec.source === "ai") {
      try {
        const tmdbRes = await fetch(
          `https://api.themoviedb.org/3/search/${rec.media_type === "tv" ? "tv" : "movie"}?query=${encodeURIComponent(rec.title)}&year=${rec.year || ""}`,
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
            final.push({
              ...rec,
              tmdb_id: match.id,
              poster_url: match.poster_path
                ? `https://image.tmdb.org/t/p/w185${match.poster_path}`
                : null,
            });
            continue;
          }
        }
      } catch {
        // TMDB search failed — skip this AI suggestion
      }
    } else {
      final.push(rec);
    }
  }

  const expiresAt = new Date(Date.now() + CACHE_TTL_HOURS * 60 * 60 * 1000).toISOString();
  await supabase.from("ai_recommendation_cache").upsert(
    {
      user_id: userId,
      mode: "film_explanations",
      recommendations: final,
      generated_at: new Date().toISOString(),
      log_count_at_generation: watchLogs.length,
      expires_at: expiresAt,
    },
    { onConflict: "user_id,mode" }
  );

  return NextResponse.json(final);
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
}
