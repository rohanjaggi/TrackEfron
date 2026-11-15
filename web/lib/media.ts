import { Disc3, Film, Music2, Tv, type LucideIcon } from "lucide-react";
import type { FilmMediaType, MusicMediaType } from "@/lib/types";

export type MediaType = FilmMediaType | MusicMediaType;

/**
 * Label and icon for each media type. `label` is the long form ("TV show"), `shortLabel` the compact
 * form ("TV") that some pages use in tight rows; `plural` is lower case for use mid-sentence.
 */
export const TYPE_META: Record<
  MediaType,
  { label: string; shortLabel: string; plural: string; icon: LucideIcon }
> = {
  movie: { label: "Film", shortLabel: "Film", plural: "films", icon: Film },
  tv: { label: "TV show", shortLabel: "TV", plural: "TV shows", icon: Tv },
  album: { label: "Album", shortLabel: "Album", plural: "albums", icon: Disc3 },
  track: { label: "Track", shortLabel: "Track", plural: "tracks", icon: Music2 },
};

export function isMusicType(type: unknown): type is MusicMediaType {
  return type === "album" || type === "track";
}

/** "1 film or show", "3 films and shows", "1 album or track", "3 albums and tracks". */
export function countLabel(count: number, music: boolean): string {
  if (music) return count === 1 ? "1 album or track" : `${count} albums and tracks`;
  return count === 1 ? "1 film or show" : `${count} films and shows`;
}

/**
 * The media page for a title. Music links by Spotify id when it has one; everything else (and music
 * without a Spotify id) links by TMDB id. Undefined when there is no id to link to.
 */
export function mediaHref(
  type: string,
  ids: { tmdbId?: number | string | null; spotifyId?: string | null },
): string | undefined {
  if (isMusicType(type) && ids.spotifyId) return `/protected/media/${type}/${ids.spotifyId}`;
  if (ids.tmdbId) return `/protected/media/${type}/${ids.tmdbId}`;
  return undefined;
}

/** "14 Nov 2026", in the viewer's local time zone. */
export function formatDay(value: string): string {
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** True when a review has any text beyond whitespace. */
export function hasReview(review: string | null | undefined): boolean {
  return !!review && review.trim().length > 0;
}

export function countReviews(items: ReadonlyArray<{ review?: string | null }>): number {
  return items.filter((i) => hasReview(i.review)).length;
}

/**
 * Mean rating to one decimal. By default unrated entries (null, undefined, 0) are left out of the
 * mean; with `includeUnrated` every entry counts, as 0 when it has no rating. `empty` is shown when
 * there is nothing to average.
 */
export function averageRating(
  ratings: ReadonlyArray<number | string | null | undefined>,
  { empty = "—", includeUnrated = false }: { empty?: string; includeUnrated?: boolean } = {},
): string {
  const values = includeUnrated ? ratings.map(Number) : ratings.map(Number).filter((r) => r > 0);
  if (values.length === 0) return empty;
  return (values.reduce((acc, r) => acc + r, 0) / values.length).toFixed(1);
}
