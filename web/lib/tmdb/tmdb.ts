const baseUrl = "https://api.themoviedb.org/3";

type Params = Record<string, string | number>;
type MediaType = "movie" | "tv";

/** A TMDB list or search hit. Only the fields the app reads are named. */
export interface TmdbResult {
    id: number;
    media_type?: string;
    title?: string;
    name?: string;
    original_title?: string;
    original_name?: string;
    overview?: string;
    poster_path?: string | null;
    backdrop_path?: string | null;
    release_date?: string;
    first_air_date?: string;
    genre_ids?: number[];
    vote_average?: number;
    vote_count?: number;
}

export interface TmdbDetail extends TmdbResult {
    genres?: { id: number; name: string }[];
    credits?: { cast?: unknown[]; crew?: unknown[] };
}

export interface TmdbPersonCredits {
    cast?: TmdbResult[];
    crew?: TmdbResult[];
}

interface TmdbList {
    results: TmdbResult[];
}

/** Authenticated GET against the TMDB v3 API (Bearer token only). */
export async function tmdbGet<T>(
    path: string,
    params: Params = {},
    options: { signal?: AbortSignal } = {},
): Promise<T> {
    const query = new URLSearchParams(
        Object.entries(params).map(([key, value]) => [key, String(value)]),
    ).toString();
    const response = await fetch(`${baseUrl}${path}${query ? `?${query}` : ""}`, {
        headers: {
            Authorization: `Bearer ${process.env.TMDB_BEARER_TOKEN}`,
            "Content-Type": "application/json",
        },
        signal: options.signal,
    });
    if (!response.ok) {
        throw new Error(`TMDB API error: ${response.status} ${response.statusText}`);
    }
    return response.json() as Promise<T>;
}

async function listResults(path: string, params?: Params): Promise<TmdbResult[]> {
    return (await tmdbGet<TmdbList>(path, params)).results;
}

export function getPoster(posterPath: string, size: string = "w500") {
    return `https://image.tmdb.org/t/p/${size}${posterPath}`;
}

export async function searchMulti(query: string) {
    const results = await listResults("/search/multi", { query, include_adult: "false" });
    return results.filter((r) => r.media_type === "movie" || r.media_type === "tv");
}

export function getMovieDetails(id: number) {
    return tmdbGet<TmdbDetail>(`/movie/${id}`, { append_to_response: "credits" });
}

export function getTvDetails(id: number) {
    return tmdbGet<TmdbDetail>(`/tv/${id}`, { append_to_response: "credits" });
}

export function getTrending() {
    return listResults("/trending/all/day");
}

async function getProviders(type: MediaType, id: number) {
    const data = await tmdbGet<{ results?: Record<string, unknown> }>(`/${type}/${id}/watch/providers`);
    return data.results;
}

export const getMovieProviders = (id: number) => getProviders("movie", id);
export const getTvProviders = (id: number) => getProviders("tv", id);

export function getNowPlaying() {
    return listResults("/movie/now_playing", { language: "en-US", page: 1 });
}

export function getUpcoming() {
    return listResults("/movie/upcoming", { language: "en-US", page: 1 });
}

export function getTopRated(type: MediaType) {
    return listResults(`/${type}/top_rated`, { language: "en-US", page: 1 });
}

export function discoverByGenre(type: MediaType, genreIds: string) {
    return listResults(`/discover/${type}`, {
        with_genres: genreIds,
        sort_by: "vote_average.desc",
        "vote_count.gte": 50,
        language: "en-US",
        page: 1,
    });
}

export function getSimilar(type: MediaType, id: number) {
    return listResults(`/${type}/${id}/similar`, { language: "en-US", page: 1 });
}

export function getPersonCredits(personId: number) {
    return tmdbGet<TmdbPersonCredits>(`/person/${personId}/combined_credits`, { language: "en-US" });
}

export function getRecommendations(type: MediaType, id: number) {
    return listResults(`/${type}/${id}/recommendations`, { language: "en-US", page: 1 });
}

export function searchByTitleYear(type: MediaType, title: string, year: number | null) {
    const params: Params = { query: title, include_adult: "false" };
    if (year != null) params[type === "movie" ? "year" : "first_air_date_year"] = year;
    return listResults(`/search/${type}`, params);
}

export function discoverFiltered(
    type: MediaType,
    options: { genreIds: number[]; maxVoteCount?: number; minVoteAverage?: number },
) {
    const params: Params = {
        with_genres: options.genreIds.join("|"),
        sort_by: "vote_average.desc",
        "vote_count.gte": 50,
        language: "en-US",
        page: 1,
    };
    if (options.maxVoteCount != null) params["vote_count.lte"] = options.maxVoteCount;
    if (options.minVoteAverage != null) params["vote_average.gte"] = options.minVoteAverage;
    return listResults(`/discover/${type}`, params);
}
