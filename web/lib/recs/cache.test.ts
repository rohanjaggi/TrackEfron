import { describe, expect, test } from "vitest";
import { CACHE_DAYS, isCacheValid } from "./cache";

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
