import type { TmdbDetail } from "@/lib/tmdb/client";

export type { TmdbDetail };

export type WatchLog = {
  rating: number | null;
  media_type: "movie" | "tv";
  watched_date: string | null;
  created_at: string;
  tmdb_id: number | null;
  title: string;
  times_watched: string | null;
  poster_url: string | null;
};

export type ControversialPick = {
  title: string;
  posterUrl: string | null;
  userRating: number;
  tmdbRating: number;
  delta: number;
};

export type Tally = { name: string; count: number };
