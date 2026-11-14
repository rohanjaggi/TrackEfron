/**
 * Row and API shapes shared across pages. Each type is the union of the
 * fields any page reads; fields that not every `select(...)` returns are
 * optional.
 */

export type FilmMediaType = "movie" | "tv";
export type MusicMediaType = "album" | "track";

export interface WatchLog {
  id: string;
  title: string;
  media_type: FilmMediaType | MusicMediaType;
  rating: number;
  review: string | null;
  watched_date?: string | null;
  poster_url: string | null;
  tmdb_id: number | null;
  spotify_id?: string | null;
  artist?: string | null;
  times_watched?: string | null;
  created_at: string;
}

export interface ListenLog {
  media_type: MusicMediaType;
  artist: string | null;
  rating: number;
}

export interface WatchlistItem {
  id: string;
  tmdb_id: number | null;
  spotify_id?: string | null;
  artist?: string | null;
  title: string;
  media_type: FilmMediaType | MusicMediaType;
  poster_url: string | null;
  image_url?: string | null;
  added_at?: string;
}

/** A TMDB or Spotify hit as returned by `/api?action=search` or the Spotify search route. */
export interface MediaSearchResult {
  id: number | string;
  spotify_id?: string;
  artist?: string;
  album_name?: string;
  title?: string;
  name?: string;
  media_type: FilmMediaType | MusicMediaType;
  release_date?: string;
  first_air_date?: string;
  poster_url?: string | null;
  image_url?: string | null;
  vote_average?: number;
  overview?: string;
}
