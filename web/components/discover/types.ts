import type { SpotifySearchResult } from "@/lib/spotify/spotify";
import type { Confidence, VibeSearchResult } from "@/lib/ai/types";

export type MediaItem = {
  id: number;
  title?: string;
  name?: string;
  media_type: "movie" | "tv";
  poster_url?: string | null;
  vote_average?: number;
  release_date?: string;
  first_air_date?: string;
};

export type ForYouRow = {
  id: string;
  title: string;
  subtitle?: string;
  items: MediaItem[];
};

export type FilmRec = MediaItem & { explanation?: string; confidence?: Confidence };
export type MusicRec = SpotifySearchResult & { explanation?: string; confidence?: Confidence };

/** Why a For you section has nothing (new) to show. */
export type RecsProblem =
  | { kind: "no_key" }
  | { kind: "not_enough_logs" }
  | { kind: "error"; detail: string | null };

/** A For you section. `loading` starts true: the section shows as loading until its first answer settles. */
export type Recs<T> = { loading: boolean; items: T[]; problem: RecsProblem | null };

/** A settled title search, tagged with what it was for so a stale one is never shown. */
export type TitleSearch = { key: string; failed: boolean; films: MediaItem[]; music: SpotifySearchResult[] };

/** A search by description. It runs only when Enter is pressed. */
export type VibeSearch = {
  query: string;
  loading: boolean;
  failed: boolean;
  interpretation: string;
  results: VibeSearchResult[];
};

export const PROFILE_HREF = "/protected/profile";
export const LOG_HREF = "/protected/log";

export function mediaHref(type: "movie" | "tv", id: number) {
  return `/protected/media/${type}/${id}`;
}

/** "Film · 2021 · 7.8/10": optional lead, release year and audience score, whichever exist. */
export function filmMeta(
  item: { release_date?: string; first_air_date?: string; vote_average?: number },
  lead?: string,
) {
  const year = (item.release_date || item.first_air_date || "").slice(0, 4);
  const score =
    item.vote_average != null && item.vote_average > 0 ? `${item.vote_average.toFixed(1)}/10` : "";
  return [lead, year, score].filter(Boolean).join(" · ");
}
