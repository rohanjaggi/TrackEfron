import type { Tally } from "./types";

export function formatRuntime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function formatDate(value: Date | number | string, options: Intl.DateTimeFormatOptions): string {
  return new Date(value).toLocaleDateString("en-GB", options);
}

/** "Jun '26", from the one en-GB formatter. */
export function formatMonthYear(value: number): string {
  return `${formatDate(value, { month: "short" })} '${formatDate(value, { year: "2-digit" })}`;
}

/** A log counts toward ratings only when it has one (null, undefined and 0 mean unrated). */
export function isRated(l: { rating: number | null | undefined }): boolean {
  return Number(l.rating) > 0;
}

/** TMDB movie and TV ids are separate namespaces, so details are keyed by the pair. */
export function detailKey(mediaType: "movie" | "tv", tmdbId: number): string {
  return `${mediaType}:${tmdbId}`;
}

export function needsDetails(n: number, rated = false): string {
  return `Needs at least ${n} ${rated ? "rated " : ""}${plural(n, "film", "films")} with details to draw this.`;
}

export function truncate(text: string, max = 14): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

export function tally(values: (string | null | undefined)[]): Tally[] {
  const counts: Record<string, number> = {};
  values.forEach((v) => {
    if (v) counts[v] = (counts[v] || 0) + 1;
  });
  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

export const MIN_POINTS = 3;

export function tallySummary(data: Tally[], what: string): string {
  const total = data.reduce((acc, d) => acc + d.count, 0);
  return `${what}: ${data[0].name} leads with ${data[0].count} of ${total}.`;
}
