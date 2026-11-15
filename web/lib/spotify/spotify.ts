const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

const BASE_URL = "https://api.spotify.com/v1";

// Module-level, so it persists within a warm server instance.
let tokenCache: { token: string; expiresAt: number } | null = null;

async function getSpotifyToken(): Promise<string> {
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    throw new Error("Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET environment variables");
  }

  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.token;
  }

  const credentials = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString("base64");
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    throw new Error(`Spotify auth error: ${res.statusText}`);
  }

  const data = await res.json();
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return tokenCache.token;
}

export type SpotifySearchResult = {
  id: string;
  name: string;
  artist: string;
  album_name: string;
  image_url: string | null;
  release_date: string;
  type: "album" | "track";
};

type RawArtist = { name: string };
type RawImage = { url: string };
type RawAlbum = {
  id: string;
  name: string;
  artists?: RawArtist[];
  images?: RawImage[];
  release_date?: string;
};
export type RawTrack = {
  id: string;
  name: string;
  artists?: RawArtist[];
  album?: RawAlbum;
};

export const artistNames = (artists?: RawArtist[] | null) => (artists || []).map((a) => a.name).join(", ");

export function normaliseAlbum(a: RawAlbum): SpotifySearchResult {
  return {
    id: a.id,
    name: a.name,
    artist: artistNames(a.artists),
    album_name: a.name,
    image_url: a.images?.[0]?.url ?? null,
    release_date: a.release_date || "",
    type: "album",
  };
}

export function normaliseTrack(t: RawTrack): SpotifySearchResult {
  return {
    id: t.id,
    name: t.name,
    artist: artistNames(t.artists),
    album_name: t.album?.name || "",
    image_url: t.album?.images?.[0]?.url ?? null,
    release_date: t.album?.release_date || "",
    type: "track",
  };
}

export async function searchSpotify(
  query: string,
  type: "album" | "track" | "album,track" = "album,track",
  limit = 10
): Promise<SpotifySearchResult[]> {
  const token = await getSpotifyToken();
  const url = `${BASE_URL}/search?q=${encodeURIComponent(query)}&type=${type}&limit=${limit}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Spotify search error: ${res.statusText}`);

  const data = await res.json();
  const results: SpotifySearchResult[] = [];

  if (data.albums?.items) {
    results.push(...data.albums.items.filter(Boolean).map(normaliseAlbum));
  }
  if (data.tracks?.items) {
    results.push(...data.tracks.items.filter(Boolean).map(normaliseTrack));
  }

  // Interleave if both types requested, otherwise return as-is
  if (type === "album,track") {
    const albums = results.filter((r) => r.type === "album");
    const tracks = results.filter((r) => r.type === "track");
    const merged: SpotifySearchResult[] = [];
    const maxLen = Math.max(albums.length, tracks.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < albums.length) merged.push(albums[i]);
      if (i < tracks.length) merged.push(tracks[i]);
    }
    return merged.slice(0, limit);
  }

  return results.slice(0, limit);
}

export async function getSpotifyItem(
  id: string,
  type: "album" | "track"
): Promise<SpotifySearchResult> {
  const token = await getSpotifyToken();
  const res = await fetch(`${BASE_URL}/${type}s/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Spotify detail error: ${res.statusText}`);

  const data = await res.json();
  return type === "album" ? normaliseAlbum(data) : normaliseTrack(data);
}
