import { Disc3, Film, Music2, Tv } from "lucide-react";

import { TYPE_META, type MediaType } from "@/lib/media";
import type { MediaSearchResult } from "@/lib/types";

type Choice = { value: string; label: string };

/** One optional dropdown on the log form: the column it is stored in, its element id suffix, and its choices. */
export type DetailField = { col: string; key: string; label: string; options: Choice[] };

export const FILM_TYPES = [
  { value: "movie", label: TYPE_META.movie.label, icon: Film },
  { value: "tv", label: TYPE_META.tv.label, icon: Tv },
] as const;

export const MUSIC_TYPES = [
  { value: "album", label: TYPE_META.album.label, icon: Disc3 },
  { value: "track", label: TYPE_META.track.label, icon: Music2 },
] as const;

const same = (values: string[]): Choice[] => values.map((v) => ({ value: v, label: v }));

const LISTENED_ON = same(["Spotify", "Apple Music", "YouTube Music", "SoundCloud", "Vinyl", "CD", "Other"]);
const LISTENING_CONTEXT = same(["Chill", "Workout", "Study", "Commute", "Party", "Sleep", "Other"]);
const WATCHED_ON = same([
  "Netflix",
  "Disney+",
  "Prime Video",
  "Hulu",
  "HBO Max",
  "Apple TV+",
  "Paramount+",
  "Peacock",
  "Streaming Site",
  "Cinema",
  "Other",
]);
const WATCH_DURATION = same(["One sitting", "A few days", "About a week", "A few weeks", "Over a month"]);
// Stored values are unchanged; only the labels are tidied.
const DISCOVERED_VIA: Choice[] = [
  { value: "Friend/Family", label: "Friend or family" },
  { value: "Social Media", label: "Social media" },
  { value: "Streaming Recommendation", label: "Streaming recommendation" },
  { value: "Trailer", label: "Trailer" },
  { value: "Review/Article", label: "Review or article" },
  { value: "Just Browsing", label: "Just browsing" },
  { value: "Other", label: "Other" },
];
const REWATCHABILITY = same(["Definitely", "Probably", "Maybe", "Unlikely", "No way"]);
const WATCHED_WITH = same(["Solo", "Partner", "Friends", "Family", "Group"]);
const TIMES_WATCHED = same(["1", "2", "3", "4", "5", "6+"]);

const FILM_DETAILS: readonly DetailField[] = [
  { col: "watched_on", key: "watched-on", label: "Where did you watch?", options: WATCHED_ON },
  { col: "watch_duration", key: "duration", label: "How long did it take to finish?", options: WATCH_DURATION },
  { col: "discovered_via", key: "discovered", label: "How did you discover this?", options: DISCOVERED_VIA },
  { col: "rewatchability", key: "rewatch", label: "Would you rewatch?", options: REWATCHABILITY },
  { col: "watched_with", key: "with", label: "Who did you watch with?", options: WATCHED_WITH },
  { col: "times_watched", key: "times", label: "How many times have you watched this?", options: TIMES_WATCHED },
];

const MUSIC_DETAILS: readonly DetailField[] = [
  { col: "listened_on", key: "listened-on", label: "Where did you listen?", options: LISTENED_ON },
  { col: "listening_context", key: "context", label: "What was the context?", options: LISTENING_CONTEXT },
];

export const detailsFor = (music: boolean) => (music ? MUSIC_DETAILS : FILM_DETAILS);

/** Detail values read from a stored row; a missing value is "". */
export function detailsFromRow(fields: readonly DetailField[], row: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(fields.map((f) => [f.col, (row[f.col] as string | null | undefined) || ""]));
}

/** True when the row has at least one detail set. */
export const hasDetail = (fields: readonly DetailField[], row: Record<string, unknown>): boolean =>
  fields.some((f) => row[f.col]);

/** Columns to write: an empty choice is stored as null. */
export function detailsPayload(
  fields: readonly DetailField[],
  details: Record<string, string>,
): Record<string, string | null> {
  return Object.fromEntries(fields.map((f) => [f.col, details[f.col] || null]));
}

export const MEDIA_TYPES: readonly MediaType[] = ["movie", "tv", "album", "track"];

export const LISTBOX_ID = "log-title-results";
export const optionId = (index: number) => `log-title-option-${index}`;

/** Today's date as YYYY-MM-DD in the user's own timezone. */
export function today() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const labelOf = (item: MediaSearchResult) => item.title || item.name || "Untitled";
export const yearOf = (item: MediaSearchResult) => (item.release_date || item.first_air_date || "").slice(0, 4);
