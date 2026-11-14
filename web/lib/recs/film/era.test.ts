import { describe, expect, test } from "vitest";
import { eraLimits } from "./era";

describe("eraLimits", () => {
  test("picks the two most common decades", () =>
    expect(eraLimits([2021, 2023, 2015, 2012, 2004]).topDecades).toEqual([2020, 2010]));
  test("olderBefore is the earlier top decade", () =>
    expect(eraLimits([2021, 2023, 2015, 2012, 2004]).olderBefore).toBe(2010));
  test("no years gives olderBefore null and maxOlder 5", () => {
    const r = eraLimits([]);
    expect(r.olderBefore).toBeNull();
    expect(r.topDecades).toEqual([]);
    expect(r.maxOlder).toBe(5);
  });
  test("ties go to the later decade", () =>
    expect(eraLimits([1990, 2000, 2010]).topDecades).toEqual([2010, 2000]));
});
