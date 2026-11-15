import type { RawTrack } from "@/lib/spotify/spotify";

export type RawPlay = { track: RawTrack | null; played_at: string };
export type RecentCandidate = {
  type: "album" | "track";
  id: string; // Spotify track id or album id
  name: string;
  artist: string; // artist names joined with ", "
  album_name: string;
  image_url: string | null;
  release_date: string; // album release date, "" when Spotify gives none
  plays: number; // track: times played; album: distinct tracks played
  last_played_at: string; // ISO, the newest play in the group
};

export const ALBUM_THRESHOLD = 3;

/** null when Spotify rejects the token (401) or scope (403); [] on 204 or an empty body. Throws on other failures. */
export async function fetchRecentPlays(accessToken: string): Promise<RawPlay[] | null> {
  const res = await fetch("https://api.spotify.com/v1/me/player/recently-played?limit=50", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 401 || res.status === 403) return null;
  if (res.status === 204) return [];
  if (!res.ok) throw new Error(`Spotify recently-played error: ${res.statusText}`);
  const text = await res.text();
  if (!text.trim()) return [];
  const data = JSON.parse(text);
  return data.items ?? [];
}

const names = (artists?: { name: string }[]) => (artists ?? []).map((a) => a.name).join(", ");
const time = (iso: string) => Date.parse(iso);

type TrackGroup = { track: RawTrack; plays: number; last: string };

export function groupRecentPlays(plays: RawPlay[], loggedIds: Set<string>, max = 12): RecentCandidate[] {
  const byTrack = new Map<string, TrackGroup>();
  for (const p of plays) {
    if (!p.track || !p.track.id) continue;
    const g = byTrack.get(p.track.id);
    if (!g) byTrack.set(p.track.id, { track: p.track, plays: 1, last: p.played_at });
    else {
      g.plays += 1;
      if (time(p.played_at) > time(g.last)) g.last = p.played_at;
    }
  }

  const byAlbum = new Map<string, TrackGroup[]>();
  for (const g of byTrack.values()) {
    const albumId = g.track.album?.id;
    if (!albumId) continue;
    byAlbum.set(albumId, [...(byAlbum.get(albumId) ?? []), g]);
  }
  const foldedAlbums = new Set([...byAlbum].filter(([, gs]) => gs.length >= ALBUM_THRESHOLD).map(([id]) => id));

  const out: RecentCandidate[] = [];
  for (const g of byTrack.values()) {
    const albumId = g.track.album?.id;
    if (albumId && foldedAlbums.has(albumId)) continue;
    if (loggedIds.has(g.track.id)) continue;
    out.push({
      type: "track",
      id: g.track.id,
      name: g.track.name,
      artist: names(g.track.artists),
      album_name: g.track.album?.name ?? "",
      image_url: g.track.album?.images?.[0]?.url ?? null,
      release_date: g.track.album?.release_date ?? "",
      plays: g.plays,
      last_played_at: g.last,
    });
  }
  for (const albumId of foldedAlbums) {
    if (loggedIds.has(albumId)) continue;
    const gs = byAlbum.get(albumId)!;
    const album = gs[0].track.album!;
    out.push({
      type: "album",
      id: albumId,
      name: album.name,
      artist: names(album.artists),
      album_name: album.name,
      image_url: album.images?.[0]?.url ?? null,
      release_date: album.release_date ?? "",
      plays: gs.length,
      last_played_at: gs.reduce((a, g) => (time(g.last) > time(a) ? g.last : a), gs[0].last),
    });
  }

  return out.sort((a, b) => time(b.last_played_at) - time(a.last_played_at)).slice(0, max);
}

const pad = (n: number) => String(n).padStart(2, "0");
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Local calendar day of an ISO timestamp as YYYY-MM-DD. */
export function localDay(iso: string): string {
  return dayKey(new Date(iso));
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "today", "yesterday", else e.g. "12 Nov". */
export function playedLabel(iso: string, now: Date): string {
  const d = new Date(iso);
  if (dayKey(d) === dayKey(now)) return "today";
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (dayKey(d) === dayKey(yesterday)) return "yesterday";
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
