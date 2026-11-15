import type { ReactNode } from "react";

import { categoriesFor } from "@/lib/rating-categories";

type Genre = { id: number; name: string };

export type MediaDetail = {
  id: number;
  overview: string;
  poster_url: string | null;
  backdrop_url: string | null;
  genres: Genre[];
  vote_average: number;
  vote_count: number;
  tagline?: string;
  status: string;
  credits?: {
    cast: {
      id: number;
      name: string;
      character: string;
      profile_path: string | null;
    }[];
  };
  title?: string;
  release_date?: string;
  runtime?: number;
  name?: string;
  first_air_date?: string;
  last_air_date?: string;
  number_of_seasons?: number;
  number_of_episodes?: number;
  episode_run_time?: number[];
  created_by?: { id: number; name: string }[];
  networks?: { id: number; name: string; logo_path: string | null }[];
};

export type MusicDetail = {
  id: string;
  name: string;
  artist: string;
  album_name: string;
  image_url: string | null;
  release_date: string;
  type: "album" | "track";
};

export type WatchProvider = {
  logo_path: string;
  provider_id: number;
  provider_name: string;
};

export type WatchProviders = {
  flatrate?: WatchProvider[];
  rent?: WatchProvider[];
  buy?: WatchProvider[];
  link?: string;
};

export type Fact = { label: string; value: ReactNode };

/** "2024-03-01" → "1 Mar 2024". Copes with year-only and year-month release dates. */
export function formatDate(value: string): string {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year) return value;
  if (!month) return String(year);
  return new Date(Date.UTC(year, month - 1, day || 1)).toLocaleDateString("en-GB", {
    day: day ? "numeric" : undefined,
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** The one-line meta strip and the fact rows for an album or track. */
export function buildMusicInfo(m: MusicDetail, isAlbum: boolean): { meta: string[]; facts: Fact[] } {
  const meta: string[] = [];
  const facts: Fact[] = [];
  const year = (m.release_date || "").slice(0, 4);
  if (year) meta.push(year);
  if (isAlbum && m.album_name && m.album_name !== m.name) meta.push(m.album_name);
  if (!isAlbum && m.album_name) meta.push(`from ${m.album_name}`);

  if (m.artist) facts.push({ label: "Artist", value: m.artist });
  if (!isAlbum && m.album_name) facts.push({ label: "Album", value: m.album_name });
  if (m.release_date) facts.push({ label: "Released", value: formatDate(m.release_date) });
  return { meta, facts };
}

/** The one-line meta strip and the fact rows for a film or TV show. */
export function buildFilmInfo(d: MediaDetail, isMovie: boolean): { meta: string[]; facts: Fact[] } {
  const meta: string[] = [];
  const facts: Fact[] = [];
  const released = d.release_date || d.first_air_date || "";
  const year = released.slice(0, 4);
  const runtime = isMovie
    ? d.runtime
      ? `${d.runtime} min`
      : null
    : d.episode_run_time?.length
      ? `${d.episode_run_time[0]} min/ep`
      : null;
  if (year) meta.push(year);
  if (runtime) meta.push(runtime);
  if (!isMovie && d.number_of_seasons != null) {
    meta.push(`${d.number_of_seasons} season${d.number_of_seasons !== 1 ? "s" : ""}`);
    if (d.number_of_episodes != null) meta.push(`${d.number_of_episodes} episodes`);
  }

  if (released) {
    facts.push({ label: isMovie ? "Released" : "First aired", value: formatDate(released) });
  }
  if (!isMovie && d.last_air_date) {
    facts.push({ label: "Last aired", value: d.last_air_date.slice(0, 4) });
  }
  if (!isMovie && d.created_by?.length) {
    facts.push({ label: "Created by", value: d.created_by.map((c) => c.name).join(", ") });
  }
  if (!isMovie && d.networks?.length) {
    facts.push({ label: "Network", value: d.networks.map((n) => n.name).join(", ") });
  }
  if (d.vote_average > 0) {
    facts.push({
      label: "TMDB score",
      value: `${d.vote_average.toFixed(1)} / 10 (${d.vote_count.toLocaleString("en-GB")} votes)`,
    });
  }
  return { meta, facts };
}

/** Where to watch: one logo per service, first category wins. */
export function buildWhereToWatch(providers: WatchProviders): (WatchProvider & { category: string })[] {
  const out: (WatchProvider & { category: string })[] = [];
  const seen = new Set<number>();
  for (const [category, list] of [
    ["Stream", providers.flatrate],
    ["Rent", providers.rent],
    ["Buy", providers.buy],
  ] as [string, WatchProvider[] | undefined][]) {
    for (const p of list ?? []) {
      if (seen.has(p.provider_id)) continue;
      seen.add(p.provider_id);
      out.push({ ...p, category });
    }
  }
  return out;
}

/** The user's own log row as read from `watch_logs` / `listen_logs` with `logSelect`. */
export type UserLogRow = {
  id: string;
  rating: number;
  review: string | null;
  watched_date?: string | null;
  listened_date?: string | null;
} & Record<string, string | number | null | undefined>;

/** What the "Your log" section shows, for a watch (film) or a listen (music). */
export function buildLogView(row: UserLogRow, music: boolean) {
  return {
    id: row.id,
    rating: row.rating,
    review: row.review,
    date: music ? row.listened_date : row.watched_date,
    categories: categoriesFor(music).map((c) => ({ label: c.label, value: row[c.col] as number | null })),
  };
}
