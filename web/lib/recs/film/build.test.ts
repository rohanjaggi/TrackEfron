import { describe, expect, test, vi } from "vitest";
import type { FilmCandidate, RawFilmPick } from "@/lib/ai/types";
import { buildFilmRecs } from "./build";
import type { GatherResult } from "./candidates";
import type { WatchLogRow } from "./select-logs";

const log = (id: number, rating: number | null = 8): WatchLogRow => ({
  tmdb_id: id, title: `Log${id}`, media_type: "movie", rating, review: null,
  plot_rating: null, cinematography_rating: null, acting_rating: null,
  soundtrack_rating: null, pacing_rating: null, casting_rating: null, watched_date: "2024-01-01",
});
const logs = (n: number) => Array.from({ length: n }, (_, i) => log(i + 1));
const cand = (id: number, year = 2020): FilmCandidate => ({
  tmdb_id: id, media_type: "movie", title: `Cand${id}`, year, genres: ["Drama"],
  overview: "word ".repeat(50).trim(), poster_url: `/p${id}`,
});
const pick = (id: number | null, over: Partial<RawFilmPick> = {}): RawFilmPick => ({
  tmdb_id: id, title: `Cand${id}`, year: 2020, media_type: "movie",
  explanation: "because you logged Log1", confidence: "high", ...over,
});

function deps(over: Record<string, unknown> = {}) {
  const ai = vi.fn<(system: string, user: string) => Promise<{ picks: RawFilmPick[] }>>(async () => ({ picks: [pick(100)] }));
  const gather = vi.fn<(logs: WatchLogRow[], exclude: Set<string>) => Promise<GatherResult>>(async () => ({ candidates: [cand(100)], tmdbDown: false }));
  return {
    ai, gather,
    d: {
      logs: logs(6),
      watchlist: [],
      tasteDNA: null,
      yearsOf: async () => [1995, 1996, 2005, 2006, 2007, 2015],
      gather,
      lookup: async () => null,
      ai,
      ...over,
    } as Parameters<typeof buildFilmRecs>[0],
  };
}

describe("buildFilmRecs", () => {
  test("under 5 rated logs returns not_enough_logs and never calls ai", async () => {
    const { ai, gather, d } = deps({ logs: [...logs(4), log(9, null), log(10, null)] });
    expect(await buildFilmRecs(d)).toEqual({ status: "not_enough_logs", items: [] });
    expect(ai).not.toHaveBeenCalled();
    expect(gather).not.toHaveBeenCalled();
  });
  test("user message contains the ERA line with both decades", async () => {
    const { ai, d } = deps();
    await buildFilmRecs(d);
    const user = ai.mock.calls[0][1];
    expect(user).toContain(
      "ERA: most of what they watch is from the 2000s and 1990s. At most 5 of your picks may be older than 1990.",
    );
  });
  test("user message contains no 'popularity' or 'vote'", async () => {
    const { ai, d } = deps();
    await buildFilmRecs(d);
    const all = (ai.mock.calls[0][0] + ai.mock.calls[0][1]).toLowerCase();
    expect(all).not.toContain("popularity");
    expect(all).not.toContain("vote");
  });
  test("tolerates tasteDNA null and an old-shape film_profile with extra fields", async () => {
    const a = deps();
    await expect(buildFilmRecs(a.d)).resolves.toBeDefined();
    const b = deps({
      tasteDNA: {
        fingerprint: "Moody maximalist",
        film_profile: { core: "Loves slow burns", aspect_lens: "visuals", patterns: "x", rating_style: "y" },
        blind_spots: ["Korean thrillers"],
      },
    });
    await buildFilmRecs(b.d);
    const user = b.ai.mock.calls[0][1];
    expect(user).toContain("Moody maximalist");
    expect(user).toContain("Loves slow burns");
    expect(user).toContain("Korean thrillers");
  });
  test("candidates are listed as id | type | title | year | genres | first 30 words", async () => {
    const { ai, d } = deps();
    await buildFilmRecs(d);
    const user = ai.mock.calls[0][1];
    expect(user).toContain(`100 | movie | Cand100 | 2020 | Drama | ${"word ".repeat(30).trim()}`);
    expect(user).not.toContain("word ".repeat(31).trim());
  });
  test("returns ok with matched picks", async () => {
    const { d } = deps();
    const r = await buildFilmRecs(d);
    expect(r.status).toBe("ok");
    expect(r.items).toHaveLength(1);
    expect(r.items[0]).toMatchObject({ tmdb_id: 100, poster_url: "/p100" });
  });
  test("excludes logged and watchlisted titles from candidates and picks", async () => {
    const { gather, d } = deps({
      watchlist: [{ tmdb_id: 100, media_type: "movie" }],
    });
    const r = await buildFilmRecs(d);
    const exclude = gather.mock.calls[0][1];
    expect(exclude.has("movie:1")).toBe(true);
    expect(exclude.has("movie:100")).toBe(true);
    expect(r.status).toBe("empty");
  });
  test("returns empty when matching drops everything", async () => {
    const { d } = deps({ ai: async () => ({ picks: [pick(999)] }) });
    expect(await buildFilmRecs(d)).toEqual({ status: "empty", items: [] });
  });
  test("zero candidates because TMDB is down throws without calling ai", async () => {
    const { ai, d } = deps({ gather: async () => ({ candidates: [], tmdbDown: true }) });
    await expect(buildFilmRecs(d)).rejects.toThrow("TMDB is unavailable");
    expect(ai).not.toHaveBeenCalled();
  });
  test("zero candidates for a legitimate reason still calls ai, which may propose titles itself", async () => {
    const { ai, d } = deps({
      gather: async () => ({ candidates: [], tmdbDown: false }),
      lookup: async () => cand(500),
    });
    ai.mockResolvedValueOnce({ picks: [pick(null, { title: "Cand500" })] });
    const r = await buildFilmRecs(d);
    expect(ai).toHaveBeenCalledTimes(1);
    expect(r.status).toBe("ok");
  });
  test("ai rejection propagates", async () => {
    const { d } = deps({ ai: async () => { throw new Error("boom"); } });
    await expect(buildFilmRecs(d)).rejects.toThrow("boom");
  });
});
