import { beforeEach, describe, expect, it, vi } from "vitest";

const tmdb = vi.hoisted(() => ({
  searchMulti: vi.fn(),
  discoverByGenre: vi.fn(),
  getTopRated: vi.fn(),
  getTrending: vi.fn(),
}));

vi.mock("@/lib/tmdb/tmdb", async () => {
  const actual = await vi.importActual<typeof import("@/lib/tmdb/tmdb")>("@/lib/tmdb/tmdb");
  return { ...actual, ...tmdb };
});

import { GET } from "./route";

const call = (query: string) => GET(new Request(`http://localhost/api?${query}`));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api", () => {
  it("trending keeps only films and TV, with w342 posters", async () => {
    tmdb.getTrending.mockResolvedValue([
      { id: 1, media_type: "movie", poster_path: "/a.jpg" },
      { id: 2, media_type: "person", poster_path: "/b.jpg" },
      { id: 3, media_type: "tv", poster_path: null },
      { id: 4, poster_path: "/c.jpg" },
    ]);
    const res = await call("action=trending");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: number; poster_url: string | null }[];
    expect(body.map((r) => r.id)).toEqual([1, 3]);
    expect(body[0].poster_url).toContain("/w342/a.jpg");
    expect(body[1].poster_url).toBeNull();
  });

  it("returns 400 for a missing or unknown action", async () => {
    expect((await call("")).status).toBe(400);
    expect((await call("action=nope")).status).toBe(400);
    expect((await call("action=constructor")).status).toBe(400);
  });

  it("returns 400 for an invalid type", async () => {
    expect((await call("action=detail&id=1&type=album")).status).toBe(400);
    expect((await call("action=top_rated&type=album")).status).toBe(400);
    expect((await call("action=discover&type=album&genres=28")).status).toBe(400);
  });

  it("validates genres", async () => {
    expect((await call("action=discover&genres=")).status).toBe(400);
    expect((await call("action=discover&genres=28,abc")).status).toBe(400);
    expect((await call("action=discover&genres=28;drop")).status).toBe(400);
    tmdb.discoverByGenre.mockResolvedValue([]);
    expect((await call("action=discover&genres=28,12")).status).toBe(200);
    expect(tmdb.discoverByGenre).toHaveBeenCalledWith("movie", "28,12");
  });

  it("returns w342 posters from search", async () => {
    tmdb.searchMulti.mockResolvedValue([{ id: 1, media_type: "movie", title: "A", poster_path: "/a.jpg" }]);
    const body = await (await call("action=search&q=a")).json();
    expect(body[0].poster_url).toBe("https://image.tmdb.org/t/p/w342/a.jpg");
  });

  it("returns an empty list for a blank search without calling TMDB", async () => {
    expect(await (await call("action=search&q=%20")).json()).toEqual([]);
    expect(tmdb.searchMulti).not.toHaveBeenCalled();
  });

  it("returns 500 with the message when TMDB fails", async () => {
    tmdb.getTopRated.mockRejectedValue(new Error("TMDB API error: 500"));
    const res = await call("action=top_rated");
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "TMDB API error: 500" });
  });
});
