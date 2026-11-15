"use client";

import { useEffect, useState } from "react";
import { averageRating, countReviews } from "@/lib/media";
import { Notice, SectionHeader, StatBlock } from "@/components/ui/page";
import type { AppMode } from "@/lib/mode-context";
import { createClient } from "@/lib/supabase/client";

/** One logged film, show, album or track; only what the figures need. */
type StatLog = {
  rating: number | null;
  review: string | null;
  media_type: string;
};

type StatsData = {
  mode: AppMode;
  logs: StatLog[];
  listCount: number;
};

export function StatsSection({ mode }: { mode: AppMode }) {
  const [statsData, setStatsData] = useState<StatsData | null>(null);
  const [statsError, setStatsError] = useState(false);

  useEffect(() => {
    // Only the current mode's tables are read; a response from a previous mode is dropped.
    let cancelled = false;
    async function fetchStats() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (cancelled) return;
        if (!user) {
          setStatsError(true);
          return;
        }
        const [logsRes, listRes] =
          mode === "music"
            ? await Promise.all([
                supabase
                  .from("listen_logs")
                  .select("rating, review, media_type")
                  .eq("user_id", user.id),
                supabase
                  .from("music_queue")
                  .select("id", { count: "exact", head: true })
                  .eq("user_id", user.id),
              ])
            : await Promise.all([
                supabase
                  .from("watch_logs")
                  .select("rating, review, media_type")
                  .eq("user_id", user.id),
                supabase
                  .from("watchlist")
                  .select("id", { count: "exact", head: true })
                  .eq("user_id", user.id),
              ]);
        if (cancelled) return;
        if (logsRes.error || listRes.error) {
          setStatsError(true);
          return;
        }
        setStatsError(false);
        setStatsData({ mode, logs: logsRes.data ?? [], listCount: listRes.count ?? 0 });
      } catch {
        if (!cancelled) setStatsError(true);
      }
    }
    fetchStats();
    return () => {
      cancelled = true;
    };
  }, [mode]);

  // Loading until the figures for the current mode have arrived.
  const statsLoading = !statsError && statsData?.mode !== mode;
  const statsLogs = statsData?.mode === mode ? statsData.logs : [];
  const countType = (type: string) => statsLogs.filter((i) => i.media_type === type).length;
  const stats = {
    logged: statsLogs.length,
    first: countType(mode === "music" ? "album" : "movie"),
    second: countType(mode === "music" ? "track" : "tv"),
    reviews: countReviews(statsLogs),
    avgRating: averageRating(statsLogs.map((i) => i.rating)),
    list: statsData?.mode === mode ? statsData.listCount : 0,
  };

  const items: [string, number | string][] =
    mode === "music"
      ? [
          ["Listens", stats.logged],
          [stats.first === 1 ? "Album" : "Albums", stats.first],
          [stats.second === 1 ? "Track" : "Tracks", stats.second],
          [stats.reviews === 1 ? "Review" : "Reviews", stats.reviews],
          ["Avg rating", stats.avgRating],
          ["Queue", stats.list],
        ]
      : [
          ["Watched", stats.logged],
          [stats.first === 1 ? "Film" : "Films", stats.first],
          [stats.second === 1 ? "TV show" : "TV shows", stats.second],
          [stats.reviews === 1 ? "Review" : "Reviews", stats.reviews],
          ["Avg rating", stats.avgRating],
          ["Watchlist", stats.list],
        ];

  return (
    <section aria-label={mode === "music" ? "Music figures" : "Film & TV figures"}>
      <SectionHeader title={mode === "music" ? "Music figures" : "Film & TV figures"} />
      {statsError ? (
        <Notice tone="error" title="Couldn't load your figures">
          Reload the page to try again.
        </Notice>
      ) : (
        <div className="flex flex-wrap gap-x-12 gap-y-6">
          {items.map(([label, value], i) => (
            <StatBlock key={i} label={label} value={value} loading={statsLoading} />
          ))}
        </div>
      )}
    </section>
  );
}
