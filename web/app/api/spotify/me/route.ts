import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getValidToken } from "@/lib/spotify/pkce";
import { normaliseTrack } from "@/lib/spotify/spotify";

export type SpotifyArtistResult = {
  id: string;
  name: string;
  image_url: string | null;
  genres: string[];
  popularity: number;
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  const timeRange = searchParams.get("time_range") || "medium_term";

  // Verify Supabase session
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get a valid (auto-refreshed) access token
  const accessToken = await getValidToken(supabase, user.id);
  if (!accessToken) {
    return NextResponse.json({ connected: false });
  }

  const headers = { Authorization: `Bearer ${accessToken}` };

  try {
    if (action === "top-artists") {
      const res = await fetch(
        `https://api.spotify.com/v1/me/top/artists?limit=20&time_range=${timeRange}`,
        { headers }
      );
      if (res.status === 401) return NextResponse.json({ connected: false, reason: "token_invalid" });
      if (!res.ok) throw new Error(`Spotify top-artists error: ${res.statusText}`);

      const data = await res.json();
      const artists: SpotifyArtistResult[] = (data.items || []).map((a: any) => ({
        id: a.id,
        name: a.name,
        image_url: a.images?.[0]?.url ?? null,
        genres: a.genres ?? [],
        popularity: a.popularity ?? 0,
      }));
      return NextResponse.json(artists);
    }

    if (action === "top-tracks") {
      const res = await fetch(
        `https://api.spotify.com/v1/me/top/tracks?limit=20&time_range=${timeRange}`,
        { headers }
      );
      if (res.status === 401) return NextResponse.json({ connected: false, reason: "token_invalid" });
      if (!res.ok) throw new Error(`Spotify top-tracks error: ${res.statusText}`);

      const data = await res.json();
      const tracks = (data.items || []).map((t: any) => normaliseTrack(t));
      return NextResponse.json(tracks);
    }

    if (action === "recently-played") {
      const res = await fetch(
        "https://api.spotify.com/v1/me/player/recently-played?limit=50",
        { headers }
      );
      if (res.status === 401) return NextResponse.json({ connected: false, reason: "token_invalid" });
      if (!res.ok) throw new Error(`Spotify recently-played error: ${res.statusText}`);

      const data = await res.json();
      // Each item is { track: TrackObject, played_at: string }
      const tracks = (data.items || []).map((item: any) => normaliseTrack(item.track));
      return NextResponse.json(tracks);
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Spotify request failed" }, { status: 500 });
  }
}
