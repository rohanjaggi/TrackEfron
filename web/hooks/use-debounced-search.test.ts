import { describe, expect, it } from "vitest";
import { latestOnly } from "./use-debounced-search";

describe("latestOnly", () => {
  it("keeps only the later query's results when responses resolve out of order", async () => {
    const begin = latestOnly();
    let kept: string[] = [];

    function run(q: string, delay: number) {
      const isCurrent = begin();
      return new Promise<void>((resolve) =>
        setTimeout(() => {
          if (isCurrent()) kept = [q];
          resolve();
        }, delay),
      );
    }

    // "ab" starts second but resolves first; "a" resolves last and must be dropped.
    const first = run("a", 30);
    const second = run("ab", 5);
    await Promise.all([first, second]);
    expect(kept).toEqual(["ab"]);
  });

  it("treats a search as current until a later one begins", () => {
    const begin = latestOnly();
    const a = begin();
    expect(a()).toBe(true);
    const b = begin();
    expect(a()).toBe(false);
    expect(b()).toBe(true);
  });
});
