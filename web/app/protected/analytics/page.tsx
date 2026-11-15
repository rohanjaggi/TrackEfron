"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { BarChart3, Headphones, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useMode } from "@/lib/mode-context";
import { useTitleDetails } from "@/hooks/use-title-details";
import { TasteDNACard } from "@/components/taste-dna-card";
import { ChartSkeleton } from "@/components/analytics/blocks";
import { FilmAnalytics } from "@/components/analytics/film-analytics";
import { MusicAnalytics } from "@/components/analytics/music-analytics";
import type { WatchLog } from "@/components/analytics/types";
import { Button } from "@/components/ui/button";
import { EmptyState, Notice, PageHeader, StatBlock } from "@/components/ui/page";
import type { ListenLog } from "@/lib/types";

export default function AnalyticsPage() {
  const { mode } = useMode();
  const isMusic = mode === "music";
  const [watchLogs, setWatchLogs] = useState<WatchLog[]>([]);
  const [listenLogs, setListenLogs] = useState<ListenLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const { tmdbDetails, detailsLoading, detailsFailed, setDetailsLoading, reset: resetDetails, retryDetails } =
    useTitleDetails(watchLogs, isMusic);

  // Only the current mode's table is read. The effect re-runs on a mode change
  // (or a retry); `cancelled` stops the previous run from writing into the new one.
  // The figures render as soon as the logs arrive; film details load in the next effect.
  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setLoadError(false);
      setWatchLogs([]);
      setListenLogs([]);
      resetDetails();
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        if (cancelled) return;
        const user = data.user;
        if (!user) {
          setLoadError(true);
          setLoading(false);
          return;
        }
        if (isMusic) {
          const result = await supabase
            .from("listen_logs")
            .select("media_type, artist, rating")
            .eq("user_id", user.id)
            .in("media_type", ["album", "track"]);
          if (cancelled) return;
          if (result.error) {
            setLoadError(true);
          } else {
            setListenLogs((result.data as ListenLog[] | null) || []);
          }
        } else {
          const result = await supabase
            .from("watch_logs")
            .select("rating, media_type, watched_date, created_at, tmdb_id, title, times_watched, poster_url")
            .eq("user_id", user.id)
            .in("media_type", ["movie", "tv"])
            .order("watched_date", { ascending: false, nullsFirst: false })
            .order("created_at", { ascending: false });
          if (cancelled) return;
          if (result.error) {
            setLoadError(true);
          } else {
            const logs = (result.data as WatchLog[] | null) || [];
            setWatchLogs(logs);
            // Set with the logs so the sections never flash an empty state before the fetch starts
            setDetailsLoading(logs.some((l) => l.tmdb_id));
          }
        }
        setLoading(false);
      } catch {
        if (cancelled) return;
        setLoadError(true);
        setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [isMusic, attempt, resetDetails, setDetailsLoading]);

  const retry = () => setAttempt((n) => n + 1);

  const header = (
    <PageHeader
      title={
        <>
          Your <em>analytics</em>
        </>
      }
      description={
        isMusic
          ? "Insights into your listening habits and taste profile."
          : "Insights into your watching habits and taste profile."
      }
    />
  );

  let body: React.ReactNode;
  if (loading) {
    body = (
      <>
        <div className="grid grid-cols-2 gap-x-8 gap-y-8 md:grid-cols-4">
          <StatBlock label={isMusic ? "Logged" : "Watched"} value="" loading />
          <StatBlock label="Average rating" value="" loading />
          <StatBlock label={isMusic ? "Albums" : "Film watch time"} value="" loading />
          <StatBlock label={isMusic ? "Tracks" : "Seasons of TV"} value="" loading />
        </div>
        <ChartSkeleton label="Loading your analytics" className="h-[300px]" />
      </>
    );
  } else if (loadError) {
    body = (
      <Notice
        tone="error"
        title={isMusic ? "Couldn't load your listens" : "Couldn't load your watches"}
        action={
          <Button variant="outline" size="sm" onClick={retry}>
            Try again
          </Button>
        }
      >
        Check your connection and try again. Nothing you have logged is lost.
      </Notice>
    );
  } else if (isMusic ? listenLogs.length === 0 : watchLogs.length === 0) {
    body = (
      <EmptyState
        icon={isMusic ? Headphones : BarChart3}
        title="No data yet"
        description={
          isMusic
            ? "Start logging albums and tracks to see your music analytics come to life."
            : "Start logging films and TV shows to see your analytics come to life."
        }
        action={
          <Button asChild>
            <Link href="/protected/log">
              <Plus aria-hidden="true" />
              {isMusic ? "Log your first listen" : "Log your first watch"}
            </Link>
          </Button>
        }
      />
    );
  } else {
    body = isMusic ? (
      <MusicAnalytics key="music" listenLogs={listenLogs} />
    ) : (
      <FilmAnalytics
        key="film"
        watchLogs={watchLogs}
        tmdbDetails={tmdbDetails}
        detailsLoading={detailsLoading}
        detailsFailed={detailsFailed}
        onRetry={retryDetails}
      />
    );
  }

  return (
    <div>
      {header}
      <TasteDNACard />
      <div className="advance mt-16 flex flex-col gap-16">{body}</div>
    </div>
  );
}