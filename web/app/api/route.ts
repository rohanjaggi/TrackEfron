import { searchMovieByName, searchSeriesByName, getTrending, getPoster, searchMulti, getMovieDetails, getTvDetails } from "@/lib/tmdb/tmdb";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  if (action === "trending") {
    try {
      const results = await getTrending();
      const enrichedResults = results.map((result: any) => ({
        ...result,
        poster_url: result.poster_path ? getPoster(result.poster_path, "w185") : null,
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
