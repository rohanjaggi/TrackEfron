"use client";

import { useEffect, useRef, useState } from "react";

import type { AppMode } from "@/lib/mode-context";
import { titleKey } from "@/lib/saved-items";
import { createClient } from "@/lib/supabase/client";
import type { ForYouRow, MediaItem } from "./types";

/**
 * The browse tab's shelves: trending, in cinemas, all-time greats and the rows picked from the watch
 * history. Lazy: fetched once, the first time the browse tab opens in film mode. The state lives as
 * long as the page, so switching tabs or modes never refetches or clears it.
 */
export function useBrowseFeed(mode: AppMode, browseOpen: boolean) {
  const [trending, setTrending] = useState<MediaItem[]>([]);
  const [nowPlaying, setNowPlaying] = useState<MediaItem[]>([]);
  const [topRated, setTopRated] = useState<MediaItem[]>([]);
  const [browseLoading, setBrowseLoading] = useState(true);

  // Personalised rows
  const [forYouRows, setForYouRows] = useState<ForYouRow[]>([]);
  const [personalLoading, setPersonalLoading] = useState(true);
  const [watchedKeys, setWatchedKeys] = useState<Set<string>>(new Set());

  const started = useRef(false);

  useEffect(() => {
    if (mode !== "film" || !browseOpen || started.current) return;
    started.current = true;

    async function fetchBrowse() {
      try {
        const [trendingRes, nowPlayingRes, topRatedRes] = await Promise.all([
          fetch("/api?action=trending").then((r) => r.json()).catch(() => []),
          fetch("/api?action=now_playing").then((r) => r.json()).catch(() => []),
          fetch("/api?action=top_rated&type=movie").then((r) => r.json()).catch(() => []),
        ]);
        if (Array.isArray(trendingRes)) setTrending(trendingRes);
        if (Array.isArray(nowPlayingRes)) setNowPlaying(nowPlayingRes);
        if (Array.isArray(topRatedRes)) setTopRated(topRatedRes);
      } catch {
        // Handled below: if every shelf is empty the tab says so.
      } finally {
        setBrowseLoading(false);
      }
    }

    async function fetchPersonalized() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: logs, error } = await supabase
          .from("watch_logs")
          .select("media_type, tmdb_id")
          .eq("user_id", user.id)
          .order("rating", { ascending: false });

        if (error || !logs || logs.length === 0) return;

        const watched = new Set<string>();
        logs.forEach((l) => { if (l.tmdb_id) watched.add(titleKey(l.media_type, l.tmdb_id)); });
        setWatchedKeys(watched);

        const uniqueEntries = new Map<string, { tmdbId: number; type: "movie" | "tv" }>();
        logs.forEach((l) => {
          const key = titleKey(l.media_type, l.tmdb_id);
          if (l.tmdb_id && !uniqueEntries.has(key)) {
            uniqueEntries.set(key, { tmdbId: l.tmdb_id, type: l.media_type });
          }
        });
        const entries = Array.from(uniqueEntries.values()).slice(0, 20);

        // One round of detail lookups; a title that fails to load is skipped, order is kept.
        type DetailResult = { genres: { id: number; name: string }[] };
        const results = await Promise.all(
          entries.map(async (info): Promise<DetailResult | null> => {
            try {
              const res = await fetch(`/api?action=detail&type=${info.type}&id=${info.tmdbId}`);
              if (!res.ok) return null;
              const d = await res.json();
              const genres = (d.genres || []).map((g: { id: number; name: string }) => ({ id: g.id, name: g.name }));
              return { genres };
            } catch { return null; }
          })
        );
        const details = results.filter((r): r is DetailResult => r !== null);

        // Top genres
        const genreCount = new Map<number, { name: string; count: number }>();
        details.forEach((d) => {
          d.genres.forEach((g) => {
            const entry = genreCount.get(g.id) || { name: g.name, count: 0 };
            entry.count++;
            genreCount.set(g.id, entry);
          });
        });
        const topGenres = Array.from(genreCount.entries())
          .map(([id, { name, count }]) => ({ id, name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 2);

        const rowPromises: Promise<ForYouRow | null>[] = topGenres.map((genre) =>
          fetch(`/api?action=discover&type=movie&genres=${genre.id}`)
            .then((r) => r.json())
            .then((data) => {
              if (!Array.isArray(data)) return null;
              const filtered = data.filter((item: MediaItem) => !watched.has(titleKey(item.media_type, item.id)));
              if (filtered.length === 0) return null;
              return {
                id: `genre-${genre.id}`,
                title: `Because you love ${genre.name}`,
                subtitle: `Highly rated ${genre.name.toLowerCase()} picks`,
                items: filtered.slice(0, 20),
              };
            })
            .catch(() => null)
        );

        const rows = (await Promise.all(rowPromises)).filter((r): r is ForYouRow => r !== null);
        setForYouRows(rows);
      } catch {
        // These shelves simply stay hidden.
      } finally {
        setPersonalLoading(false);
      }
    }

    fetchBrowse();
    fetchPersonalized();
  }, [mode, browseOpen]);

  const browseFailed =
    !browseLoading && trending.length === 0 && nowPlaying.length === 0 && topRated.length === 0;

  return {
    trending,
    nowPlaying,
    topRated,
    browseLoading,
    browseFailed,
    forYouRows,
    personalLoading,
    watchedKeys,
  };
}
