import type { FilmCandidate } from "@/lib/ai/types";
import {
  discoverFiltered,
  getMovieDetails,
  getPoster,
  getRecommendations,
  getTvDetails,
} from "@/lib/tmdb/tmdb";
import type { WatchLogRow } from "./select-logs";

const SEED_LOGS = 6;
const TOP_GENRES = 3;
const MAX_CANDIDATES = 60;

const GENRE_NAMES: Record<number, string> = {
  28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy", 80: "Crime",
  99: "Documentary", 18: "Drama", 10751: "Family", 14: "Fantasy", 36: "History",
  27: "Horror", 10402: "Music", 9648: "Mystery", 10749: "Romance",
  878: "Science Fiction", 10770: "TV Movie", 53: "Thriller", 10752: "War",
  37: "Western", 10759: "Action & Adventure", 10762: "Kids", 10763: "News",
  10764: "Reality", 10765: "Sci-Fi & Fantasy", 10766: "Soap", 10767: "Talk",
  10768: "War & Politics",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toCandidate(r: any, type: "movie" | "tv"): FilmCandidate | null {
  const title = type === "movie" ? r.title : r.name;
  if (r.id == null || !title) return null;
  const date: string | undefined = type === "movie" ? r.release_date : r.first_air_date;
  const year = date ? parseInt(date.slice(0, 4), 10) : NaN;
  return {
    tmdb_id: r.id,
    media_type: type,
    title,
    year: Number.isNaN(year) ? null : year,
    genres: ((r.genre_ids ?? []) as number[]).map((id) => GENRE_NAMES[id]).filter(Boolean),
    overview: r.overview ?? "",
    poster_url: r.poster_path ? getPoster(r.poster_path) : null,
  };
}

export async function gatherFilmCandidates(
  logs: WatchLogRow[],
  exclude: Set<string>,
): Promise<FilmCandidate[]> {
  const seeds = logs
    .filter((l) => l.rating != null)
    .sort((a, b) => (b.rating as number) - (a.rating as number))
    .slice(0, SEED_LOGS);
  if (seeds.length === 0) return [];

  const [recLists, details] = await Promise.all([
    Promise.all(seeds.map((s) => getRecommendations(s.media_type, s.tmdb_id).catch(() => []))),
    Promise.all(
      seeds.map((s) =>
        (s.media_type === "movie" ? getMovieDetails(s.tmdb_id) : getTvDetails(s.tmdb_id)).catch(
          () => null,
        ),
      ),
    ),
  ]);

  const genreCounts = new Map<number, number>();
  for (const d of details) {
    for (const g of (d?.genres ?? []) as { id: number }[]) {
      genreCounts.set(g.id, (genreCounts.get(g.id) ?? 0) + 1);
    }
  }
  const genreIds = [...genreCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_GENRES)
    .map(([id]) => id);

  const movieSeeds = seeds.filter((s) => s.media_type === "movie").length;
  const discoverType = movieSeeds * 2 >= seeds.length ? "movie" : "tv";
  const discovered = genreIds.length
    ? await discoverFiltered(discoverType, { genreIds, maxVoteCount: 500, minVoteAverage: 7 }).catch(
        () => [],
      )
    : [];

  const all: (FilmCandidate | null)[] = [
    ...recLists.flatMap((list, i) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (list as any[]).map((r) => toCandidate(r, seeds[i].media_type)),
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(discovered as any[]).map((r) => toCandidate(r, discoverType)),
  ];

  const seen = new Set<string>();
  const out: FilmCandidate[] = [];
  for (const c of all) {
    if (!c) continue;
    const k = `${c.media_type}:${c.tmdb_id}`;
    if (seen.has(k) || exclude.has(k)) continue;
    seen.add(k);
    out.push(c);
    if (out.length >= MAX_CANDIDATES) break;
  }
  return out;
}
