"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  BarChart3,
  Star,
  Film,
  Loader2,
  Plus,
  Clock,
  Clapperboard,
  Disc3,
  Music2,
  Headphones,
  Mic2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ScatterChart,
  Scatter,
  ZAxis,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import { useMode } from "@/lib/mode-context";
import { TasteDNACard } from "@/components/taste-dna-card";
import type { WatchLog as SharedWatchLog, ListenLog } from "@/lib/types";

type WatchLog = Pick<
  SharedWatchLog,
  "rating" | "watched_date" | "created_at" | "tmdb_id" | "title" | "times_watched" | "poster_url"
> & { media_type: "movie" | "tv" };

type ControversialPick = {
  title: string;
  posterUrl: string | null;
  userRating: number;
  tmdbRating: number;
  delta: number;
};

type TmdbDetail = {
  runtime?: number;
  seasons?: number;
  episodes?: number;
  genres: string[];
  voteAvg: number | null;
  releaseYear: number | null;
  posterUrl: string | null;
};

const DEFAULT_COLOURS = {
  primary: "#8B7355",
  accent: "#A0845C",
  secondary: "#6B5B4A",
};

function useThemeColours() {
  const [colours, setColours] = useState(DEFAULT_COLOURS);

  useEffect(() => {
    const style = getComputedStyle(document.documentElement);
    const resolve = (v: string) => {
      const val = style.getPropertyValue(v).trim();
      return val ? `hsl(${val})` : "";
    };
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads CSS variables from the DOM, which only exists after mount
    setColours({
      primary: resolve("--primary") || DEFAULT_COLOURS.primary,
      accent: resolve("--accent") || DEFAULT_COLOURS.accent,
      secondary: resolve("--secondary") || DEFAULT_COLOURS.secondary,
    });
  }, []);

  return colours;
}

function formatRuntime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const tooltipStyle = {
  contentStyle: {
    backgroundColor: "hsl(var(--card))",
    border: "2px solid hsl(var(--border))",
    borderRadius: "0px",
    fontSize: "13px",
  },
  labelStyle: { fontWeight: 600 },
};

const SectionHeader = ({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle: string }) => (
  <div className="flex items-start gap-3 pt-4">
    <div className="w-9 h-9 border-2 border-border flex items-center justify-center shrink-0 mt-0.5">
      <Icon className="w-4 h-4 text-primary" />
    </div>
    <div>
      <h2 className="font-display text-lg font-bold">{title}</h2>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </div>
  </div>
);

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`border-2 border-border bg-card/50 p-5 ${className}`}>
    {children}
  </div>
);

const CardTitle = ({ icon: Icon, title }: { icon: React.ElementType; title: string }) => (
  <div className="flex items-center gap-2 mb-5">
    <Icon className="w-4 h-4 text-muted-foreground" />
    <h3 className="font-display text-base font-bold">{title}</h3>
  </div>
);

const ChartSkeleton = () => (
  <div className="grid md:grid-cols-2 gap-3">
    {[0, 1].map((i) => (
      <Card key={i}>
        <div className="h-5 w-1/3 bg-muted/50 animate-pulse mb-5" />
        <div className="h-[200px] bg-muted/30 animate-pulse" />
      </Card>
    ))}
  </div>
);

const PageHeader = ({ subtitle }: { subtitle: string }) => (
  <div>
    <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">Analytics</h1>
    <p className="text-muted-foreground">{subtitle}</p>
  </div>
);

