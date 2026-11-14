import { beforeEach, describe, expect, test, vi } from "vitest";
import type { FilmCandidate } from "@/lib/ai/types";
import * as tmdb from "@/lib/tmdb/tmdb";
import { gatherFilmCandidates, mergeCandidates } from "./candidates";
import type { WatchLogRow } from "./select-logs";

vi.mock("@/lib/tmdb/tmdb", async (orig) => ({
  ...(await orig<typeof import("@/lib/tmdb/tmdb")>()),
  getRecommendations: vi.fn(),
  getMovieDetails: vi.fn(),
  getTvDetails: vi.fn(),
  discoverFiltered: vi.fn(),
}));

const c = (id: number): FilmCandidate => ({
  tmdb_id: id, media_type: "movie", title: `T${id}`, year: 2020, genres: [], overview: "", poster_url: null,
});
const range = (start: number, n: number) => Array.from({ length: n }, (_, i) => c(start + i));
const ids = (l: FilmCandidate[]) => l.map((x) => x.tmdb_id);

describe("mergeCandidates", () => {
  test("discover results survive when recommendations alone exceed the cap", () => {
    const recs = [range(0, 20), range(100, 20), range(200, 20), range(300, 20)];
    const out = mergeCandidates(recs, range(1000, 30), range(2000, 30), new Set());
    expect(out).toHaveLength(60);
    expect(ids(out).filter((i) => i >= 1000)).toHaveLength(20);
    expect(ids(out).filter((i) => i >= 2000)).toHaveLength(10);
  });
  test("every seed contributes when all seeds are full", () => {
    const recs = Array.from({ length: 6 }, (_, s) => range(s * 100, 20));
    const out = mergeCandidates(recs, range(1000, 30), range(2000, 30), new Set());
    for (let s = 0; s < 6; s++) {
      expect(ids(out).some((i) => i >= s * 100 && i < s * 100 + 20)).toBe(true);
    }
  });
  test("duplicates and excluded keys are removed", () => {
    const out = mergeCandidates([[c(1), c(2), c(3)]], [c(2), c(4)], [c(4), c(5)], new Set(["movie:3", "movie:5"]));
    expect(ids(out).sort()).toEqual([1, 2, 4]);
  });
  test("the cap holds", () => {
    const out = mergeCandidates([range(0, 50)], range(100, 50), range(200, 50), new Set(), 30);
    expect(out).toHaveLength(30);
  });
  test("unused discover slots are filled by recommendations", () => {
    const out = mergeCandidates([range(0, 40), range(100, 40)], range(1000, 3), [], new Set());
    expect(out).toHaveLength(60);
    expect(ids(out).filter((i) => i >= 1000)).toHaveLength(3);
  });
  test("unused recommendation slots are filled by discover", () => {
    const out = mergeCandidates([range(0, 5)], range(1000, 30), range(2000, 30), new Set());
    expect(out).toHaveLength(60);
  });
});

const seedLog = (id: number): WatchLogRow => ({
  tmdb_id: id, title: `L${id}`, media_type: "movie", rating: 5, review: null,
  plot_rating: null, cinematography_rating: null, acting_rating: null,
  soundtrack_rating: null, pacing_rating: null, casting_rating: null, watched_date: "2024-01-01",
});

describe("gatherFilmCandidates tmdbDown", () => {
  beforeEach(() => vi.resetAllMocks());
  test("is true when every TMDB call fails", async () => {
    vi.mocked(tmdb.getRecommendations).mockRejectedValue(new Error("down"));
    vi.mocked(tmdb.getMovieDetails).mockRejectedValue(new Error("down"));
    const r = await gatherFilmCandidates([seedLog(1), seedLog(2)], new Set());
    expect(r).toEqual({ candidates: [], tmdbDown: true });
  });
  test("is false when TMDB answers but nothing survives", async () => {
    vi.mocked(tmdb.getRecommendations).mockResolvedValue([]);
    vi.mocked(tmdb.getMovieDetails).mockResolvedValue({ id: 1, genres: [] });
    const r = await gatherFilmCandidates([seedLog(1)], new Set());
    expect(r).toEqual({ candidates: [], tmdbDown: false });
  });
  test("is false when only some calls fail", async () => {
    vi.mocked(tmdb.getRecommendations).mockRejectedValue(new Error("down"));
    vi.mocked(tmdb.getMovieDetails).mockResolvedValue({ id: 1, genres: [] });
    const r = await gatherFilmCandidates([seedLog(1)], new Set());
    expect(r.tmdbDown).toBe(false);
  });
  test("is false with no rated seeds", async () => {
    const r = await gatherFilmCandidates([{ ...seedLog(1), rating: null }], new Set());
    expect(r).toEqual({ candidates: [], tmdbDown: false });
  });
});
