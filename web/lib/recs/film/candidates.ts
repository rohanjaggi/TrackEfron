import type { FilmCandidate } from "@/lib/ai/types";
import {
  discoverFiltered,
  getDetails,
  getPoster,
  getRecommendations,
  type TmdbResult,
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

export function toCandidate(r: TmdbResult, type: "movie" | "tv"): FilmCandidate | null {
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

const DISCOVER_SHARE = 20;

const keyOf = (c: FilmCandidate) => `${c.media_type}:${c.tmdb_id}`;

/**
 * Merge candidate pools into at most `max` unique, non-excluded titles.
 * Up to DISCOVER_SHARE slots go to discover results (at least half from the
 * low-vote pool when it has enough); recommendations fill the rest
 * round-robin across seeds. Unused slots in either share go to the other.
 */
export function mergeCandidates(
  recsBySeed: FilmCandidate[][],
  discover: FilmCandidate[],
  lowVoteDiscover: FilmCandidate[],
  exclude: Set<string>,
  max = MAX_CANDIDATES,
): FilmCandidate[] {
  const seen = new Set<string>();
  const out: FilmCandidate[] = [];
  const take = (c: FilmCandidate): boolean => {
    const k = keyOf(c);
    if (out.length >= max || seen.has(k) || exclude.has(k)) return false;
    seen.add(k);
    out.push(c);
    return true;
  };

  const share = Math.min(DISCOVER_SHARE, max);
  const lowTarget = Math.ceil(share / 2);
  let discoverTaken = 0;
  for (const c of lowVoteDiscover) {
    if (discoverTaken >= lowTarget) break;
    if (take(c)) discoverTaken++;
  }
  for (const c of discover) {
    if (discoverTaken >= share) break;
    if (take(c)) discoverTaken++;
  }
  for (const c of lowVoteDiscover) {
    if (discoverTaken >= share) break;
    if (take(c)) discoverTaken++;
  }

  const recBudget = max - discoverTaken;
  let recsTaken = 0;
  const longest = Math.max(0, ...recsBySeed.map((r) => r.length));
  for (let i = 0; i < longest && recsTaken < recBudget; i++) {
    for (const list of recsBySeed) {
      if (recsTaken >= recBudget) break;
      if (i < list.length && take(list[i])) recsTaken++;
    }
  }

  // Unused recommendation slots go back to discover results.
  for (const c of [...lowVoteDiscover, ...discover]) take(c);
  return out;
}

export type GatherResult = {
  candidates: FilmCandidate[];
  /** True when every TMDB call made failed, as opposed to calls that succeeded with nothing useful. */
  tmdbDown: boolean;
};

export async function gatherFilmCandidates(
  logs: WatchLogRow[],
  exclude: Set<string>,
): Promise<GatherResult> {
  const seeds = logs
    .filter((l) => l.rating != null)
    .sort((a, b) => (b.rating as number) - (a.rating as number))
    .slice(0, SEED_LOGS);
  if (seeds.length === 0) return { candidates: [], tmdbDown: false };

  // Each TMDB call below can fail on its own; a failure only shrinks the candidate pool.
  let calls = 0;
  let failures = 0;
  const tolerate = <T>(promise: Promise<T>, fallback: T): Promise<T> => {
    calls++;
    return promise.catch(() => {
      failures++;
      return fallback;
    });
  };
  const [recLists, details] = await Promise.all([
    Promise.all(seeds.map((s) => tolerate(getRecommendations(s.media_type, s.tmdb_id), [] as TmdbResult[]))),
    Promise.all(
      seeds.map((s) =>
        tolerate(getDetails(s.media_type, s.tmdb_id), null),
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
  const [discovered, lowVote] = genreIds.length
    ? await Promise.all([
        // A failed discover pool is left out; the recommendation pool still fills the batch.
        tolerate(discoverFiltered(discoverType, { genreIds }), [] as TmdbResult[]),
        tolerate(
          discoverFiltered(discoverType, { genreIds, maxVoteCount: 500, minVoteAverage: 7 }),
          [] as TmdbResult[],
        ),
      ])
    : [[], []];

  const convert = (list: TmdbResult[], type: "movie" | "tv") =>
    list.map((r) => toCandidate(r, type)).filter((c): c is FilmCandidate => c !== null);

  const candidates = mergeCandidates(
    recLists.map((list, i) => convert(list, seeds[i].media_type)),
    convert(discovered, discoverType),
    convert(lowVote, discoverType),
    exclude,
  );
  return { candidates, tmdbDown: calls > 0 && failures === calls };
}
