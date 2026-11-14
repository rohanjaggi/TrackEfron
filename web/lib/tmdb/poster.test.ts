import { describe, expect, it } from "vitest";
import { resizePoster } from "./poster";

describe("resizePoster", () => {
  it("swaps the TMDB size segment", () => {
    expect(resizePoster("https://image.tmdb.org/t/p/w92/a.jpg", "w500")).toBe("https://image.tmdb.org/t/p/w500/a.jpg");
  });

  it("returns null for a missing url", () => {
    expect(resizePoster(null, "w342")).toBeNull();
    expect(resizePoster(undefined, "w342")).toBeNull();
  });

  it("leaves URLs without a size segment alone", () => {
    expect(resizePoster("https://i.scdn.co/image/abc", "w342")).toBe("https://i.scdn.co/image/abc");
  });
});
