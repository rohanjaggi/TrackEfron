import type { MusicRecommendation } from "@/lib/ai/types";
import { overlaps } from "../normalise";
import type { searchSpotify } from "@/lib/spotify/spotify";

/**
 * Keeps only picks that Spotify confirms: a search result whose title and artist
 * both overlap the proposal. There is no fallback to the first result.
 */
export async function matchMusicPicks(
  raw: MusicRecommendation[],
  exclude: Set<string>,
  search: typeof searchSpotify,
  max: number
): Promise<MusicRecommendation[]> {
  const out: MusicRecommendation[] = [];
  const seen = new Set<string>();

  for (const pick of raw) {
    if (out.length >= max) break;
    try {
      const results = await search(`${pick.artist} ${pick.title}`, pick.type, 5);
      const match = results.find(
        (r) =>
          overlaps(r.name, pick.title) &&
          overlaps(r.artist, pick.artist) &&
          !exclude.has(r.id) &&
          !seen.has(r.id)
      );
      if (!match) continue;
      seen.add(match.id);
      out.push({
        ...pick,
        spotify_id: match.id,
        image_url: match.image_url,
        title: match.name,
        artist: match.artist,
        album_name: match.album_name,
        type: match.type,
      });
    } catch {
      // Search failed for this pick: skip it.
    }
  }
  return out;
}
