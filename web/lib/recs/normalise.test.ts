import { describe, expect, test } from "vitest";
import { normalise } from "./normalise";

describe("normalise", () => {
  test("collapses whitespace left by removed punctuation", () => {
    expect(normalise("Crosby, Stills & Nash")).toBe("crosby stills nash");
  });
  test("strips diacritics", () => {
    expect(normalise("Beyoncé")).toBe("beyonce");
  });
  test("keeps non-Latin letters", () => {
    expect(normalise("宇多田ヒカル")).toBe("宇多田ヒカル");
    expect(normalise("Земфира")).toBe("земфира");
  });
});
