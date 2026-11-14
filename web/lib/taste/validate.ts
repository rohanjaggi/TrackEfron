import { normalise } from "@/lib/recs/normalise";
import type { TasteDNA, TasteObservation } from "@/lib/ai/types";

/** Keeps observations whose cited_title matches a logged title after normalising. */
export function validateObservations(obs: TasteObservation[], loggedTitles: string[]): TasteObservation[] {
  const logged = new Set(loggedTitles.map(normalise).filter(Boolean));
  return obs.filter((o) => {
    const t = normalise(o.cited_title ?? "");
    return t !== "" && logged.has(t);
  });
}

/**
 * Enforces the limits the tool schema can only describe: pulse is trimmed to 3
 * words and observations to 3. Returns null when fewer than 3 pulse words came back.
 */
export function limitTasteDNA(dna: TasteDNA): TasteDNA | null {
  const pulse = (Array.isArray(dna.pulse) ? dna.pulse : [])
    .map((w) => (typeof w === "string" ? w.trim() : ""))
    .filter(Boolean);
  if (pulse.length < 3) return null;
  const observations = Array.isArray(dna.observations) ? dna.observations.slice(0, 3) : [];
  return { ...dna, pulse: pulse.slice(0, 3), observations };
}
