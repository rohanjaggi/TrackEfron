import { describe, expect, test, vi } from "vitest";
import type { MusicRecommendation, SpotifyTops } from "@/lib/ai/types";
import type { RawPlay } from "@/lib/spotify/recent";
import { buildMusicRecs, type ListenLogRow } from "./build";

const log = (n: number, rating: number | null = 4, over: Partial<ListenLogRow> = {}): ListenLogRow => ({
  spotify_id: `log${n}`, title: `Log${n}`, artist: `Artist${n}`, media_type: "album", rating,
  review: null, lyrics_rating: null, production_rating: null, vocals_rating: null,
  melody_rating: null, replay_rating: null, energy_rating: null, ...over,
});
const logs = (n: number) => Array.from({ length: n }, (_, i) => log(i + 1));

const artist = (id: string, name: string, genres: string[] = ["indie"]) => ({ id, name, genres, image_url: null });
const tops: SpotifyTops = {
  artists: {
    short_term: [artist("s1", "ShortArtist", ["dream pop"]), artist("l1", "LongArtist")],
    medium_term: [artist("m1", "MediumArtist")],
    long_term: [artist("l1", "LongArtist", ["shoegaze"]), artist("l2", "GoneArtist")],
  },
  tracks: {
    short_term: [{ id: "st1", name: "ShortTrack", artist: "ShortArtist" }],
    medium_term: [{ id: "mt1", name: "MediumTrack", artist: "MediumArtist" }],
    long_term: [{ id: "lt1", name: "LongTrack", artist: "LongArtist" }],
  },
};

const rec = (n: number): MusicRecommendation => ({
  artist: `Rec${n}`, title: `Title${n}`, type: "album", explanation: "because", confidence: "high",
});
const hit = (n: number) => ({
  id: `sp${n}`, name: `Title${n}`, artist: `Rec${n}`, type: "album" as const,
  image_url: `/i${n}`, album_name: `Title${n}`,
});

const play = (trackId: string, albumId: string, playedAt = "2026-11-14T10:00:00Z"): RawPlay => ({
  track: { id: trackId, name: `T-${trackId}`, artists: [{ name: "Artist" }], album: { id: albumId, name: `A-${albumId}` } },
  played_at: playedAt,
});

function deps(over: Record<string, unknown> = {}) {
  const ai = vi.fn<(system: string, user: string) => Promise<{ recommendations: MusicRecommendation[] }>>(
    async () => ({ recommendations: [rec(1)] }),
  );
  const search = vi.fn(async (q: string) => {
    const m = /Rec(\d+)/.exec(q);
    return m ? [hit(Number(m[1]))] : [];
  });
  return {
    ai, search,
    d: {
      logs: logs(6), queue: [], tops: null, recent: null, tasteDNA: null, search, ai, ...over,
    } as unknown as Parameters<typeof buildMusicRecs>[0],
  };
}

