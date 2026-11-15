export type TmdbDetail = {
  runtime?: number;
  seasons?: number;
  episodes?: number;
  genres: string[];
  voteAvg: number | null;
  releaseYear: number | null;
  posterUrl: string | null;
};

type TitleType = "movie" | "tv";

// Successful, parsed responses only; a failure is never stored.
const cache = new Map<string, TmdbDetail>();
// One request per title at a time, shared by every concurrent caller.
const inflight = new Map<string, Promise<TmdbDetail | null>>();

async function load(type: TitleType, id: number): Promise<TmdbDetail | null> {
  try {
    const res = await fetch(`/api?action=detail&type=${type}&id=${id}`);
    if (!res.ok) return null;
    const d = await res.json();
    const genres = (d.genres || []).map((g: { name: string }) => g.name);
    const relDate = d.release_date || d.first_air_date || "";
    const releaseYear = relDate ? parseInt(relDate.slice(0, 4), 10) : null;
    return {
      runtime: d.runtime || undefined,
      seasons: d.number_of_seasons || undefined,
      episodes: d.number_of_episodes || undefined,
      genres,
      voteAvg: d.vote_average ?? null,
      releaseYear: releaseYear && !isNaN(releaseYear) ? releaseYear : null,
      posterUrl: d.poster_url || null,
    };
  } catch {
    return null;
  }
}

/** Client-side film or TV details for one title, or null when the request failed. */
export function fetchTitleDetail(type: TitleType, id: number): Promise<TmdbDetail | null> {
  const key = `${type}:${id}`;
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);
  const pending = inflight.get(key);
  if (pending) return pending;
  const request = load(type, id)
    .then((detail) => {
      if (detail) cache.set(key, detail);
      return detail;
    })
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, request);
  return request;
}

/** Test seam: forget everything cached and in flight. */
export function clearTitleDetailCache(): void {
  cache.clear();
  inflight.clear();
}
