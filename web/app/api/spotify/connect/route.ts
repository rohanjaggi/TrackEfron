import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  generateCodeVerifier,
  generateCodeChallenge,
  buildAuthorizeUrl,
} from "@/lib/spotify/pkce";
import { redirect } from "next/navigation";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/auth/login");
  }

  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  const spotifyUrl = buildAuthorizeUrl(challenge);

  const response = NextResponse.redirect(spotifyUrl);
  response.cookies.set("spotify_pkce_verifier", verifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/api/spotify/callback",
  });

  return response;
}
