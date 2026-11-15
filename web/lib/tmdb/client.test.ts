import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearTitleDetailCache, fetchTitleDetail } from "./client";

const body = {
  genres: [{ name: "Drama" }],
  release_date: "1999-03-31",
  runtime: 136,
  vote_average: 8.2,
  poster_url: "p.jpg",
};
const ok = () => ({ ok: true, json: async () => body }) as Response;

describe("fetchTitleDetail", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    clearTitleDetailCache();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("maps the response and fetches once for repeated calls", async () => {
    fetchMock.mockResolvedValue(ok());
    const a = await fetchTitleDetail("movie", 603);
    const b = await fetchTitleDetail("movie", 603);
    expect(a).toEqual({
      runtime: 136,
      seasons: undefined,
      episodes: undefined,
      genres: ["Drama"],
      voteAvg: 8.2,
      releaseYear: 1999,
      posterUrl: "p.jpg",
    });
    expect(b).toBe(a);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api?action=detail&type=movie&id=603");
  });

  it("keys by type as well as id", async () => {
    fetchMock.mockResolvedValue(ok());
    await fetchTitleDetail("movie", 1);
    await fetchTitleDetail("tv", 1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not cache failures", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false } as Response);
    expect(await fetchTitleDetail("tv", 5)).toBeNull();
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    expect(await fetchTitleDetail("tv", 5)).toBeNull();
    fetchMock.mockResolvedValueOnce(ok());
    expect(await fetchTitleDetail("tv", 5)).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("shares one request between concurrent calls", async () => {
    fetchMock.mockResolvedValue(ok());
    const [a, b] = await Promise.all([fetchTitleDetail("movie", 9), fetchTitleDetail("movie", 9)]);
    expect(a).toBe(b);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