export default function AnalyticsPage() {
  const { mode } = useMode();
  const [watchLogs, setWatchLogs] = useState<WatchLog[]>([]);
  const [listenLogs, setListenLogs] = useState<ListenLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(true);
  const [tmdbDetails, setTmdbDetails] = useState<Map<number, TmdbDetail>>(new Map());
  const colours = useThemeColours();

  const subtitle = mode === "music"
    ? "Insights into your listening habits and taste profile"
    : "Insights into your watching habits and taste profile";

  const fetchDetails = useCallback(async (logs: WatchLog[]) => {
    const uniqueIds = new Map<number, "movie" | "tv">();
    logs.forEach((l) => {
      if (l.tmdb_id && !uniqueIds.has(l.tmdb_id)) {
        uniqueIds.set(l.tmdb_id, l.media_type);
      }
    });

    const entries = Array.from(uniqueIds.entries());
    const details = new Map<number, TmdbDetail>();
    // Fetch in batches of 10
    for (let i = 0; i < entries.length; i += 10) {
      const batch = entries.slice(i, i + 10);
      const results = await Promise.all(
        batch.map(async ([tmdbId, mediaType]) => {
          try {
            const res = await fetch(`/api?action=detail&type=${mediaType}&id=${tmdbId}`);
            if (!res.ok) return null;
            const d = await res.json();
            const genres = (d.genres || []).map((g: { name: string }) => g.name);
            const relDate = d.release_date || d.first_air_date || "";
            const releaseYear = relDate ? parseInt(relDate.slice(0, 4), 10) : null;
            return {
              id: tmdbId,
              runtime: d.runtime || undefined,
              seasons: d.number_of_seasons || undefined,
              episodes: d.number_of_episodes || undefined,
              genres,
              voteAvg: d.vote_average ?? null,
              releaseYear: releaseYear && !isNaN(releaseYear) ? releaseYear : null,
              posterUrl: d.poster_url || null,
            };
          } catch {
            return null;
          }
        })
      );
      results.forEach((r) => {
        if (r) {
          const { id, ...rest } = r;
          details.set(id, rest);
        }
      });
    }
    setTmdbDetails(details);
    setDetailsLoading(false);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    let logs: WatchLog[] = [];
    try {
      const supabase = createClient();
      const [filmResult, musicResult] = await Promise.all([
        supabase
          .from("watch_logs")
          .select("rating, media_type, watched_date, created_at, tmdb_id, title, times_watched, poster_url")
          .order("watched_date", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false }),
        supabase
          .from("listen_logs")
          .select("media_type, artist, rating"),
      ]);

      if (filmResult.error) throw filmResult.error;
      if (musicResult.error) throw musicResult.error;
      logs = filmResult.data || [];
      setWatchLogs(logs);
      setListenLogs((musicResult.data as ListenLog[]) || []);
    } catch {
      setLoadFailed(true);
      setLoading(false);
      return;
    }
    // Tiles and music sections render now; the TMDB-dependent film sections follow.
    setLoading(false);
    setDetailsLoading(true);
    await fetchDetails(logs);
  }, [fetchDetails]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount; the loading flag is set as the request starts
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader subtitle={subtitle} />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (loadFailed) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader subtitle={subtitle} />
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <h2 className="text-xl font-semibold mb-2">Couldn&apos;t load your analytics</h2>
          <p className="text-muted-foreground mb-6 max-w-md">Something went wrong fetching your logs.</p>
          <Button className="font-semibold border-2" onClick={fetchData}>Try again</Button>
        </div>
      </div>
    );
  }

  const isEmpty = mode === "music" ? listenLogs.length === 0 : watchLogs.length === 0;

  if (isEmpty) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader subtitle={subtitle} />
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 border-2 border-muted flex items-center justify-center mx-auto mb-6">
            {mode === "music" ? <Headphones className="w-10 h-10 text-muted-foreground" /> : <BarChart3 className="w-10 h-10 text-muted-foreground" />}
          </div>
          <h2 className="text-xl font-semibold mb-2">No data yet</h2>
          <p className="text-muted-foreground mb-6 max-w-md">
            {mode === "music"
              ? "Start logging albums and tracks to see your music analytics come to life."
              : "Start logging movies and TV shows to see your analytics come to life."}
          </p>
          <Button className="group font-semibold border-2" size="lg" asChild>
            <Link href="/protected/log">
              <Plus className="w-4 h-4 mr-2 transition-transform group-hover:rotate-90" />
              {mode === "music" ? "Log Your First Listen" : "Log Your First Watch"}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  // === Compute analytics data ===

  const movieCount = watchLogs.filter((l) => l.media_type === "movie").length;
  const avgRating = (watchLogs.reduce((acc, l) => acc + Number(l.rating), 0) / watchLogs.length).toFixed(1);

  // Total views including rewatches
  const totalViews = watchLogs.reduce((acc, l) => {
    if (!l.times_watched) return acc + 1;
    if (l.times_watched === "6+") return acc + 6;
    const n = parseInt(l.times_watched, 10);
    return acc + (isNaN(n) ? 1 : n);
  }, 0);
  const hasRewatches = totalViews > watchLogs.length;

  // Totals from TMDB details (derived; null until details arrive or when nothing sums)
  let runtimeSum = 0;
  let seasonSum = 0;
  let episodeSum = 0;
  watchLogs.forEach((l) => {
    if (!l.tmdb_id) return;
    const d = tmdbDetails.get(l.tmdb_id);
    if (!d) return;
    if (l.media_type === "movie" && d.runtime) runtimeSum += d.runtime;
    if (l.media_type === "tv") {
      if (d.seasons) seasonSum += d.seasons;
      if (d.episodes) episodeSum += d.episodes;
    }
  });
  const totalRuntime = runtimeSum > 0 ? runtimeSum : null;
  const totalSeasons = seasonSum > 0 ? seasonSum : null;
  const totalEpisodes = episodeSum > 0 ? episodeSum : null;

  // Genre breakdown
  const genreCounts: Record<string, number> = {};
  watchLogs.forEach((l) => {
    if (!l.tmdb_id) return;
    const d = tmdbDetails.get(l.tmdb_id);
    if (!d) return;
    d.genres.forEach((g) => { genreCounts[g] = (genreCounts[g] || 0) + 1; });
  });
  const genreData = Object.entries(genreCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Decade distribution
  const decadeCounts: Record<string, number> = {};
  watchLogs.forEach((l) => {
    if (!l.tmdb_id) return;
    const d = tmdbDetails.get(l.tmdb_id);
    if (!d || !d.releaseYear) return;
    const decade = `${Math.floor(d.releaseYear / 10) * 10}s`;
    decadeCounts[decade] = (decadeCounts[decade] || 0) + 1;
  });
  const decadeData = Object.entries(decadeCounts)
    .map(([decade, count]) => ({ decade, count }))
    .sort((a, b) => a.decade.localeCompare(b.decade));

  // Average movie length & runtime distribution
  const movieRuntimes: number[] = [];
  watchLogs.forEach((l) => {
    if (l.media_type !== "movie" || !l.tmdb_id) return;
    const d = tmdbDetails.get(l.tmdb_id);
    if (d?.runtime) movieRuntimes.push(d.runtime);
  });
  const avgMovieRuntime = movieRuntimes.length > 0
    ? Math.round(movieRuntimes.reduce((a, b) => a + b, 0) / movieRuntimes.length)
    : null;
  const runtimeBuckets = [
    { label: "<90m", count: movieRuntimes.filter((r) => r < 90).length },
    { label: "90–120m", count: movieRuntimes.filter((r) => r >= 90 && r < 120).length },
    { label: "120–150m", count: movieRuntimes.filter((r) => r >= 120 && r < 150).length },
    { label: "150m+", count: movieRuntimes.filter((r) => r >= 150).length },
  ];

  // Release year vs watch date (scatter)
  const scatterData: { watchDate: number; releaseYear: number; title: string }[] = [];
  watchLogs.forEach((l) => {
    if (!l.tmdb_id) return;
    const d = tmdbDetails.get(l.tmdb_id);
    if (!d?.releaseYear) return;
    const dateStr = l.watched_date || l.created_at;
    const watchTs = new Date(dateStr).getTime();
    scatterData.push({ watchDate: watchTs, releaseYear: d.releaseYear, title: l.title });
  });
  // Controversial picks
  const controversialPicks = watchLogs.reduce<{ gem: ControversialPick | null; unpopular: ControversialPick | null }>(
    (acc, l) => {
      if (!l.tmdb_id) return acc;
      const d = tmdbDetails.get(l.tmdb_id);
      if (!d || d.voteAvg === null) return acc;
      const userOn10 = l.rating * 2; // 0.5–5 → 1–10
      const delta = userOn10 - d.voteAvg;
      const pick: ControversialPick = {
        title: l.title,
        posterUrl: l.poster_url || d.posterUrl,
        userRating: l.rating,
        tmdbRating: Math.round(d.voteAvg * 10) / 10,
        delta: Math.round(delta * 10) / 10,
      };
      if (delta > 0 && (!acc.gem || delta > acc.gem.delta)) acc.gem = pick;
      if (delta < 0 && (!acc.unpopular || delta < acc.unpopular.delta)) acc.unpopular = pick;
      return acc;
    },
    { gem: null, unpopular: null }
  );
  const hiddenGem = controversialPicks.gem;
  const unpopularOpinion = controversialPicks.unpopular;

  // ── Music analytics computations ──────────────────────────────
  const musicAlbumCount = listenLogs.filter((l) => l.media_type === "album").length;
  const musicTrackCount = listenLogs.filter((l) => l.media_type === "track").length;
  const musicAvgRating = listenLogs.length > 0
    ? (listenLogs.reduce((acc, l) => acc + Number(l.rating), 0) / listenLogs.length).toFixed(1)
    : "—";

  const artistCounts: Record<string, number> = {};
  listenLogs.forEach((l) => {
    if (l.artist) artistCounts[l.artist] = (artistCounts[l.artist] || 0) + 1;
  });
  const topArtists = Object.entries(artistCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);


  return (
    <div className="flex flex-col gap-6">
      <PageHeader subtitle={subtitle} />

      <TasteDNACard />

      {/* ─── MUSIC MODE ─── */}
      {mode === "music" && (<>
        {/* Music Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="text-center">
            <Headphones className="w-4 h-4 text-primary mx-auto mb-2" />
            <div className="font-display text-2xl md:text-3xl font-bold mb-0.5">{listenLogs.length}</div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Total Logged</p>
          </Card>
          <Card className="text-center">
            <Star className="w-4 h-4 text-primary mx-auto mb-2" />
            <div className="font-display text-2xl md:text-3xl font-bold mb-0.5">{musicAvgRating}</div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Avg Rating</p>
          </Card>
          <Card className="text-center">
            <Disc3 className="w-4 h-4 text-primary mx-auto mb-2" />
            <div className="font-display text-2xl md:text-3xl font-bold mb-0.5">{musicAlbumCount}</div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Albums</p>
          </Card>
          <Card className="text-center">
            <Music2 className="w-4 h-4 text-primary mx-auto mb-2" />
            <div className="font-display text-2xl md:text-3xl font-bold mb-0.5">{musicTrackCount}</div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Tracks</p>
          </Card>
        </div>


        {/* Top Artists */}
        {topArtists.length > 0 && (<>
          <SectionHeader icon={Mic2} title="Top Artists" subtitle="Artists you've logged the most" />
          <Card>
            <div className="space-y-3">
              {topArtists.map(({ name, count }, i) => (
                <div key={name} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-5 text-right">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium truncate">{name}</span>
                      <span className="text-xs text-muted-foreground ml-2 shrink-0">{count}</span>
                    </div>
                    <div className="h-1 bg-border rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${(count / topArtists[0].count) * 100}%`, background: colours.primary }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </>)}
      </>)}

      {/* ─── FILM MODE ─── */}
      {mode !== "music" && (<>

      {/* ─── OVERVIEW ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="text-center">
          <Film className="w-4 h-4 text-primary mx-auto mb-2" />
          <div className="font-display text-2xl md:text-3xl font-bold mb-0.5">
            {watchLogs.length}
          </div>
          {hasRewatches && (
            <p className="text-xs text-muted-foreground mb-0.5">
              {totalViews}{watchLogs.some((l) => l.times_watched === "6+") ? "+" : ""} total views
            </p>
          )}
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Total Watched</p>
        </Card>
        <Card className="text-center">
          <Star className="w-4 h-4 text-primary mx-auto mb-2" />
          <div className="font-display text-2xl md:text-3xl font-bold mb-0.5">{avgRating}</div>
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Avg Rating</p>
        </Card>
        <Card className="text-center">
          <Clock className="w-4 h-4 text-primary mx-auto mb-2" />
          <div className="font-display text-xl md:text-2xl font-bold mb-0.5">
            {!detailsLoading && totalRuntime ? formatRuntime(totalRuntime) : "—"}
          </div>
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider">
            {movieCount === 1 ? "Movie" : "Movies"} Watch Time
          </p>
        </Card>
        <Card className="text-center">
          <Clapperboard className="w-4 h-4 text-primary mx-auto mb-2" />
          <div className="font-display text-xl md:text-2xl font-bold mb-0.5">
            {!detailsLoading && totalSeasons !== null ? totalSeasons : "—"}
            {!detailsLoading && totalEpisodes !== null && (
              <span className="text-base font-normal text-muted-foreground"> / {totalEpisodes} ep</span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider">
            {totalSeasons === 1 ? "Season" : "Seasons"} of TV
          </p>
        </Card>
      </div>

      {/* ─── CONTENT PROFILE ─── */}
      {detailsLoading ? (
        <>
          <SectionHeader icon={Film} title="Content Profile" subtitle="What you watch and where it comes from" />
          <ChartSkeleton />
        </>
      ) : (genreData.length > 0 || decadeData.length > 0 || avgMovieRuntime !== null || scatterData.length > 0) && (
        <>
          <SectionHeader icon={Film} title="Content Profile" subtitle="What you watch and where it comes from" />

          <div className="grid md:grid-cols-2 gap-3">
            {/* Genre Breakdown */}
            {genreData.length > 0 && (
              <Card>
                <CardTitle icon={Film} title="Genre Breakdown" />
                <ResponsiveContainer width="100%" height={genreData.length * 28 + 20}>
                  <BarChart data={genreData} layout="vertical" margin={{ left: 0, right: 10, top: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip {...tooltipStyle} formatter={(value) => [String(value), "Count"]} />
                    <Bar dataKey="count" fill={colours.primary} radius={[0, 2, 2, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            )}

            {/* Decade Distribution */}
            {decadeData.length > 0 && (
              <Card className="flex flex-col">
                <CardTitle icon={Clock} title="Decade Distribution" />
                <div className="flex-1 flex items-center min-h-0">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={decadeData} margin={{ left: -10, right: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="decade" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip {...tooltipStyle} formatter={(value) => [String(value), "Count"]} />
                      <Bar dataKey="count" fill={colours.accent} radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}

            {/* Average Movie Length */}
            {avgMovieRuntime !== null && (
              <Card>
                <CardTitle icon={Clock} title="Movie Length" />
                <div className="text-center mb-5">
                  <div className="font-display text-3xl font-bold">{formatRuntime(avgMovieRuntime)}</div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider mt-1">Average Runtime</p>
                </div>
                <ResponsiveContainer width="100%" height={runtimeBuckets.length * 28 + 10}>
                  <BarChart data={runtimeBuckets} layout="vertical" margin={{ left: 0, right: 10, top: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis dataKey="label" type="category" width={70} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip {...tooltipStyle} formatter={(value) => [String(value), "Count"]} />
                    <Bar dataKey="count" fill={colours.secondary} radius={[0, 2, 2, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            )}

            {/* Release Year vs Watch Date */}
            {scatterData.length > 0 && (
              <Card className="flex flex-col">
                <CardTitle icon={Clapperboard} title="Release Year vs Watch Date" />
                <div className="flex-1 flex items-center min-h-0">
                  <ResponsiveContainer width="100%" height={260}>
                    <ScatterChart margin={{ left: 0, right: 10, bottom: 5, top: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="watchDate"
                        type="number"
                        domain={["dataMin", "dataMax"]}
                        tickFormatter={(v) => new Date(v).toLocaleDateString("default", { month: "short", year: "2-digit" })}
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                        name="Watched"
                      />
                      <YAxis
                        dataKey="releaseYear"
                        type="number"
                        domain={["dataMin - 5", "dataMax + 5"]}
                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                        name="Release Year"
                      />
                      <ZAxis range={[50, 50]} />
                      <Tooltip
                        {...tooltipStyle}
                        formatter={(value, name) => {
                          if (name === "Watched") return [new Date(value as number).toLocaleDateString(), "Watched"];
                          return [String(value), "Release Year"];
                        }}
                        labelFormatter={(_, payload) => payload?.[0]?.payload?.title || ""}
                      />
                      <Scatter data={scatterData} fill={colours.primary} />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}
          </div>
        </>
      )}

      {/* ─── YOU VS THE CROWD ─── */}
      {detailsLoading ? (
        <>
          <SectionHeader icon={Star} title="You vs The Crowd" subtitle="Where your taste diverges from the mainstream" />
          <ChartSkeleton />
        </>
      ) : (hiddenGem || unpopularOpinion) && (
        <>
          <SectionHeader icon={Star} title="You vs The Crowd" subtitle="Where your taste diverges from the mainstream" />
          <div className="grid md:grid-cols-2 gap-3">
            {hiddenGem && (
              <Card>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-primary">Your Hidden Gem</span>
                </div>
                <p className="text-xs text-muted-foreground mb-4">You rated this higher than the crowd</p>
                <div className="flex items-center gap-4">
                  {hiddenGem.posterUrl ? (
                    <img src={hiddenGem.posterUrl} alt={hiddenGem.title} className="w-14 h-20 object-cover border border-border shrink-0" />
                  ) : (
                    <div className="w-14 h-20 border border-border bg-muted/30 flex items-center justify-center shrink-0">
                      <Film className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{hiddenGem.title}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-sm">
                      <span>You: <span className="font-bold">{hiddenGem.userRating}/5</span></span>
                      <span className="text-muted-foreground">TMDB: <span className="font-bold">{hiddenGem.tmdbRating}/10</span></span>
                    </div>
                    <p className="text-xs text-primary font-semibold mt-1">+{hiddenGem.delta} higher than average</p>
                  </div>
                </div>
              </Card>
            )}
            {unpopularOpinion && (
              <Card>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-secondary">Unpopular Opinion</span>
                </div>
                <p className="text-xs text-muted-foreground mb-4">You rated this lower than the crowd</p>
                <div className="flex items-center gap-4">
                  {unpopularOpinion.posterUrl ? (
                    <img src={unpopularOpinion.posterUrl} alt={unpopularOpinion.title} className="w-14 h-20 object-cover border border-border shrink-0" />
                  ) : (
                    <div className="w-14 h-20 border border-border bg-muted/30 flex items-center justify-center shrink-0">
                      <Film className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{unpopularOpinion.title}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-sm">
                      <span>You: <span className="font-bold">{unpopularOpinion.userRating}/5</span></span>
                      <span className="text-muted-foreground">TMDB: <span className="font-bold">{unpopularOpinion.tmdbRating}/10</span></span>
                    </div>
                    <p className="text-xs text-secondary font-semibold mt-1">{unpopularOpinion.delta} lower than average</p>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </>
      )}

      </>)}
    </div>
  );
}
