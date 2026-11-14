import { describe, expect, test } from "vitest";
import { makeFilmLookup } from "./lookup";

const movie = (id: number, title: string, extra: Record<string, unknown> = {}) => ({
  id,
  title,
  release_date: "1999-03-31",
  genre_ids: [28],
  overview: "o",
  poster_path: "/p.jpg",
  ...extra,
});

describe("makeFilmLookup", () => {
  test("accepts a result whose title matches ignoring case and punctuation", async () => {
    const lookup = makeFilmLookup(async () => [movie(1, "The Matrix!")]);
    const out = await lookup("movie", "the matrix", 1999);
    expect(out).toMatchObject({ tmdb_id: 1, title: "The Matrix!", year: 1999, media_type: "movie" });
  });

  test("handles accents", async () => {
    const lookup = makeFilmLookup(async () => [movie(2, "Amélie")]);
    expect(await lookup("movie", "Amelie", null)).toMatchObject({ tmdb_id: 2 });
  });

  test("skips non-matching results and takes a later match", async () => {
    const lookup = makeFilmLookup(async () => [movie(3, "Unrelated"), movie(4, "Heat")]);
    expect(await lookup("movie", "Heat", null)).toMatchObject({ tmdb_id: 4 });
  });

  test("returns null rather than the first result when nothing matches", async () => {
    const lookup = makeFilmLookup(async () => [movie(5, "Something Else")]);
    expect(await lookup("movie", "Heat", null)).toBeNull();
  });

  test("matches non-Latin titles through the original title", async () => {
    const lookup = makeFilmLookup(async () => [movie(6, "Spirited Away", { original_title: "千と千尋の神隠し" })]);
    expect(await lookup("movie", "千と千尋の神隠し", 2001)).toMatchObject({ tmdb_id: 6 });
  });

  test("reads tv results from name and first_air_date", async () => {
    const lookup = makeFilmLookup(async () => [
      { id: 7, name: "Severance", first_air_date: "2022-02-18", genre_ids: [], overview: "", poster_path: null },
    ]);
    expect(await lookup("tv", "Severance", 2022)).toMatchObject({ tmdb_id: 7, year: 2022, media_type: "tv", poster_url: null });
  });

  test("returns null on empty results", async () => {
    expect(await makeFilmLookup(async () => [])("tv", "X", null)).toBeNull();
  });
});
