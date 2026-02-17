import { searchMovieByName, searchSeriesByName, getPoster } from "@/lib/tmdb/tmdb";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
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
