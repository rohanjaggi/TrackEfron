import type { FilmCandidate, FilmRecommendation, RawFilmPick } from "@/lib/ai/types";

type Lookup = (
  type: "movie" | "tv",
  title: string,
  year: number | null,
) => Promise<FilmCandidate | null>;

export async function matchFilmPicks(
  raw: RawFilmPick[],
  candidates: FilmCandidate[],
  exclude: Set<string>,
  lookup: Lookup,
  limits: { max: number; maxOlder: number; olderBefore: number | null },
): Promise<FilmRecommendation[]> {
  const byKey = new Map(candidates.map((c) => [`${c.media_type}:${c.tmdb_id}`, c]));
  const seen = new Set<string>();
  const out: FilmRecommendation[] = [];
  let older = 0;

  for (const pick of raw) {
    if (out.length >= limits.max) break;

    let match: FilmCandidate | null =
      pick.tmdb_id != null ? (byKey.get(`${pick.media_type}:${pick.tmdb_id}`) ?? null) : null;
    if (!match) {
      const found = await lookup(pick.media_type, pick.title, pick.year);
      if (found && !(pick.year != null && found.year != null && Math.abs(found.year - pick.year) > 1)) {
        match = found;
      }
    }
    if (!match) continue;

    const k = `${match.media_type}:${match.tmdb_id}`;
    if (exclude.has(k) || seen.has(k)) continue;

    const isOlder =
      match.year != null && limits.olderBefore != null && match.year < limits.olderBefore;
    if (isOlder && older >= limits.maxOlder) continue;

    seen.add(k);
    if (isOlder) older++;
    out.push({
      tmdb_id: match.tmdb_id,
      title: match.title,
      media_type: match.media_type,
      year: match.year,
      poster_url: match.poster_url,
      explanation: pick.explanation,
      confidence: pick.confidence,
    });
  }
  return out;
}
