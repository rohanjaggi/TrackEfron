import { describe, expect, test } from "vitest";
import { fetchLogYears } from "./years";
import type { WatchLogRow } from "./select-logs";

const log = (id: number, extra: Partial<WatchLogRow> = {}): WatchLogRow => ({
  tmdb_id: id,
  title: `t${id}`,
  media_type: "movie",
  rating: 5,
  review: null,
  plot_rating: null,
  cinematography_rating: null,
  acting_rating: null,
  soundtrack_rating: null,
  pacing_rating: null,
  casting_rating: null,
  watched_date: "2024-01-01",
  ...extra,
});

describe("fetchLogYears", () => {
  test("reads movie and tv years and skips failures", async () => {
    const logs = [log(1), log(2), log(3, { media_type: "tv" })];
    const years = await fetchLogYears(logs, async (type, id) => {
      if (id === 2) throw new Error("boom");
      return type === "tv" ? { first_air_date: "2010-05-01" } : { release_date: "1999-01-01" };
    });
    expect(years.sort()).toEqual([1999, 2010]);
  });

  test("fetches at most 60 titles, in batches of 10", async () => {
    const logs = Array.from({ length: 100 }, (_, i) => log(i + 1));
    let inFlight = 0;
    let maxInFlight = 0;
    let calls = 0;
    await fetchLogYears(logs, async () => {
      calls++;
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 1));
      inFlight--;
      return { release_date: "2000-01-01" };
    });
    expect(calls).toBe(60);
    expect(maxInFlight).toBeLessThanOrEqual(10);
  });

  test("puts the selected logs first when the list is long", async () => {
    const logs = Array.from({ length: 200 }, (_, i) => log(i + 1, { review: i === 199 ? "great" : null, rating: 5 }));
    const seen: number[] = [];
    await fetchLogYears(logs, async (_t, id) => {
      seen.push(id);
      return {};
    });
    expect(seen).toContain(200);
  });
});
