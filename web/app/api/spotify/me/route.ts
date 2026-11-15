import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { getValidToken } from "@/lib/spotify/pkce";
import { normaliseTrack, type RawTrack } from "@/lib/spotify/spotify";
import { fetchRecentPlays, groupRecentPlays } from "@/lib/spotify/recent";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  const timeRange = searchParams.get("time_range") || "medium_term";

  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { supabase, user } = auth;

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

    if (action === "recently-played") {
      const [plays, { data: logs, error: logsError }] = await Promise.all([
        fetchRecentPlays(accessToken),
        supabase.from("listen_logs").select("spotify_id").eq("user_id", user.id),
      ]);
      if (plays === null) return NextResponse.json({ connected: false, reason: "token_invalid" });
      if (logsError) throw new Error(`listen_logs read failed: ${logsError.message}`);

      const logged = new Set<string>(
        (logs ?? []).map((r) => r.spotify_id).filter((id): id is string => !!id)
      );
      return NextResponse.json(groupRecentPlays(plays, logged));
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    console.error("spotify/me request failed:", e);
    return NextResponse.json({ error: "Spotify request failed" }, { status: 500 });
  }
}
