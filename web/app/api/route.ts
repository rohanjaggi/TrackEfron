import {
  discoverByGenre,
  getDetails,
  getNowPlaying,
  getPoster,
  getProviders,
  getTopRated,
  getTrending,
  searchMulti,
  type MediaType,
  type TmdbResult,
} from "@/lib/tmdb/tmdb";
import { NextResponse } from "next/server";

type Handler = (params: URLSearchParams) => Promise<unknown>;

class BadRequest extends Error {}

const GENRES_PATTERN = /^\d+(,\d+)*$/;

function mediaType(params: URLSearchParams, fallback?: MediaType): MediaType {
  const type = params.get("type") ?? fallback;
  if (type !== "movie" && type !== "tv") throw new BadRequest("Invalid type");
  return type;
}

function id(params: URLSearchParams): number {
  const value = Number(params.get("id"));
  if (!value) throw new BadRequest("Invalid id");
  return value;
}

const withPoster = <T extends TmdbResult>(item: T, extra: Record<string, unknown> = {}) => ({
  ...item,
  ...extra,
  poster_url: item.poster_path ? getPoster(item.poster_path, "w342") : null,
});

const handlers: Record<string, Handler> = {
  // TMDB trending can include people; keep films and TV only.
  trending: async () =>
    (await getTrending())
      .filter((r) => r.media_type === "movie" || r.media_type === "tv")
      .map((r) => withPoster(r)),

  search: async (params) => {
    const query = params.get("q") || "";
    if (!query.trim()) return [];
    return (await searchMulti(query)).map((r) => withPoster(r));
  },

  detail: async (params) => {
    const type = mediaType(params);
    const detail = await getDetails(type, id(params));
    return {
      ...detail,
      poster_url: detail.poster_path ? getPoster(detail.poster_path, "w500") : null,
      backdrop_url: detail.backdrop_path ? getPoster(detail.backdrop_path, "w1280") : null,
    };
  },

  providers: async (params) => {
    const type = mediaType(params);
    const results = await getProviders(type, id(params));
    return results || {};
  },

  now_playing: async () => (await getNowPlaying()).map((r) => withPoster(r, { media_type: "movie" })),

  top_rated: async (params) => {
    const type = mediaType(params, "movie");
    return (await getTopRated(type)).map((r) => withPoster(r, { media_type: type }));
  },

  discover: async (params) => {
    const type = mediaType(params, "movie");
    const genres = params.get("genres") || "";
    if (!genres) throw new BadRequest("genres param required");
    if (!GENRES_PATTERN.test(genres)) throw new BadRequest("Invalid genres");
    return (await discoverByGenre(type, genres)).map((r) => withPoster(r, { media_type: type }));
  },
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  const handler = action && Object.hasOwn(handlers, action) ? handlers[action] : null;
  if (!handler) {
    return NextResponse.json({ error: "Unknown or missing action" }, { status: 400 });
  }

  try {
    return NextResponse.json(await handler(searchParams));
  } catch (error) {
    if (error instanceof BadRequest) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
