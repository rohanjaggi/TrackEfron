import { describe, expect, test } from "vitest";
import { computeRightNow } from "./right-now";
import type { SpotifyTops } from "@/lib/ai/types";

const a = (id: string) => ({ id, name: `Artist ${id}`, genres: [], image_url: null });

function tops(short: string[], medium: string[], long: string[]): SpotifyTops {
  return {
    artists: { short_term: short.map(a), medium_term: medium.map(a), long_term: long.map(a) },
    tracks: { short_term: [], medium_term: [], long_term: [] },
  };
}

describe("computeRightNow", () => {
  test("rising excludes artists present in long_term", () => {
    const r = computeRightNow(tops(["1", "2", "3"], [], ["2"]));
    expect(r.rising.map((x) => x.id)).toEqual(["1", "3"]);
  });

  test("dropped_off excludes artists in short_term or medium_term", () => {
    const r = computeRightNow(tops(["1"], ["2"], ["1", "2", "3"]));
    expect(r.dropped_off.map((x) => x.id)).toEqual(["3"]);
  });

  test("each list is capped at 6", () => {
    const ids = (p: string) => Array.from({ length: 10 }, (_, i) => `${p}${i}`);
    const r = computeRightNow(tops(ids("s"), [], ids("l")));
    expect(r.rising).toHaveLength(6);
    expect(r.dropped_off).toHaveLength(6);
    expect(r.rising[0]).toEqual({ id: "s0", name: "Artist s0", image_url: null });
  });
});
