import { describe, expect, test } from "vitest";
import {
  TYPE_META,
  averageRating,
  countLabel,
  countReviews,
  formatDay,
  hasReview,
  isMusicType,
  mediaHref,
} from "./media";

describe("countLabel", () => {
  test("film singular and plural", () => {
    expect(countLabel(1, false)).toBe("1 film or show");
    expect(countLabel(0, false)).toBe("0 films and shows");
    expect(countLabel(3, false)).toBe("3 films and shows");
  });
  test("music singular and plural", () => {
    expect(countLabel(1, true)).toBe("1 album or track");
    expect(countLabel(0, true)).toBe("0 albums and tracks");
    expect(countLabel(12, true)).toBe("12 albums and tracks");
  });
});

describe("mediaHref", () => {
  test("films link by TMDB id", () => {
    expect(mediaHref("movie", { tmdbId: 5 })).toBe("/protected/media/movie/5");
    expect(mediaHref("tv", { tmdbId: 7, spotifyId: "ignored" })).toBe("/protected/media/tv/7");
  });
  test("music prefers the Spotify id and falls back to TMDB", () => {
    expect(mediaHref("album", { spotifyId: "abc", tmdbId: 9 })).toBe("/protected/media/album/abc");
    expect(mediaHref("track", { spotifyId: null, tmdbId: 9 })).toBe("/protected/media/track/9");
    expect(mediaHref("track", { spotifyId: "", tmdbId: 9 })).toBe("/protected/media/track/9");
  });
  test("null, undefined, empty and zero ids give undefined", () => {
    expect(mediaHref("movie", { tmdbId: null })).toBeUndefined();
    expect(mediaHref("movie", {})).toBeUndefined();
    expect(mediaHref("movie", { tmdbId: 0 })).toBeUndefined();
    expect(mediaHref("album", { spotifyId: undefined, tmdbId: undefined })).toBeUndefined();
    expect(mediaHref("album", { spotifyId: "" })).toBeUndefined();
  });
});

describe("TYPE_META and isMusicType", () => {
  test("long and short labels", () => {
    expect(TYPE_META.tv.label).toBe("TV show");
    expect(TYPE_META.tv.shortLabel).toBe("TV");
    expect(TYPE_META.movie.label).toBe("Film");
    expect(TYPE_META.album.shortLabel).toBe("Album");
    expect(TYPE_META.track.plural).toBe("tracks");
  });
  test("isMusicType", () => {
    expect(isMusicType("album")).toBe(true);
    expect(isMusicType("track")).toBe(true);
    expect(isMusicType("movie")).toBe(false);
    expect(isMusicType("tv")).toBe(false);
    expect(isMusicType(null)).toBe(false);
    expect(isMusicType(undefined)).toBe(false);
  });
});

describe("formatDay", () => {
  test("formats as d MMM yyyy", () => {
    expect(formatDay("2026-11-14T12:00:00")).toBe("14 Nov 2026");
  });
});

describe("hasReview and countReviews", () => {
  test("blank reviews do not count", () => {
    expect(hasReview(null)).toBe(false);
    expect(hasReview(undefined)).toBe(false);
    expect(hasReview("")).toBe(false);
    expect(hasReview("   \n")).toBe(false);
    expect(hasReview(" ok ")).toBe(true);
    expect(countReviews([{ review: "a" }, { review: " " }, { review: null }, {}])).toBe(1);
  });
});

describe("averageRating", () => {
  test("leaves out unrated entries by default", () => {
    expect(averageRating([4, 0, null, undefined, 5])).toBe("4.5");
    expect(averageRating(["3", 4])).toBe("3.5");
  });
  test("placeholder defaults to an em dash and can be an en dash", () => {
    expect(averageRating([])).toBe("—");
    expect(averageRating([0, null])).toBe("—");
    expect(averageRating([], { empty: "–" })).toBe("–");
    expect(averageRating([0], { empty: "–" })).toBe("–");
  });
  test("includeUnrated counts every entry, with unrated as 0", () => {
    expect(averageRating([4, 0, 2], { includeUnrated: true })).toBe("2.0");
    expect(averageRating([4, null], { includeUnrated: true })).toBe("2.0");
    expect(averageRating([], { includeUnrated: true })).toBe("—");
  });
});
