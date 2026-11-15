"use client";

import { useEffect, useRef, useState } from "react";

import type { AppMode } from "@/lib/mode-context";
import { createClient } from "@/lib/supabase/client";
import type { SpotifySearchResult } from "@/lib/spotify/spotify";

/**
 * The music page's two lazy shelves: "From your library" (more from the most-logged artist) and the
 * Spotify top tracks. Each is fetched once, the first time music mode shows. The state lives as long
 * as the page, so leaving and coming back to music mode never refetches or clears it.
 */
export function useMusicFeed(mode: AppMode) {
  // Lazy shelves start as loading; music mode shows them loading until their first fetch settles.
  const [personalMusicRows, setPersonalMusicRows] = useState<{ title: string; items: SpotifySearchResult[] }[]>([]);
  const [personalMusicLoading, setPersonalMusicLoading] = useState(true);
  const [spotifyTopTracks, setSpotifyTopTracks] = useState<SpotifySearchResult[]>([]);
  const [spotifyOAuthConnected, setSpotifyOAuthConnected] = useState<boolean | null>(null);
  const [spotifyOAuthLoading, setSpotifyOAuthLoading] = useState(true);

  const started = useRef({ library: false, spotify: false });

  // ─── Personalised music rows (lazy — top artist from listen_logs) ───
  useEffect(() => {
    if (mode !== "music" || started.current.library) return;
    started.current.library = true;

    async function fetchPersonalMusic() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: logs } = await supabase
          .from("listen_logs")
          .select("artist")
          .eq("user_id", user.id)
          .not("artist", "is", null);
        if (!logs || logs.length === 0) return;

        // Count artist frequency and take the top one
        const freq = new Map<string, number>();
        logs.forEach((l: { artist: string | null }) => {
          if (!l.artist) return;
          // Use first artist if comma-separated
          const primary = l.artist.split(",")[0].trim();
          freq.set(primary, (freq.get(primary) || 0) + 1);
        });
        const topArtist = Array.from(freq.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
        if (topArtist === undefined) {
          setPersonalMusicRows([]);
          return;
        }

        let items: SpotifySearchResult[] = [];
        try {
          const res = await fetch(`/api/spotify?action=search&q=${encodeURIComponent(topArtist)}&type=album`);
          const data = await res.json();
          items = Array.isArray(data) ? data : [];
        } catch {
          items = [];
        }
        setPersonalMusicRows(items.length > 0 ? [{ title: `More from ${topArtist}`, items }] : []);
      } catch {
        // These shelves simply stay hidden.
      } finally {
        setPersonalMusicLoading(false);
      }
    }

    fetchPersonalMusic();
  }, [mode]);

  // ─── Spotify top tracks (lazy — music mode, needs a connected account) ───
  useEffect(() => {
    if (mode !== "music" || started.current.spotify) return;
    started.current.spotify = true;

    async function fetchSpotifyTopTracks() {
      try {
        const tracksRes = await fetch("/api/spotify/me?action=top-tracks");
        const tracksData = await tracksRes.json();

        if (tracksData.connected === false) {
          setSpotifyOAuthConnected(false);
          return;
        }
        setSpotifyOAuthConnected(true);
        if (Array.isArray(tracksData)) setSpotifyTopTracks(tracksData);
      } catch {
        setSpotifyOAuthConnected(false);
      } finally {
        setSpotifyOAuthLoading(false);
      }
    }

    fetchSpotifyTopTracks();
  }, [mode]);

  return {
    personalMusicRows,
    personalMusicLoading,
    spotifyTopTracks,
    spotifyOAuthConnected,
    spotifyOAuthLoading,
  };
}
