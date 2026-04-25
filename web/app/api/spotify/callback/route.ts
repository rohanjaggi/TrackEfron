import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exchangeCodeForTokens, saveTokens } from "@/lib/spotify/pkce";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  // User denied permission or Spotify returned an error
  if (error || !code) {
    return NextResponse.redirect(
      new URL("/protected/profile?spotify=denied", request.url)
    );
  }

  // Retrieve the PKCE verifier from the cookie
  const verifier = request.cookies.get("spotify_pkce_verifier")?.value;
  if (!verifier) {
    return NextResponse.redirect(
      new URL(
        "/protected/profile?spotify=error&reason=missing_verifier",
        request.url
      )
    );
  }

  // Verify Supabase session
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await exchangeCodeForTokens(code, verifier);

    // Fetch Spotify user ID
    const meRes = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
    });
    const spotifyUserId: string | undefined = meRes.ok
      ? (await meRes.json()).id
      : undefined;

    // Persist tokens
    await saveTokens(supabase, user.id, tokenResponse, spotifyUserId);

    // Clear the PKCE verifier cookie and redirect to profile
    const response = NextResponse.redirect(
      new URL("/protected/profile?spotify=connected", request.url)
    );
    response.cookies.set("spotify_pkce_verifier", "", {
      httpOnly: true,
      maxAge: 0,
      path: "/api/spotify/callback",
    });
    return response;
  } catch {
    return NextResponse.redirect(
      new URL("/protected/profile?spotify=error", request.url)
    );
  }
}
