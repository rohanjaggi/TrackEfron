import { afterEach, describe, expect, test, vi } from "vitest";
import { fetchRecentPlays, groupRecentPlays, localDay, playedLabel, type RawPlay } from "./recent";

const play = (trackId: string, albumId: string, at: string, over: Partial<RawPlay["track"] & object> = {}): RawPlay => ({
  track: {
    id: trackId,
    name: `T-${trackId}`,
    artists: [{ name: "Artist" }],
    album: { id: albumId, name: `A-${albumId}` },
    ...over,
  } as RawPlay["track"],
  played_at: at,
});

describe("groupRecentPlays", () => {
  test("one candidate per distinct track, newest first, counting plays", () => {
    const out = groupRecentPlays(
      [play("t1", "a1", "2026-11-15T10:00:00Z"), play("t2", "a2", "2026-11-15T09:00:00Z"), play("t1", "a1", "2026-11-14T10:00:00Z")],
      new Set(),
    );
    expect(out.map((c) => [c.type, c.id, c.plays])).toEqual([["track", "t1", 2], ["track", "t2", 1]]);
    expect(out[0].last_played_at).toBe("2026-11-15T10:00:00Z");
  });
  test("3 distinct tracks of one album fold into an album candidate", () => {
    const out = groupRecentPlays(
      [play("t1", "a1", "2026-11-15T10:00:00Z"), play("t2", "a1", "2026-11-15T09:00:00Z"), play("t3", "a1", "2026-11-15T08:00:00Z"), play("t1", "a1", "2026-11-15T07:00:00Z")],
      new Set(),
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ type: "album", id: "a1", name: "A-a1", plays: 3, last_played_at: "2026-11-15T10:00:00Z" });
  });
  test("album candidate uses album artists and first image", () => {
    const album = { id: "a1", name: "A-a1", artists: [{ name: "X" }, { name: "Y" }], images: [{ url: "/big" }, { url: "/small" }], release_date: "2007-10-10" };
    const out = groupRecentPlays(
      ["t1", "t2", "t3"].map((t, i) => play(t, "a1", `2026-11-15T0${9 - i}:00:00Z`, { album })),
      new Set(),
    );
    expect(out[0]).toMatchObject({ type: "album", artist: "X, Y", album_name: "A-a1", image_url: "/big", release_date: "2007-10-10" });
  });
  test("track candidate carries artist, album name and image", () => {
    const album = { id: "a1", name: "A-a1", images: [{ url: "/img" }], release_date: "2016-08-20" };
    const out = groupRecentPlays([play("t1", "a1", "2026-11-15T10:00:00Z", { album, artists: [{ name: "P" }, { name: "Q" }] })], new Set());
    expect(out[0]).toMatchObject({ type: "track", name: "T-t1", artist: "P, Q", album_name: "A-a1", image_url: "/img", release_date: "2016-08-20" });
  });
  test("2 distinct tracks of one album stay as tracks", () => {
    const out = groupRecentPlays(
      [play("t1", "a1", "2026-11-15T10:00:00Z"), play("t2", "a1", "2026-11-15T09:00:00Z")],
      new Set(),
    );
    expect(out.map((c) => [c.type, c.id])).toEqual([["track", "t1"], ["track", "t2"]]);
  });
  test("logged track ids are dropped", () => {
    const out = groupRecentPlays(
      [play("t1", "a1", "2026-11-15T10:00:00Z"), play("t2", "a2", "2026-11-15T09:00:00Z")],
      new Set(["t1"]),
    );
    expect(out.map((c) => c.id)).toEqual(["t2"]);
  });
  test("a logged album with 3+ tracks is dropped and its tracks do not reappear", () => {
    const out = groupRecentPlays(
      [
        play("t1", "a1", "2026-11-15T10:00:00Z"),
        play("t2", "a1", "2026-11-15T09:00:00Z"),
        play("t3", "a1", "2026-11-15T08:00:00Z"),
        play("t4", "a2", "2026-11-15T07:00:00Z"),
      ],
      new Set(["a1"]),
    );
    expect(out.map((c) => [c.type, c.id])).toEqual([["track", "t4"]]);
  });
  test("an album whose played tracks are all logged individually is dropped", () => {
    const plays = ["t1", "t2", "t3"].map((t, i) => play(t, "a1", `2026-11-15T0${9 - i}:00:00Z`));
    expect(groupRecentPlays(plays, new Set(["t1", "t2", "t3"]))).toEqual([]);
    expect(groupRecentPlays(plays, new Set(["t1", "t2"])).map((c) => [c.type, c.id])).toEqual([["album", "a1"]]);
  });
  test("plays with a null track or a track without an id are skipped", () => {
    const out = groupRecentPlays(
      [{ track: null, played_at: "2026-11-15T10:00:00Z" }, play("", "a1", "2026-11-15T09:00:00Z")],
      new Set(),
    );
    expect(out).toEqual([]);
  });
  test("tracks without an album id are never folded", () => {
    const noAlbum = (id: string, at: string) => play(id, "x", at, { album: undefined });
    const out = groupRecentPlays(
      [noAlbum("t1", "2026-11-15T10:00:00Z"), noAlbum("t2", "2026-11-15T09:00:00Z"), noAlbum("t3", "2026-11-15T08:00:00Z")],
      new Set(),
    );
    expect(out.map((c) => c.type)).toEqual(["track", "track", "track"]);
    expect(out[0].album_name).toBe("");
    expect(out[0].image_url).toBeNull();
  });
  test("caps at max, default 12", () => {
    const plays = Array.from({ length: 15 }, (_, i) =>
      play(`t${i}`, `a${i}`, new Date(Date.UTC(2026, 10, 15, 12, 0, 59 - i)).toISOString()),
    );
    expect(groupRecentPlays(plays, new Set())).toHaveLength(12);
    expect(groupRecentPlays(plays, new Set(), 2).map((c) => c.id)).toEqual(["t0", "t1"]);
  });
  test("empty input gives an empty list", () => {
    expect(groupRecentPlays([], new Set())).toEqual([]);
  });
});

