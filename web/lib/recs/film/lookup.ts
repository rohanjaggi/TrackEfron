import type { FilmCandidate } from "@/lib/ai/types";
import { overlaps } from "../normalise";
import { toCandidate } from "./candidates";
import type { Lookup } from "./match";

type Search = (type: "movie" | "tv", title: string, year: number | null) => Promise<unknown[]>;

/**
 * Adapts a raw TMDB title search to the film matcher's lookup. A result is
 * accepted only when its title (or original title) loosely matches the
 * proposed one; there is no fallback to the first result.
 */
export function makeFilmLookup(search: Search): Lookup {
  return async (type, title, year) => {
    const results = (await search(type, title, year)) as Record<string, unknown>[];
    for (const r of results ?? []) {
      const names = [
        type === "movie" ? r.title : r.name,
        type === "movie" ? r.original_title : r.original_name,
      ].filter((n): n is string => typeof n === "string");
      if (!names.some((n) => overlaps(n, title))) continue;
      const candidate: FilmCandidate | null = toCandidate(r, type);
      if (candidate) return candidate;
    }
    return null;
  };
}
