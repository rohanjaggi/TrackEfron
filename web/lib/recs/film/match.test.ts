import { describe, expect, test } from "vitest";
import type { FilmCandidate, RawFilmPick } from "@/lib/ai/types";
import { matchFilmPicks } from "./match";

const cand = (id: number, year: number | null = 2020, type: "movie" | "tv" = "movie"): FilmCandidate => ({
  tmdb_id: id, media_type: type, title: `T${id}`, year, genres: [], overview: "", poster_url: `/p${id}`,
});
const pick = (id: number | null, over: Partial<RawFilmPick> = {}): RawFilmPick => ({
  tmdb_id: id, title: `T${id}`, year: 2020, media_type: "movie",
  explanation: "because", confidence: "high", ...over,
});
const noLookup = async () => null;
const limits = { max: 20, maxOlder: 5, olderBefore: 2010 as number | null };

describe("matchFilmPicks", () => {
  test("keeps a pick whose id is in the candidate list", async () => {
    const r = await matchFilmPicks([pick(1)], [cand(1)], new Set(), noLookup, limits);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ tmdb_id: 1, explanation: "because", confidence: "high", poster_url: "/p1" });
  });
  test("drops an id that is not in the candidate list and has no lookup match", async () => {
    expect(await matchFilmPicks([pick(9)], [cand(1)], new Set(), noLookup, limits)).toEqual([]);
  });
  test("resolves a null-id pick through lookup", async () => {
    const r = await matchFilmPicks([pick(null, { title: "Found" })], [], new Set(),
      async () => cand(7, 2020), limits);
    expect(r.map((x) => x.tmdb_id)).toEqual([7]);
  });
  test("drops a lookup match whose year is more than 1 from the proposed year", async () => {
    const r = await matchFilmPicks([pick(null, { year: 2020 })], [], new Set(),
      async () => cand(7, 2015), limits);
    expect(r).toEqual([]);
  });
  test("accepts a lookup match one year off", async () => {
    const r = await matchFilmPicks([pick(null, { year: 2020 })], [], new Set(),
      async () => cand(7, 2021), limits);
    expect(r).toHaveLength(1);
  });
  test("drops excluded keys, including lookup results", async () => {
    const r = await matchFilmPicks([pick(1), pick(null)], [cand(1)], new Set(["movie:1", "movie:7"]),
      async () => cand(7), limits);
    expect(r).toEqual([]);
  });
  test("drops duplicates, keeping the first", async () => {
    const r = await matchFilmPicks([pick(1, { explanation: "first" }), pick(1, { explanation: "second" })],
      [cand(1)], new Set(), noLookup, limits);
    expect(r).toHaveLength(1);
    expect(r[0].explanation).toBe("first");
  });
  test("keeps at most limits.max", async () => {
    const ids = [1, 2, 3, 4];
    const r = await matchFilmPicks(ids.map((i) => pick(i)), ids.map((i) => cand(i)), new Set(), noLookup,
      { ...limits, max: 2 });
    expect(r.map((x) => x.tmdb_id)).toEqual([1, 2]);
  });
  test("keeps at most limits.maxOlder picks with year < olderBefore", async () => {
    const ids = [1, 2, 3, 4];
    const r = await matchFilmPicks(ids.map((i) => pick(i, { year: 1990 })), ids.map((i) => cand(i, 1990)),
      new Set(), noLookup, { ...limits, maxOlder: 2 });
    expect(r).toHaveLength(2);
  });
  test("a pick with a null year is not counted as older", async () => {
    const ids = [1, 2, 3];
    const r = await matchFilmPicks(ids.map((i) => pick(i, { year: null })), ids.map((i) => cand(i, null)),
      new Set(), noLookup, { ...limits, maxOlder: 0 });
    expect(r).toHaveLength(3);
  });
  test("a throwing lookup counts as no match for that pick only", async () => {
    const lookup = async (_t: "movie" | "tv", title: string) => {
      if (title === "Boom") throw new Error("tmdb down");
      return cand(7, 2020);
    };
    const r = await matchFilmPicks([pick(null, { title: "Boom" }), pick(null, { title: "Fine" })], [],
      new Set(), lookup, limits);
    expect(r.map((x) => x.tmdb_id)).toEqual([7]);
  });
  test("empty input returns []", async () => {
    expect(await matchFilmPicks([], [], new Set(), noLookup, limits)).toEqual([]);
  });
});