describe("fetchRecentPlays", () => {
  afterEach(() => vi.unstubAllGlobals());
  const stub = (res: Partial<Response> & { text?: () => Promise<string> }) => {
    const f = vi.fn(async () => res as Response);
    vi.stubGlobal("fetch", f);
    return f;
  };

  test("requests /v1/me/player/recently-played?limit=50 with the bearer token and returns items", async () => {
    const items = [play("t1", "a1", "2026-11-15T10:00:00Z")];
    const f = stub({ ok: true, status: 200, text: async () => JSON.stringify({ items }) });
    expect(await fetchRecentPlays("tok")).toEqual(items);
    expect(f).toHaveBeenCalledWith("https://api.spotify.com/v1/me/player/recently-played?limit=50", {
      headers: { Authorization: "Bearer tok" },
    });
  });
  test("204 gives []", async () => {
    stub({ ok: true, status: 204, text: async () => "" });
    expect(await fetchRecentPlays("tok")).toEqual([]);
  });
  test("200 with an empty body gives []", async () => {
    stub({ ok: true, status: 200, text: async () => "" });
    expect(await fetchRecentPlays("tok")).toEqual([]);
  });
  test("401 and 403 give null", async () => {
    stub({ ok: false, status: 401, statusText: "Unauthorized" });
    expect(await fetchRecentPlays("tok")).toBeNull();
    stub({ ok: false, status: 403, statusText: "Forbidden" });
    expect(await fetchRecentPlays("tok")).toBeNull();
  });
  test("500 throws", async () => {
    stub({ ok: false, status: 500, statusText: "Server Error" });
    await expect(fetchRecentPlays("tok")).rejects.toThrow(/Server Error/);
  });
});

describe("localDay / playedLabel", () => {
  test("localDay uses local date parts", () => {
    const d = new Date(2026, 10, 15, 0, 5); // local 00:05 on 15 Nov
    expect(localDay(d.toISOString())).toBe("2026-11-15");
  });
  test("labels", () => {
    const now = new Date(2026, 10, 15, 12);
    expect(playedLabel(new Date(2026, 10, 15, 1).toISOString(), now)).toBe("today");
    expect(playedLabel(new Date(2026, 10, 14, 23).toISOString(), now)).toBe("yesterday");
    expect(playedLabel(new Date(2026, 10, 12, 9).toISOString(), now)).toBe("12 Nov");
  });
});
