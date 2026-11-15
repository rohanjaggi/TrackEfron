import { describe, expect, test } from "vitest";
import {
  FILM_CATEGORIES,
  MUSIC_CATEGORIES,
  categoriesFor,
  hasCategoryRating,
  logSelect,
  ratingsFromRow,
  ratingsPayload,
} from "./rating-categories";

describe("rating categories", () => {
  test("film columns and labels", () => {
    expect(FILM_CATEGORIES.map((c) => [c.col, c.label])).toEqual([
      ["plot_rating", "Plot"],
      ["cinematography_rating", "Cinematography"],
      ["acting_rating", "Acting"],
      ["soundtrack_rating", "Soundtrack"],
      ["pacing_rating", "Pacing"],
      ["casting_rating", "Casting"],
    ]);
  });

  test("music columns and labels", () => {
    expect(MUSIC_CATEGORIES.map((c) => [c.col, c.label])).toEqual([
      ["lyrics_rating", "Lyrics"],
      ["production_rating", "Production"],
      ["vocals_rating", "Vocals"],
      ["melody_rating", "Melody"],
      ["replay_rating", "Replay value"],
      ["energy_rating", "Energy"],
    ]);
  });

  test("categoriesFor picks the domain", () => {
    expect(categoriesFor(true)).toBe(MUSIC_CATEGORIES);
    expect(categoriesFor(false)).toBe(FILM_CATEGORIES);
  });

  test("select strings", () => {
    expect(logSelect(false)).toBe(
      "id, rating, review, watched_date, plot_rating, cinematography_rating, acting_rating, soundtrack_rating, pacing_rating, casting_rating",
    );
    expect(logSelect(true)).toBe(
      "id, rating, review, listened_date, lyrics_rating, production_rating, vocals_rating, melody_rating, replay_rating, energy_rating",
    );
  });

  test("null and missing ratings load as 0", () => {
    expect(ratingsFromRow(FILM_CATEGORIES, { plot_rating: 4, acting_rating: null })).toEqual({
      plot_rating: 4,
      cinematography_rating: 0,
      acting_rating: 0,
      soundtrack_rating: 0,
      pacing_rating: 0,
      casting_rating: 0,
    });
  });

  test("0 and missing ratings are stored as null", () => {
    expect(ratingsPayload(MUSIC_CATEGORIES, { lyrics_rating: 3, vocals_rating: 0 })).toEqual({
      lyrics_rating: 3,
      production_rating: null,
      vocals_rating: null,
      melody_rating: null,
      replay_rating: null,
      energy_rating: null,
    });
  });

  test("hasCategoryRating is true for any non-zero value", () => {
    expect(hasCategoryRating(FILM_CATEGORIES, { plot_rating: null, casting_rating: 0 })).toBe(false);
    expect(hasCategoryRating(FILM_CATEGORIES, { casting_rating: 2 })).toBe(true);
    expect(hasCategoryRating(FILM_CATEGORIES, { lyrics_rating: 2 })).toBe(false);
  });
});
