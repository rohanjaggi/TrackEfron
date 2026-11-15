import { describe, expect, test } from "vitest";
import { CACHE_DAYS, EMPTY_CACHE_HOURS, SHOWN_HISTORY, cacheExpiry, isCacheValid, nextShownHistory } from "./cache";

const now = new Date("2026-11-14T12:00:00Z");
const future = "2026-11-20T12:00:00Z";
const past = "2026-11-10T12:00:00Z";

describe("isCacheValid", () => {
  test("null row is invalid", () => {
    expect(isCacheValid(null, 5, now)).toBe(false);
  });
  test("valid when counts match and not expired", () => {
    expect(isCacheValid({ expires_at: future, log_count_at_generation: 5 }, 5, now)).toBe(true);
  });
  test("invalid when log count differs", () => {
    expect(isCacheValid({ expires_at: future, log_count_at_generation: 4 }, 5, now)).toBe(false);
  });
  test("invalid when expired", () => {
    expect(isCacheValid({ expires_at: past, log_count_at_generation: 5 }, 5, now)).toBe(false);
  });
  test("CACHE_DAYS is 7", () => {
    expect(CACHE_DAYS).toBe(7);
  });
});

describe("cacheExpiry", () => {
  test("EMPTY_CACHE_HOURS is 1", () => {
    expect(EMPTY_CACHE_HOURS).toBe(1);
  });
  test("ok results expire after CACHE_DAYS", () => {
    expect(cacheExpiry("ok", now).toISOString()).toBe("2026-11-21T12:00:00.000Z");
  });
  test("empty results expire after one hour", () => {
    expect(cacheExpiry("empty", now).toISOString()).toBe("2026-11-14T13:00:00.000Z");
  });
  test("an empty row is valid within the hour and invalid after it", () => {
    const row = { expires_at: cacheExpiry("empty", now).toISOString(), log_count_at_generation: 5 };
    expect(isCacheValid(row, 5, new Date("2026-11-14T12:59:00Z"))).toBe(true);
    expect(isCacheValid(row, 5, new Date("2026-11-14T13:01:00Z"))).toBe(false);
  });
});

describe("nextShownHistory", () => {
  const film = (id: number) => ({ tmdb_id: id, media_type: "movie" as const, title: `Film${id}` });

  test("puts the new batch first, then the earlier history", () => {
    expect(nextShownHistory([film(3), film(4)], [film(1), film(2)])).toEqual([film(3), film(4), film(1), film(2)]);
  });
  test("keeps one entry per title", () => {
    expect(nextShownHistory([film(1), film(2)], [film(2), film(3)])).toEqual([film(1), film(2), film(3)]);
  });
  test("tells a film and a show with the same id apart", () => {
    const show = { tmdb_id: 1, media_type: "tv" as const, title: "Show1" };
    expect(nextShownHistory([film(1)], [show])).toEqual([film(1), show]);
  });
  test("drops the oldest entries past the cap", () => {
    const old = Array.from({ length: SHOWN_HISTORY }, (_, i) => film(i + 100));
    const next = nextShownHistory([film(1)], old);
    expect(next).toHaveLength(SHOWN_HISTORY);
    expect(next[0]).toEqual(film(1));
    expect(next.at(-1)).toEqual(film(100 + SHOWN_HISTORY - 2));
  });
  test("stores only the id, type and title", () => {
    const full = { ...film(1), year: 2020, poster_url: "/p", explanation: "x", confidence: "high" };
    expect(nextShownHistory([full], [])).toEqual([film(1)]);
  });
});
