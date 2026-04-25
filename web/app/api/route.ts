import { searchMovieByName, searchSeriesByName, getTrending, getPoster, searchMulti, getMovieDetails, getTvDetails, getMovieProviders, getTvProviders, getNowPlaying, getUpcoming, getTopRated, discoverByGenre, getSimilar, getPersonCredits } from "@/lib/tmdb/tmdb";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  if (action === "trending") {
    try {
      const results = await getTrending();
      const enrichedResults = results.map((result: any) => ({
        ...result,
        poster_url: result.poster_path ? getPoster(result.poster_path, "w342") : null,
      }));
      return NextResponse.json(enrichedResults);
    } catch (error: any) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  if (action === "search") {
    const query = searchParams.get("q") || "";
    if (!query.trim()) {
      return NextResponse.json([]);
    }
    try {
      const results = await searchMulti(query);
      const enrichedResults = results.map((result: any) => ({
        ...result,
        poster_url: result.poster_path ? getPoster(result.poster_path, "w92") : null,
      }));
      return NextResponse.json(enrichedResults);
    } catch (error: any) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  if (action === "detail") {
    const id = Number(searchParams.get("id"));
    const type = searchParams.get("type");
    if (!id || (type !== "movie" && type !== "tv")) {
      return NextResponse.json({ error: "Invalid id or type" }, { status: 400 });
    }
    try {
      const detail = type === "movie" ? await getMovieDetails(id) : await getTvDetails(id);
      const enriched = {
        ...detail,
        poster_url: detail.poster_path ? getPoster(detail.poster_path, "w500") : null,
        backdrop_url: detail.backdrop_path ? getPoster(detail.backdrop_path, "w1280") : null,
      };
      return NextResponse.json(enriched);
    } catch (error: any) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  if (action === "providers") {
    const id = Number(searchParams.get("id"));
    const type = searchParams.get("type");
    if (!id || (type !== "movie" && type !== "tv")) {
      return NextResponse.json({ error: "Invalid id or type" }, { status: 400 });
    }
    try {
      const results = type === "movie" ? await getMovieProviders(id) : await getTvProviders(id);
      return NextResponse.json(results || {});
    } catch (error: any) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  if (action === "now_playing") {
    try {
      const results = await getNowPlaying();
      const enriched = results.map((r: any) => ({
        ...r,
        media_type: "movie",
        poster_url: r.poster_path ? getPoster(r.poster_path, "w342") : null,
      }));
      return NextResponse.json(enriched);
    } catch (error: any) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  if (action === "upcoming") {
    try {
      const results = await getUpcoming();
      const enriched = results.map((r: any) => ({
        ...r,
        media_type: "movie",
        poster_url: r.poster_path ? getPoster(r.poster_path, "w342") : null,
      }));
      return NextResponse.json(enriched);
    } catch (error: any) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  if (action === "top_rated") {
    const type = (searchParams.get("type") || "movie") as "movie" | "tv";
    try {
      const results = await getTopRated(type);
      const enriched = results.map((r: any) => ({
        ...r,
        media_type: type,
        poster_url: r.poster_path ? getPoster(r.poster_path, "w342") : null,
      }));
      return NextResponse.json(enriched);
    } catch (error: any) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  if (action === "discover") {
    const type = (searchParams.get("type") || "movie") as "movie" | "tv";
    const genres = searchParams.get("genres") || "";
    if (!genres) {
      return NextResponse.json({ error: "genres param required" }, { status: 400 });
    }
    try {
      const results = await discoverByGenre(type, genres);
      const enriched = results.map((r: any) => ({
        ...r,
        media_type: type,
        poster_url: r.poster_path ? getPoster(r.poster_path, "w342") : null,
      }));
      return NextResponse.json(enriched);
    } catch (error: any) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  if (action === "similar") {
    const type = searchParams.get("type") as "movie" | "tv";
    const id = Number(searchParams.get("id"));
    if (!id || (type !== "movie" && type !== "tv")) {
      return NextResponse.json({ error: "Invalid id or type" }, { status: 400 });
    }
    try {
      const results = await getSimilar(type, id);
      const enriched = results.map((r: any) => ({
        ...r,
        media_type: r.media_type || type,
        poster_url: r.poster_path ? getPoster(r.poster_path, "w342") : null,
      }));
      return NextResponse.json(enriched);
    } catch (error: any) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  if (action === "recommend") {
    const userId = searchParams.get("user_id");
    if (!userId) return NextResponse.json([]);
    const mlApiUrl = process.env.ML_API_URL || "http://localhost:8000";
    try {
      const mlRes = await fetch(`${mlApiUrl}/recommend/${userId}/items`, {
        signal: AbortSignal.timeout(10000),
        cache: "no-store",
      });
      if (!mlRes.ok) return NextResponse.json([]);
      const { items } = await mlRes.json();
      if (!Array.isArray(items) || items.length === 0) return NextResponse.json([]);
      const enriched = await Promise.all(
        items.map(async ({ tmdb_id, media_type }: { tmdb_id: number; media_type: string }) => {
          try {
            const d = media_type === "movie"
              ? await getMovieDetails(tmdb_id)
              : await getTvDetails(tmdb_id);
            return {
              id: tmdb_id,
              media_type,
              title: d.title || d.name || "Untitled",
              poster_url: d.poster_path ? getPoster(d.poster_path, "w342") : null,
              vote_average: d.vote_average || null,
              release_date: d.release_date || d.first_air_date || null,
            };
          } catch {
            return null;
          }
        })
      );
      return NextResponse.json(enriched.filter(Boolean));
    } catch {
      return NextResponse.json([]);
    }
  }

  if (action === "person_credits") {
    const id = Number(searchParams.get("id"));
    if (!id) {
      return NextResponse.json({ error: "Invalid person id" }, { status: 400 });
    }
    try {
      const data = await getPersonCredits(id);
      const allCredits = [...(data.cast || []), ...(data.crew || [])];
      const seen = new Set<string>();
      const unique = allCredits.filter((c: any) => {
        const key = `${c.media_type}-${c.id}`;
        if (seen.has(key)) return false;
        if (!c.media_type || (c.media_type !== "movie" && c.media_type !== "tv")) return false;
        if ((c.vote_count || 0) < 10) return false;
        seen.add(key);
        return true;
      });
      const enriched = unique
        .sort((a: any, b: any) => (b.vote_average || 0) - (a.vote_average || 0))
        .slice(0, 20)
        .map((c: any) => ({
          ...c,
          poster_url: c.poster_path ? getPoster(c.poster_path, "w342") : null,
        }));
      return NextResponse.json(enriched);
    } catch (error: any) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  const query = searchParams.get("q") || "Inception";
  const type = searchParams.get("type") || "movie";

  try {
    const results =
      type === "tv"
        ? await searchSeriesByName(query)
        : await searchMovieByName(query);
    const enrichedResults = results.map((result: any) => ({
      ...result,
      poster_url: result.poster_path ? getPoster(result.poster_path, "w92") : null,
    }));
    return NextResponse.json(enrichedResults);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  if (action === "refresh_profile") {
    const mlApiUrl = process.env.ML_API_URL || "http://localhost:8000";
    try {
      const res = await fetch(`${mlApiUrl}/refresh-profile`, {
        method: "POST",
        signal: AbortSignal.timeout(120000), // 2 min max
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return NextResponse.json({ error: (err as any).detail || "refresh failed" }, { status: 500 });
      }
      return NextResponse.json({ status: "ok" });
    } catch {
      return NextResponse.json({ error: "ML backend unavailable" }, { status: 503 });
    }
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
