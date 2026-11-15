import type { SpotifyRange, SpotifyTops } from "@/lib/ai/types";
import { artistNames } from "@/lib/spotify/spotify";

interface RawArtist {
  id: string;
  name: string;
  genres?: string[];
  images?: { url: string }[];
}
interface RawTrack {
  id: string;
  name: string;
  artists?: { name: string }[];
}

const RANGES: SpotifyRange[] = ["short_term", "medium_term", "long_term"];

async function fetchTop<T>(kind: "artists" | "tracks", range: SpotifyRange, accessToken: string): Promise<T[] | null> {
  const res = await fetch(`https://api.spotify.com/v1/me/top/${kind}?limit=20&time_range=${range}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 401 || res.status === 403) return null;
  if (!res.ok) throw new Error(`Spotify top-${kind} error: ${res.statusText}`);
  const data = await res.json();
  return (data.items ?? []).filter(Boolean);
}

/** Returns null when Spotify rejects the token (401) or the scope (403). */
export async function fetchSpotifyTops(accessToken: string): Promise<SpotifyTops | null> {
  const [artistLists, trackLists] = await Promise.all([
    Promise.all(RANGES.map((r) => fetchTop<RawArtist>("artists", r, accessToken))),
    Promise.all(RANGES.map((r) => fetchTop<RawTrack>("tracks", r, accessToken))),
  ]);
  if (artistLists.some((l) => l === null) || trackLists.some((l) => l === null)) return null;

  const tops: SpotifyTops = {
    artists: { short_term: [], medium_term: [], long_term: [] },
    tracks: { short_term: [], medium_term: [], long_term: [] },
  };
  RANGES.forEach((range, i) => {
    tops.artists[range] = artistLists[i]!.map((a) => ({
      id: a.id,
      name: a.name,
      genres: a.genres ?? [],
      image_url: a.images?.[0]?.url ?? null,
    }));
    tops.tracks[range] = trackLists[i]!.map((t) => ({
      id: t.id,
      name: t.name,
      artist: artistNames(t.artists),
    }));
  });
  return tops;
}
