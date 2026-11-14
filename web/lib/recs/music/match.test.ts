import { describe, expect, test } from "vitest";
import { matchMusicPicks } from "./match";
import { normalise } from "../normalise";
import type { MusicRecommendation } from "@/lib/ai/types";
import type { SpotifySearchResult } from "@/lib/spotify/spotify";

const pick = (artist: string, title: string): MusicRecommendation => ({
  artist,
  title,
  type: "album",
  explanation: "because",
  confidence: "high",
  spotify_id: null,
  image_url: null,
  album_name: null,
});

const result = (id: string, name: string, artist: string): SpotifySearchResult => ({
  id,
  name,
  artist,
  album_name: name,
  image_url: `img-${id}`,
  release_date: "2020",
  type: "album",
});

const fake = (table: Record<string, SpotifySearchResult[]>) => async (q: string) => table[q] ?? [];

describe("matchMusicPicks", () => {
  test("accepts a result matching title and artist ignoring case and punctuation", async () => {
    const search = fake({ "Radiohead OK Computer": [result("a1", "OK, Computer!", "RADIOHEAD")] });
    const out = await matchMusicPicks([pick("Radiohead", "OK Computer")], new Set(), search, 5);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ spotify_id: "a1", image_url: "img-a1", title: "OK, Computer!", artist: "RADIOHEAD" });
  });

  test("drops a pick when no result matches, even if results exist", async () => {
    const search = fake({ "Radiohead OK Computer": [result("x", "Totally Different", "Someone Else")] });
    const out = await matchMusicPicks([pick("Radiohead", "OK Computer")], new Set(), search, 5);
    expect(out).toEqual([]);
  });

  test("drops a pick when search throws", async () => {
    const search = async () => {
      throw new Error("boom");
    };
    const out = await matchMusicPicks([pick("Radiohead", "OK Computer")], new Set(), search, 5);
    expect(out).toEqual([]);
  });

  test("drops excluded ids and duplicates", async () => {
    const search = fake({
      "A One": [result("1", "One", "A")],
      "A Uno": [result("1", "One", "A")],
      "B Two": [result("2", "Two", "B")],
    });
    const out = await matchMusicPicks([pick("A", "One"), pick("A", "Uno"), pick("B", "Two")], new Set(["2"]), search, 5);
    expect(out.map((o) => o.spotify_id)).toEqual(["1"]);
  });

  test("caps at max", async () => {
    const search = fake({
      "A One": [result("1", "One", "A")],
      "B Two": [result("2", "Two", "B")],
      "C Three": [result("3", "Three", "C")],
    });
    const out = await matchMusicPicks([pick("A", "One"), pick("B", "Two"), pick("C", "Three")], new Set(), search, 2);
    expect(out.map((o) => o.spotify_id)).toEqual(["1", "2"]);
  });

  test("matches when punctuation leaves runs of spaces", async () => {
    const search = fake({ "Crosby Stills Nash Crosby Stills Nash": [result("c1", "Crosby, Stills & Nash", "Crosby, Stills & Nash")] });
    const out = await matchMusicPicks([pick("Crosby Stills Nash", "Crosby Stills Nash")], new Set(), search, 5);
    expect(out.map((o) => o.spotify_id)).toEqual(["c1"]);
  });

  test("matches accented names against unaccented proposals", async () => {
    const search = fake({ "Beyonce Lemonade": [result("b1", "Lemonade", "Beyoncé")] });
    const out = await matchMusicPicks([pick("Beyonce", "Lemonade")], new Set(), search, 5);
    expect(out.map((o) => o.spotify_id)).toEqual(["b1"]);
  });

  test("matches non-Latin titles and artists", async () => {
    const search = fake({ "宇多田ヒカル 初恋": [result("j1", "初恋", "宇多田ヒカル")] });
    const out = await matchMusicPicks([pick("宇多田ヒカル", "初恋")], new Set(), search, 5);
    expect(out.map((o) => o.spotify_id)).toEqual(["j1"]);
  });
});

describe("normalise", () => {
  test("collapses whitespace left by removed punctuation", () => {
    expect(normalise("Crosby, Stills & Nash")).toBe("crosby stills nash");
  });
  test("strips diacritics", () => {
    expect(normalise("Beyoncé")).toBe("beyonce");
  });
  test("keeps non-Latin letters", () => {
    expect(normalise("宇多田ヒカル")).toBe("宇多田ヒカル");
    expect(normalise("Земфира")).toBe("земфира");
  });
});
