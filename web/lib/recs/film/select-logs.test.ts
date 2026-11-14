import { describe, expect, test } from "vitest";
import { formatWatchLogs, selectWatchLogs, type WatchLogRow } from "./select-logs";

function log(i: number, over: Partial<WatchLogRow> = {}): WatchLogRow {
  return {
    tmdb_id: i, title: `Film ${i}`, media_type: "movie", rating: 5,
    review: null, plot_rating: null, cinematography_rating: null, acting_rating: null,
    soundtrack_rating: null, pacing_rating: null, casting_rating: null,
    watched_date: new Date(2020, 0, 1 + i).toISOString().slice(0, 10), ...over,
  };
}

describe("selectWatchLogs", () => {
  test("returns all at 80 logs", () => {
    const logs = Array.from({ length: 80 }, (_, i) => log(i));
    expect(selectWatchLogs(logs)).toHaveLength(80);
  });
  test("at 200 logs includes every reviewed log and the 50 most recent, without duplicates", () => {
    const logs = Array.from({ length: 200 }, (_, i) =>
      log(i, { review: i % 40 === 0 ? "good" : null, rating: (i % 10) + 1 }));
    const out = selectWatchLogs(logs);
    const ids = out.map((l) => l.tmdb_id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const l of logs.filter((l) => l.review)) expect(ids).toContain(l.tmdb_id);
    for (let i = 150; i < 200; i++) expect(ids).toContain(i);
    expect(out.length).toBeLessThan(200);
  });
});

describe("formatWatchLogs", () => {
  test("formatWatchLogs cuts a 500-char review to 300", () => {
    const out = formatWatchLogs([log(1, { review: "x".repeat(500) })]);
    expect(out).toContain("x".repeat(300));
    expect(out).not.toContain("x".repeat(301));
  });
});
