/** The optional per-category star ratings on a log, with the column each one is stored in. */
export type RatingCategory = { col: string; label: string };

export const FILM_CATEGORIES: readonly RatingCategory[] = [
  { col: "plot_rating", label: "Plot" },
  { col: "cinematography_rating", label: "Cinematography" },
  { col: "acting_rating", label: "Acting" },
  { col: "soundtrack_rating", label: "Soundtrack" },
  { col: "pacing_rating", label: "Pacing" },
  { col: "casting_rating", label: "Casting" },
];

export const MUSIC_CATEGORIES: readonly RatingCategory[] = [
  { col: "lyrics_rating", label: "Lyrics" },
  { col: "production_rating", label: "Production" },
  { col: "vocals_rating", label: "Vocals" },
  { col: "melody_rating", label: "Melody" },
  { col: "replay_rating", label: "Replay value" },
  { col: "energy_rating", label: "Energy" },
];

export const categoriesFor = (music: boolean) => (music ? MUSIC_CATEGORIES : FILM_CATEGORIES);

/** Comma-separated column list for a Supabase `select`, e.g. "id, rating, review, watched_date, plot_rating, ...". */
export function logSelect(music: boolean): string {
  return [
    "id",
    "rating",
    "review",
    music ? "listened_date" : "watched_date",
    ...categoriesFor(music).map((c) => c.col),
  ].join(", ");
}

type Row = Record<string, unknown>;

/** Category ratings read from a stored row; a missing value is 0 (not rated). */
export function ratingsFromRow(categories: readonly RatingCategory[], row: Row): Record<string, number> {
  return Object.fromEntries(categories.map((c) => [c.col, (row[c.col] as number | null | undefined) || 0]));
}

/** True when the row has at least one category rating. */
export const hasCategoryRating = (categories: readonly RatingCategory[], row: Row): boolean =>
  categories.some((c) => row[c.col]);

/** Columns to write: a rating of 0 (not rated) is stored as null. */
export function ratingsPayload(
  categories: readonly RatingCategory[],
  ratings: Record<string, number>,
): Record<string, number | null> {
  return Object.fromEntries(categories.map((c) => [c.col, ratings[c.col] || null]));
}
