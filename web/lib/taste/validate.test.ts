import { describe, it, expect } from "vitest";
import { validateObservations, limitTasteDNA } from "./validate";
import type { TasteDNA } from "@/lib/ai/types";

const obs = (cited_title: string) => ({ text: "You like it.", cited_title });

describe("validateObservations", () => {
  const logged = ["Mulholland Drive", "Blonde"];

  it("keeps an exact match", () => {
    expect(validateObservations([obs("Blonde")], logged)).toEqual([obs("Blonde")]);
  });

  it("keeps a match differing only in case and punctuation", () => {
    expect(validateObservations([obs("mulholland drive!")], logged)).toHaveLength(1);
  });

  it("drops an unknown title", () => {
    expect(validateObservations([obs("Inception"), obs("Blonde")], logged)).toEqual([obs("Blonde")]);
  });

  it("returns [] for []", () => {
    expect(validateObservations([], logged)).toEqual([]);
  });
});

describe("limitTasteDNA", () => {
  const base: TasteDNA = {
    fingerprint: "x",
    pulse: ["a", "b", "c"],
    observations: [obs("A"), obs("B")],
    film_identity: { core: "c", aspect_lens: "l" },
    music_identity: { core: "c", aspect_lens: "l" },
    blind_spots: ["z"],
  };

  it("trims pulse to 3 and observations to 3", () => {
    const out = limitTasteDNA({
      ...base,
      pulse: ["a", "b", "c", "d"],
      observations: [obs("1"), obs("2"), obs("3"), obs("4")],
    });
    expect(out?.pulse).toEqual(["a", "b", "c"]);
    expect(out?.observations).toHaveLength(3);
  });

  it("rejects fewer than 3 pulse words", () => {
    expect(limitTasteDNA({ ...base, pulse: ["a", "b"] })).toBeNull();
    expect(limitTasteDNA({ ...base, pulse: ["a", " ", "c"] })).toBeNull();
    expect(limitTasteDNA({ ...base, pulse: undefined as unknown as string[] })).toBeNull();
  });

  it("drops multi-word pulse entries before taking three", () => {
    const out = limitTasteDNA({ ...base, pulse: ["dark and moody", "a", "b", "c", "d"] });
    expect(out?.pulse).toEqual(["a", "b", "c"]);
    expect(limitTasteDNA({ ...base, pulse: ["two words", "a", "b"] })).toBeNull();
  });

  it("de-duplicates observations by normalised cited_title", () => {
    const out = limitTasteDNA({ ...base, observations: [obs("Blonde"), obs("blonde!"), obs("Heat")] });
    expect(out?.observations.map((o) => o.cited_title)).toEqual(["Blonde", "Heat"]);
  });

  it("tolerates missing observations", () => {
    expect(limitTasteDNA({ ...base, observations: undefined as unknown as [] })?.observations).toEqual([]);
  });
});
