/** Browser-side clients for the app's TMDB and Spotify search routes. */

/** The `type` parameter the Spotify search route takes, e.g. "album,track". */
export type SpotifySearchType = string;

export function tmdbSearchUrl(q: string): string {
  return `/api?action=search&q=${encodeURIComponent(q)}`;
}

export function spotifySearchUrl(q: string, type: SpotifySearchType): string {
  return `/api/spotify?action=search&q=${encodeURIComponent(q)}&type=${type}`;
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Search request failed");
  return res.json();
}

/** Raw TMDB search body; throws when the request is not ok. Callers validate the shape. */
export function searchTmdb(q: string): Promise<unknown> {
  return getJson(tmdbSearchUrl(q));
}

/** Raw Spotify search body; throws when the request is not ok. Callers validate the shape. */
export function searchSpotify(q: string, type: SpotifySearchType): Promise<unknown> {
  return getJson(spotifySearchUrl(q, type));
}

/** The body as rows, or an empty list when it is not an array. */
export function asRows<T>(raw: unknown): T[] {
  return Array.isArray(raw) ? (raw as T[]) : [];
}
