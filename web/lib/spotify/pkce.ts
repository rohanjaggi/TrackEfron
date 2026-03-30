import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

// ── Types ─────────────────────────────────────────────────────────────────────

export type SpotifyTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
};

// ── PKCE crypto ───────────────────────────────────────────────────────────────

export function generateCodeVerifier(): string {
  return crypto.randomBytes(64).toString("base64url");
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoded = new TextEncoder().encode(verifier);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return Buffer.from(hashBuffer).toString("base64url");
}

export function buildAuthorizeUrl(codeChallenge: string): string {
  const params = new URLSearchParams({
    client_id: process.env.SPOTIFY_CLIENT_ID!,
    response_type: "code",
    redirect_uri: process.env.SPOTIFY_REDIRECT_URI!,
    scope: "user-top-read user-read-recently-played",
    code_challenge_method: "S256",
    code_challenge: codeChallenge,
  });
  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

// ── Token exchange ────────────────────────────────────────────────────────────

export async function exchangeCodeForTokens(
  code: string,
  verifier: string
): Promise<SpotifyTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: process.env.SPOTIFY_REDIRECT_URI!,
    client_id: process.env.SPOTIFY_CLIENT_ID!,
    code_verifier: verifier,
  });

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Spotify token exchange failed: ${err.error ?? res.statusText}`);
  }

  const data = await res.json();
  if (!data.refresh_token) {
    throw new Error("Spotify did not return a refresh_token");
  }
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
  };
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<SpotifyTokenResponse & { rotated_refresh_token?: string }> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: process.env.SPOTIFY_CLIENT_ID!,
  });

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Spotify refresh failed: ${err.error ?? res.statusText}|${res.status}`);
  }

  const data = await res.json();
  return {
    access_token: data.access_token,
    // Spotify may rotate the refresh token; fall back to the existing one if not
    refresh_token: data.refresh_token ?? refreshToken,
    expires_in: data.expires_in,
  };
}

// ── DB helpers ────────────────────────────────────────────────────────────────

export async function saveTokens(
  supabase: SupabaseClient,
  userId: string,
  tokenResponse: SpotifyTokenResponse,
  spotifyUserId?: string
): Promise<void> {
  const expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString();
  await supabase.from("spotify_tokens").upsert(
    {
      user_id: userId,
      spotify_user_id: spotifyUserId ?? null,
      access_token: tokenResponse.access_token,
      refresh_token: tokenResponse.refresh_token,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
}

export async function getValidToken(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data: row } = await supabase
    .from("spotify_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (!row) return null;

  // Refresh if within 5 minutes of expiry
  const expiresAt = new Date(row.expires_at).getTime();
  const fiveMinutes = 5 * 60 * 1000;
  if (Date.now() >= expiresAt - fiveMinutes) {
    try {
      const refreshed = await refreshAccessToken(row.refresh_token);
      await saveTokens(supabase, userId, refreshed);
      return refreshed.access_token;
    } catch (err: any) {
      // invalid_grant means the token was revoked — clean up
      if (err.message?.includes("invalid_grant") || err.message?.includes("400")) {
        await supabase.from("spotify_tokens").delete().eq("user_id", userId);
      }
      return null;
    }
  }

  return row.access_token;
}
