import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { tmdbGet } from "./tmdb";

const fetchMock = vi.fn();

beforeEach(() => {
  process.env.TMDB_BEARER_TOKEN = "test-token";
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function ok(body: unknown) {
  return { ok: true, status: 200, statusText: "OK", json: async () => body };
}

describe("tmdbGet", () => {
  it("builds the URL from the path and params, with no api_key", async () => {
    fetchMock.mockResolvedValue(ok({ results: [] }));
    await tmdbGet("/search/movie", { query: "the matrix & co", page: 1 });

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.origin + url.pathname).toBe("https://api.themoviedb.org/3/search/movie");
    expect(url.searchParams.get("query")).toBe("the matrix & co");
    expect(url.searchParams.get("page")).toBe("1");
    expect(url.searchParams.has("api_key")).toBe(false);
  });

  it("sends the Bearer token", async () => {
    fetchMock.mockResolvedValue(ok({}));
    await tmdbGet("/movie/1");

    const init = fetchMock.mock.calls[0][1] as { headers: Record<string, string> };
    expect(init.headers.Authorization).toBe("Bearer test-token");
  });

  it("returns the parsed JSON body", async () => {
    fetchMock.mockResolvedValue(ok({ id: 7 }));
    await expect(tmdbGet<{ id: number }>("/movie/7")).resolves.toEqual({ id: 7 });
  });

  it("throws with the status on a non-2xx response", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404, statusText: "Not Found", json: async () => ({}) });
    await expect(tmdbGet("/movie/0")).rejects.toThrow(/404/);
  });
});