describe("buildMusicRecs", () => {
  test("null tops and 3 rated logs returns not_enough_logs without calling ai", async () => {
    const { ai, search, d } = deps({ logs: [...logs(3), log(8, null), log(9, null)] });
    expect(await buildMusicRecs(d)).toEqual({ status: "not_enough_logs", items: [], right_now: null });
    expect(ai).not.toHaveBeenCalled();
    expect(search).not.toHaveBeenCalled();
  });
  test("null tops and 6 rated logs builds with right_now null", async () => {
    const { d } = deps();
    const r = await buildMusicRecs(d);
    expect(r.status).toBe("ok");
    expect(r.right_now).toBeNull();
    expect(r.items[0]).toMatchObject({ spotify_id: "sp1", image_url: "/i1" });
  });
  test("tops present and zero logs builds", async () => {
    const { ai, d } = deps({ logs: [], tops });
    const r = await buildMusicRecs(d);
    expect(ai).toHaveBeenCalledTimes(1);
    expect(r.status).toBe("ok");
    expect(r.right_now?.rising.map((a) => a.id)).toEqual(["s1"]);
    expect(r.right_now?.dropped_off.map((a) => a.id)).toEqual(["l2"]);
  });
  test("user message contains all three window labels with artists, genres and tracks when tops present", async () => {
    const { ai, d } = deps({ tops });
    await buildMusicRecs(d);
    const user = ai.mock.calls[0][1];
    for (const label of ["LAST 4 WEEKS", "LAST 6 MONTHS", "LONG TERM"]) expect(user).toContain(label);
    expect(user).toContain("ShortArtist (dream pop)");
    expect(user).toContain("LongTrack by LongArtist");
  });
  test("user message has no window labels when tops is null", async () => {
    const { ai, d } = deps();
    await buildMusicRecs(d);
    expect(ai.mock.calls[0][1]).not.toContain("LONG TERM");
  });
  test("reviews are cut to 300 characters", async () => {
    const { ai, d } = deps({ logs: [log(1, 5, { review: "x".repeat(400) }), ...logs(6).slice(1)] });
    await buildMusicRecs(d);
    const user = ai.mock.calls[0][1];
    expect(user).toContain("x".repeat(300));
    expect(user).not.toContain("x".repeat(301));
  });
  test("tolerates tasteDNA null and an old-shape music_profile with extra fields", async () => {
    const { ai, d } = deps({
      tasteDNA: {
        fingerprint: "Bass-heavy romantic",
        music_profile: { core: "Loves lush production", aspect_lens: "production", patterns: "x", rating_style: "y" },
      },
    });
    await buildMusicRecs(d);
    const user = ai.mock.calls[0][1];
    expect(user).toContain("Bass-heavy romantic");
    expect(user).toContain("Loves lush production");
    expect(user).toContain("production");
  });
  test("logged and queued spotify ids are excluded from picks", async () => {
    const { d } = deps({
      logs: [log(1, 4, { spotify_id: "sp1" }), ...logs(6).slice(1)],
      queue: [{ spotify_id: "sp2", title: "Title2", artist: "Rec2" }, { spotify_id: null, title: "N", artist: null }],
      ai: async () => ({ recommendations: [rec(1), rec(2), rec(3)] }),
    });
    const r = await buildMusicRecs(d);
    expect(r.items.map((i) => i.spotify_id)).toEqual(["sp3"]);
  });
  test("top tracks and recent plays are excluded from picks", async () => {
    const topsWithSp1: SpotifyTops = { ...tops, tracks: { ...tops.tracks, short_term: [{ id: "sp1", name: "X", artist: "Y" }] } };
    const { d } = deps({
      tops: topsWithSp1,
      recent: [play("sp2", "alb")],
      ai: async () => ({ recommendations: [rec(1), rec(2), rec(3)] }),
    });
    const r = await buildMusicRecs(d);
    expect(r.items.map((i) => i.spotify_id)).toEqual(["sp3"]);
  });
  test("an album with 3+ recent tracks is excluded by album id", async () => {
    const { d } = deps({
      recent: [play("r1", "sp1"), play("r2", "sp1"), play("r3", "sp1")],
      ai: async () => ({ recommendations: [rec(1), rec(2)] }),
    });
    const r = await buildMusicRecs(d);
    expect(r.items.map((i) => i.spotify_id)).toEqual(["sp2"]);
  });
  test("the prompt lists recent plays and marks them as already in rotation", async () => {
    const { ai, d } = deps({ recent: [play("r1", "a1")] });
    await buildMusicRecs(d);
    const user = ai.mock.calls[0][1];
    expect(user).toContain("RECENTLY PLAYED (Spotify):");
    expect(user).toContain("T-r1 by Artist");
    expect(user).toContain("already in rotation");
  });
  test("recent: null changes nothing", async () => {
    const { ai, d } = deps();
    const r = await buildMusicRecs(d);
    expect(ai.mock.calls[0][1]).not.toContain("RECENTLY PLAYED");
    expect(ai.mock.calls[0][1]).not.toContain("already in rotation");
    expect(r.items.map((i) => i.spotify_id)).toEqual(["sp1"]);
  });
  test("recent plays with a null track are skipped", async () => {
    const { ai, d } = deps({ recent: [{ track: null, played_at: "2026-11-14T10:00:00Z" }, play("r1", "a1")] });
    await buildMusicRecs(d);
    expect(ai.mock.calls[0][1]).toContain("T-r1 by Artist");
  });
  test("recent plays alone (no tops, under 5 rated logs) still returns not_enough_logs", async () => {
    const { ai, d } = deps({ logs: logs(2), recent: [play("r1", "a1")] });
    expect(await buildMusicRecs(d)).toEqual({ status: "not_enough_logs", items: [], right_now: null });
    expect(ai).not.toHaveBeenCalled();
  });
  test("returns empty when matching drops everything", async () => {
    const { d } = deps({ ai: async () => ({ recommendations: [rec(99)] }), search: async () => [] });
    expect(await buildMusicRecs(d)).toEqual({ status: "empty", items: [], right_now: null });
  });
  test("empty keeps right_now when tops present", async () => {
    const { d } = deps({ tops, ai: async () => ({ recommendations: [rec(99)] }), search: async () => [] });
    const r = await buildMusicRecs(d);
    expect(r.status).toBe("empty");
    expect(r.right_now).not.toBeNull();
  });
  test("every search throwing rejects instead of returning empty", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { d } = deps({ search: async () => { throw new Error("spotify down"); } });
    await expect(buildMusicRecs(d)).rejects.toThrow("Spotify search failed");
    vi.restoreAllMocks();
  });
  test("keeps at most 20", async () => {
    const { d } = deps({ ai: async () => ({ recommendations: Array.from({ length: 30 }, (_, i) => rec(i + 1)) }) });
    expect((await buildMusicRecs(d)).items).toHaveLength(20);
  });
  test("ai rejection propagates", async () => {
    const { d } = deps({ ai: async () => { throw new Error("boom"); } });
    await expect(buildMusicRecs(d)).rejects.toThrow("boom");
  });
});
