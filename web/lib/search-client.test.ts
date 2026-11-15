import { describe, expect, it } from "vitest";
import { asRows, spotifySearchUrl, tmdbSearchUrl } from "./search-client";

describe("search urls", () => {
  it("encodes the query and keeps the type list literal", () => {
    expect(tmdbSearchUrl("a b&c")).toBe("/api?action=search&q=a%20b%26c");
    expect(spotifySearchUrl("a b", "album,track")).toBe(
      "/api/spotify?action=search&q=a%20b&type=album,track",
    );
  });
});

describe("asRows", () => {
  it("passes arrays through and turns anything else into []", () => {
    expect(asRows<number>([1, 2])).toEqual([1, 2]);
    expect(asRows({ error: "x" })).toEqual([]);
    expect(asRows(null)).toEqual([]);
  });
});
