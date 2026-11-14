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

describe("selectWatchLogs with undated logs", () => {
  test("does not throw over 80 logs when some watched_date values are null, and keeps undated logs last", () => {
    const logs = Array.from({ length: 120 }, (_, i) => log(i, { watched_date: i < 30 ? null : log(i).watched_date }));
    const ids = selectWatchLogs(logs).map((l) => l.tmdb_id);
    for (let i = 70; i < 120; i++) expect(ids).toContain(i);
  });
  test("undated logs sort after dated ones in the recent slice", () => {
    const logs = Array.from({ length: 90 }, (_, i) => log(i, { rating: null, watched_date: i < 45 ? null : log(i).watched_date }));
    const ids = selectWatchLogs(logs).map((l) => l.tmdb_id);
    expect(ids).toHaveLength(50);
    for (let i = 45; i < 90; i++) expect(ids).toContain(i);
  });
});

describe("formatWatchLogs", () => {
  test("states ratings out of 5", () => {
    const out = formatWatchLogs([log(1, { rating: 4.5 })]);
    expect(out).toContain("rating 4.5/5");
    expect(out).not.toContain("/10");
  });
  test("omits the watched part for an undated log", () => {
    const out = formatWatchLogs([log(1, { watched_date: null })]);
    expect(out).not.toContain("watched");
    expect(out).not.toContain("null");
  });
  test("formatWatchLogs cuts a 500-char review to 300", () => {
    const out = formatWatchLogs([log(1, { review: "x".repeat(500) })]);
    expect(out).toContain("x".repeat(300));
    expect(out).not.toContain("x".repeat(301));
  });
});
