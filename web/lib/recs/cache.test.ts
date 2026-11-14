import { describe, expect, test } from "vitest";
import { CACHE_DAYS, EMPTY_CACHE_HOURS, cacheExpiry, isCacheValid } from "./cache";

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
