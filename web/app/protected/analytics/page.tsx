"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  BarChart3,
  TrendingUp,
  Star,
  Film,
  Tv,
  Loader2,
  Plus,
  Radar,
  Clock,
  Clapperboard,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar as RechartsRadar,
  CartesianGrid,
  Legend,
  ScatterChart,
  Scatter,
  ZAxis,
} from "recharts";
import { createClient } from "@/lib/supabase/client";

type WatchLog = {
  rating: number;
  media_type: "movie" | "tv";
  watched_date: string | null;
  created_at: string;
  tmdb_id: number | null;
  title: string;
  plot_rating: number | null;
  cinematography_rating: number | null;
  acting_rating: number | null;
  soundtrack_rating: number | null;
  pacing_rating: number | null;
  casting_rating: number | null;
  watched_on: string | null;
  discovered_via: string | null;
  rewatchability: string | null;
  times_watched: string | null;
  poster_url: string | null;
};

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
  directors: string[];
  topCast: string[];
  voteAvg: number | null;
  releaseYear: number | null;
  posterUrl: string | null;
};

function useThemeColours() {
  const [colours, setColours] = useState({
    primary: "#8B7355",
    accent: "#A0845C",
    secondary: "#6B5B4A",
    muted: "#78716c",
  });

  useEffect(() => {
    const style = getComputedStyle(document.documentElement);
    const resolve = (v: string) => {
      const val = style.getPropertyValue(v).trim();
      return val ? `hsl(${val})` : "";
    };
    setColours({
      primary: resolve("--primary") || colours.primary,
      accent: resolve("--accent") || colours.accent,
      secondary: resolve("--secondary") || colours.secondary,
      muted: resolve("--muted-foreground") || colours.muted,
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

export default function AnalyticsPage() {
  const [watchLogs, setWatchLogs] = useState<WatchLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalRuntime, setTotalRuntime] = useState<number | null>(null);
  const [totalSeasons, setTotalSeasons] = useState<number | null>(null);
  const [totalEpisodes, setTotalEpisodes] = useState<number | null>(null);
  const [tmdbDetails, setTmdbDetails] = useState<Map<number, TmdbDetail>>(new Map());
  const colours = useThemeColours();

  useEffect(() => {
    async function fetchData() {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("watch_logs")
          .select("rating, media_type, watched_date, created_at, tmdb_id, title, plot_rating, cinematography_rating, acting_rating, soundtrack_rating, pacing_rating, casting_rating, watched_on, discovered_via, rewatchability, times_watched, poster_url")
          .order("watched_date", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false });

        if (error) throw error;
        const logs = data || [];
        setWatchLogs(logs);

        // Fetch TMDB details for runtime/seasons/episodes
        const uniqueIds = new Map<number, "movie" | "tv">();
        logs.forEach((l) => {
          if (l.tmdb_id && !uniqueIds.has(l.tmdb_id)) {
            uniqueIds.set(l.tmdb_id, l.media_type);
          }
        });

        if (uniqueIds.size > 0) {
          const entries = Array.from(uniqueIds.entries());
          // Fetch in batches of 10
          const details = new Map<number, TmdbDetail>();
          for (let i = 0; i < entries.length; i += 10) {
            const batch = entries.slice(i, i + 10);
            const results = await Promise.all(
              batch.map(async ([tmdbId, mediaType]) => {
                try {
                  const res = await fetch(`/api?action=detail&type=${mediaType}&id=${tmdbId}`);
                  if (!res.ok) return null;
                  const d = await res.json();
                  const genres = (d.genres || []).map((g: { name: string }) => g.name);
                  const directors = (d.credits?.crew || [])
                    .filter((c: { job: string }) => c.job === "Director")
                    .map((c: { name: string }) => c.name);
                  const topCast = (d.credits?.cast || [])
                    .sort((a: { order: number }, b: { order: number }) => a.order - b.order)
                    .slice(0, 5)
                    .map((c: { name: string }) => c.name);
                  const relDate = d.release_date || d.first_air_date || "";
                  const releaseYear = relDate ? parseInt(relDate.slice(0, 4), 10) : null;
                  return {
                    id: tmdbId,
                    runtime: d.runtime || undefined,
                    seasons: d.number_of_seasons || undefined,
                    episodes: d.number_of_episodes || undefined,
                    genres,
                    directors,
                    topCast,
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

          let rtSum = 0;
          let sSum = 0;
          let eSum = 0;
          logs.forEach((l) => {
            if (!l.tmdb_id) return;
            const d = details.get(l.tmdb_id);
            if (!d) return;
            if (l.media_type === "movie" && d.runtime) rtSum += d.runtime;
            if (l.media_type === "tv") {
              if (d.seasons) sSum += d.seasons;
              if (d.episodes) eSum += d.episodes;
            }
          });
          if (rtSum > 0) setTotalRuntime(rtSum);
          if (sSum > 0) setTotalSeasons(sSum);
          if (eSum > 0) setTotalEpisodes(eSum);
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">Analytics</h1>
          <p className="text-muted-foreground">Insights into your watching habits and taste profile</p>
        </div>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (watchLogs.length === 0) {
    return (
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">Analytics</h1>
          <p className="text-muted-foreground">Insights into your watching habits and taste profile</p>
        </div>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 border-2 border-muted flex items-center justify-center mx-auto mb-6">
            <BarChart3 className="w-10 h-10 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold mb-2">No data yet</h2>
          <p className="text-muted-foreground mb-6 max-w-md">
            Start logging movies and TV shows to see your analytics come to life.
          </p>
          <Button className="group font-semibold border-2" size="lg" asChild>
            <Link href="/protected/log">
              <Plus className="w-4 h-4 mr-2 transition-transform group-hover:rotate-90" />
              Log Your First Watch
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  // === Compute all analytics data ===

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const movieCount = watchLogs.filter((l) => l.media_type === "movie").length;
  const tvCount = watchLogs.filter((l) => l.media_type === "tv").length;
  const avgRating = (watchLogs.reduce((acc, l) => acc + Number(l.rating), 0) / watchLogs.length).toFixed(1);

  // Total views including rewatches
  const totalViews = watchLogs.reduce((acc, l) => {
    if (!l.times_watched) return acc + 1;
    if (l.times_watched === "6+") return acc + 6;
    const n = parseInt(l.times_watched, 10);
    return acc + (isNaN(n) ? 1 : n);
  }, 0);
  const hasRewatches = totalViews > watchLogs.length;

  // Rating distribution — all possible half-star ratings 0.5–5
  const allRatings = Array.from({ length: 10 }, (_, i) => (i + 1) * 0.5); // [0.5, 1, 1.5, ..., 5]
  const ratingBuckets: Record<string, number> = {};
  allRatings.forEach((r) => { ratingBuckets[String(r)] = 0; });
  watchLogs.forEach((l) => {
    const r = Number(l.rating);
    const key = String(r);
    if (key in ratingBuckets) ratingBuckets[key]++;
  });
  const ratingData = allRatings
    .map((r) => ({ rating: String(r), count: ratingBuckets[String(r)] }))
    .reverse();

  // Monthly activity — stacked by movies vs TV
  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("default", { month: "short" });
    return { key, label, movies: 0, tv: 0 };
  });
  watchLogs.forEach((l) => {
    const date = l.watched_date || l.created_at;
    const ym = date.slice(0, 7);
    const bucket = monthlyData.find((m) => m.key === ym);
    if (bucket) {
      if (l.media_type === "movie") bucket.movies++;
      else bucket.tv++;
    }
  });

  // Movies vs TV (pie)
  const mediaTypeData = [
    { name: "Movies", value: movieCount },
    { name: "TV Shows", value: tvCount },
  ].filter((d) => d.value > 0);

  // Platform breakdown
  const platformCounts: Record<string, number> = {};
  watchLogs.forEach((l) => {
    if (l.watched_on) {
      platformCounts[l.watched_on] = (platformCounts[l.watched_on] || 0) + 1;
    }
  });
  const platformData = Object.entries(platformCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // Category averages (radar)
  const categories = [
    { key: "plot_rating" as const, label: "Plot" },
    { key: "cinematography_rating" as const, label: "Cinema" },
    { key: "acting_rating" as const, label: "Acting" },
    { key: "soundtrack_rating" as const, label: "Sound" },
    { key: "pacing_rating" as const, label: "Pacing" },
    { key: "casting_rating" as const, label: "Casting" },
  ];
  const categoryData = categories.map(({ key, label }) => {
    const values = watchLogs.map((l) => l[key]).filter((v): v is number => v !== null && v > 0);
    const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    return { label, avg: Math.round(avg * 10) / 10, count: values.length };
  });
  const hasCategoryData = categoryData.some((c) => c.count > 0);

  // Rewatchability breakdown
  const rewatchCounts: Record<string, number> = {};
  watchLogs.forEach((l) => {
    if (l.rewatchability) {
      rewatchCounts[l.rewatchability] = (rewatchCounts[l.rewatchability] || 0) + 1;
    }
  });
  const rewatchData = Object.entries(rewatchCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Discovery sources
  const discoveryCounts: Record<string, number> = {};
  watchLogs.forEach((l) => {
    if (l.discovered_via) {
      discoveryCounts[l.discovered_via] = (discoveryCounts[l.discovered_via] || 0) + 1;
    }
  });
  const discoveryData = Object.entries(discoveryCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // === New analytics computations ===

  // Highest & Lowest rated
  const sortedByDate = [...watchLogs].sort((a, b) => {
    const da = a.watched_date || a.created_at;
    const db = b.watched_date || b.created_at;
    return da.localeCompare(db);
  });
  const highestRated = sortedByDate.reduce<WatchLog | null>((best, l) => {
    if (!best || l.rating > best.rating) return l;
    return best;
  }, null);
  const lowestRated = sortedByDate.reduce<WatchLog | null>((worst, l) => {
    if (!worst || l.rating < worst.rating) return l;
    return worst;
  }, null);

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

  // Top directors & actors
  const directorCounts: Record<string, number> = {};
  const actorCounts: Record<string, number> = {};
  watchLogs.forEach((l) => {
    if (!l.tmdb_id) return;
    const d = tmdbDetails.get(l.tmdb_id);
    if (!d) return;
    d.directors.forEach((name) => { directorCounts[name] = (directorCounts[name] || 0) + 1; });
    d.topCast.forEach((name) => { actorCounts[name] = (actorCounts[name] || 0) + 1; });
  });
  const topDirectors = Object.entries(directorCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const topActors = Object.entries(actorCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

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

  const PIE_COLOURS = [colours.primary, colours.accent, colours.secondary, colours.muted, "#9CA3AF", "#6B7280"];

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

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">Analytics</h1>
        <p className="text-muted-foreground">
          Insights into your watching habits and taste profile
        </p>
      </div>

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
            {totalRuntime ? formatRuntime(totalRuntime) : "—"}
          </div>
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider">
            {movieCount === 1 ? "Movie" : "Movies"} Watch Time
          </p>
        </Card>
        <Card className="text-center">
          <Clapperboard className="w-4 h-4 text-primary mx-auto mb-2" />
          <div className="font-display text-xl md:text-2xl font-bold mb-0.5">
            {totalSeasons !== null ? totalSeasons : "—"}
            {totalEpisodes !== null && (
              <span className="text-base font-normal text-muted-foreground"> / {totalEpisodes} ep</span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider">
            {totalSeasons === 1 ? "Season" : "Seasons"} of TV
          </p>
        </Card>
      </div>

      {/* Highest & Lowest Rated — highlight cards */}
      {highestRated && lowestRated && (
        <div className="grid md:grid-cols-2 gap-3">
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Highest Rated</span>
            </div>
            <div className="flex items-center gap-4">
              {highestRated.poster_url ? (
                <img src={highestRated.poster_url} alt={highestRated.title} className="w-14 h-20 object-cover border border-border shrink-0" />
              ) : (
                <div className="w-14 h-20 border border-border bg-muted/30 flex items-center justify-center shrink-0">
                  <Film className="w-5 h-5 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0">
                <p className="font-semibold truncate">{highestRated.title}</p>
                <div className="flex items-center gap-1 mt-1">
                  <Star className="w-3.5 h-3.5 text-primary fill-primary" />
                  <span className="font-bold">{highestRated.rating}</span>
                  <span className="text-muted-foreground text-sm">/ 5</span>
                </div>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-muted-foreground rotate-180" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Lowest Rated</span>
            </div>
            <div className="flex items-center gap-4">
              {lowestRated.poster_url ? (
                <img src={lowestRated.poster_url} alt={lowestRated.title} className="w-14 h-20 object-cover border border-border shrink-0" />
              ) : (
                <div className="w-14 h-20 border border-border bg-muted/30 flex items-center justify-center shrink-0">
                  <Film className="w-5 h-5 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0">
                <p className="font-semibold truncate">{lowestRated.title}</p>
                <div className="flex items-center gap-1 mt-1">
                  <Star className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="font-bold">{lowestRated.rating}</span>
                  <span className="text-muted-foreground text-sm">/ 5</span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ─── RATINGS & ACTIVITY ─── */}
      <SectionHeader icon={BarChart3} title="Ratings & Activity" subtitle="How you rate and when you watch" />

      <div className="grid md:grid-cols-2 gap-3">
        {/* Rating Distribution */}
        <Card>
          <CardTitle icon={BarChart3} title="Rating Distribution" />
          <ResponsiveContainer width="100%" height={ratingData.length * 28 + 30}>
            <BarChart data={ratingData} layout="vertical" margin={{ left: 0, right: 10, top: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis dataKey="rating" type="category" width={28} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip {...tooltipStyle} formatter={(value) => [String(value), "Count"]} />
              <Bar dataKey="count" fill={colours.primary} radius={[0, 2, 2, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Monthly Activity */}
        <Card className="flex flex-col">
          <CardTitle icon={TrendingUp} title="Monthly Activity" />
          <div className="flex-1 flex items-center min-h-0">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthlyData} margin={{ left: -10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip {...tooltipStyle} formatter={(value, name) => [String(value), name === "movies" ? "Movies" : "TV Shows"]} />
                <Legend formatter={(value) => (value === "movies" ? "Movies" : "TV Shows")} wrapperStyle={{ fontSize: "11px" }} />
                <Bar dataKey="movies" stackId="a" fill={colours.primary} radius={[0, 0, 0, 0]} />
                <Bar dataKey="tv" stackId="a" fill={colours.accent} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Movies vs TV */}
        <Card>
          <CardTitle icon={Tv} title="Movies vs TV Shows" />
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={mediaTypeData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" strokeWidth={2} stroke="hsl(var(--background))" label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                {mediaTypeData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLOURS[i % PIE_COLOURS.length]} />
                ))}
              </Pie>
              <Tooltip {...tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        {/* Platform Breakdown */}
        <Card>
          <CardTitle icon={BarChart3} title="Platforms" />
          {platformData.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(200, platformData.length * 36 + 20)}>
              <BarChart data={platformData} layout="vertical" margin={{ left: 0, right: 10, top: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip {...tooltipStyle} formatter={(value) => [String(value), "Count"]} />
                <Bar dataKey="count" fill={colours.secondary} radius={[0, 2, 2, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[200px]">
              <p className="text-sm text-muted-foreground italic">Log where you watch to see platform stats</p>
            </div>
          )}
        </Card>
      </div>

      {/* ─── TASTE PROFILE ─── */}
      {hasCategoryData && (
        <>
          <SectionHeader icon={Radar} title="Taste Profile" subtitle="Your category preferences across all ratings" />
          <Card>
            <div className="grid md:grid-cols-[1fr,auto] gap-6 items-center">
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={categoryData} cx="50%" cy="50%" outerRadius="75%">
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="label" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                  <PolarRadiusAxis angle={90} domain={[0, 5]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickCount={6} />
                  <RechartsRadar dataKey="avg" stroke={colours.primary} fill={colours.primary} fillOpacity={0.2} strokeWidth={2} />
                  <Tooltip {...tooltipStyle} formatter={(value) => [Number(value).toFixed(1), "Avg"]} />
                </RadarChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-3 md:grid-cols-1 gap-2">
                {categoryData.map((c) => (
                  <div key={c.label} className="flex items-center justify-between gap-4 text-sm">
                    <span className="text-muted-foreground">{c.label}</span>
                    <span className="font-bold tabular-nums">{c.count > 0 ? c.avg.toFixed(1) : "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </>
      )}

      {/* ─── CONTENT PROFILE ─── */}
      {(genreData.length > 0 || decadeData.length > 0 || avgMovieRuntime !== null || scatterData.length > 0) && (
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

      {/* ─── PEOPLE ─── */}
      {(topDirectors.length > 0 || topActors.length > 0) && (
        <>
          <SectionHeader icon={Star} title="People" subtitle="The directors and actors you keep coming back to" />
          <Card>
            <div className="grid md:grid-cols-2 gap-6">
              {topDirectors.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Top Directors</p>
                  <div className="space-y-2.5">
                    {topDirectors.map((d, i) => (
                      <div key={d.name} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <span className="w-5 h-5 border border-border flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0">{i + 1}</span>
                          {d.name}
                        </span>
                        <span className="text-muted-foreground text-xs">{d.count} {d.count === 1 ? "title" : "titles"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {topActors.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Top Actors</p>
                  <div className="space-y-2.5">
                    {topActors.map((a, i) => (
                      <div key={a.name} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <span className="w-5 h-5 border border-border flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0">{i + 1}</span>
                          {a.name}
                        </span>
                        <span className="text-muted-foreground text-xs">{a.count} {a.count === 1 ? "title" : "titles"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </>
      )}

      {/* ─── HABITS & DISCOVERY ─── */}
      {(rewatchData.length > 0 || discoveryData.length > 0) && (
        <>
          <SectionHeader icon={TrendingUp} title="Habits & Discovery" subtitle="How you find and rewatch content" />
          <div className="grid md:grid-cols-2 gap-3">
            {rewatchData.length > 0 && (
              <Card>
                <CardTitle icon={Star} title="Rewatchability" />
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={rewatchData} cx="50%" cy="50%" outerRadius={75} dataKey="value" strokeWidth={2} stroke="hsl(var(--background))" label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                      {rewatchData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLOURS[i % PIE_COLOURS.length]} />
                      ))}
                    </Pie>
                    <Tooltip {...tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            )}
            {discoveryData.length > 0 && (
              <Card>
                <CardTitle icon={TrendingUp} title="How You Discover" />
                <ResponsiveContainer width="100%" height={Math.max(200, discoveryData.length * 32 + 20)}>
                  <BarChart data={discoveryData} layout="vertical" margin={{ left: 0, right: 10, top: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip {...tooltipStyle} formatter={(value) => [String(value), "Count"]} />
                    <Bar dataKey="count" fill={colours.primary} radius={[0, 2, 2, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            )}
          </div>
        </>
      )}

      {/* ─── YOU VS THE CROWD ─── */}
      {(hiddenGem || unpopularOpinion) && (
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
    </div>
  );
}
