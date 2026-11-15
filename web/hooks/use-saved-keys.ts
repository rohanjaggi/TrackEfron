"use client";

import { useCallback, useEffect, useState } from "react";

import type { AppMode } from "@/lib/mode-context";
import { titleKey } from "@/lib/saved-items";
import { createClient } from "@/lib/supabase/client";

/**
 * What the user already has saved in the current mode, so a pick shows its state from the start.
 * Music mode loads the queue's Spotify ids; film mode loads watchlist keys (`titleKey` format).
 * Both reload on each visit to the mode. Film waits for `filmReady` (pass `ready` from the mode
 * context where the server renders film before the stored mode is known); music never waits.
 */
export function useSavedKeys(mode: AppMode, filmReady = true) {
  const [queuedIds, setQueuedIds] = useState<Set<string>>(new Set());
  const [watchlistKeys, setWatchlistKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (mode !== "music") return;
    let cancelled = false;

    async function load() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) return;
        const { data } = await supabase.from("music_queue").select("spotify_id").eq("user_id", user.id);
        if (data && !cancelled) {
          setQueuedIds(new Set(data.map((i: { spotify_id: string }) => i.spotify_id).filter(Boolean)));
        }
      } catch {
        // Queue buttons fall back to "Queue"; adding a duplicate is handled on save.
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [mode]);

  useEffect(() => {
    if (!filmReady || mode !== "film") return;
    let cancelled = false;

    async function load() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) return;
        const { data } = await supabase.from("watchlist").select("tmdb_id, media_type").eq("user_id", user.id);
        if (data && !cancelled) {
          setWatchlistKeys(new Set(data.map((i) => titleKey(i.media_type, i.tmdb_id))));
        }
      } catch {
        // Add buttons fall back to "Add"; adding a duplicate is handled on save.
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [mode, filmReady]);

  const markQueued = useCallback((spotifyId: string) => {
    setQueuedIds((prev) => new Set([...prev, spotifyId]));
  }, []);

  const markWatchlisted = useCallback((key: string) => {
    setWatchlistKeys((prev) => new Set([...prev, key]));
  }, []);

  return { queuedIds, watchlistKeys, markQueued, markWatchlisted };
}
