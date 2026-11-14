import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getValidToken } from "@/lib/spotify/pkce";
import { normaliseTrack, type RawTrack } from "@/lib/spotify/spotify";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  const timeRange = searchParams.get("time_range") || "medium_term";

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
    if (action === "top-tracks") {
      const res = await fetch(
        `https://api.spotify.com/v1/me/top/tracks?limit=20&time_range=${timeRange}`,
        { headers }
      );
      if (res.status === 401) return NextResponse.json({ connected: false, reason: "token_invalid" });
      if (!res.ok) throw new Error(`Spotify top-tracks error: ${res.statusText}`);

      const data = await res.json();
      const tracks = (data.items || []).map((t: RawTrack) => normaliseTrack(t));
      return NextResponse.json(tracks);
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    console.error("spotify/me request failed:", e);
    return NextResponse.json({ error: "Spotify request failed" }, { status: 500 });
  }
}
