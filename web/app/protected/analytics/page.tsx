"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { BarChart3, Film, Headphones, Plus } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/loading";
import {
  EmptyState,
  LeaderRow,
  Notice,
  PageHeader,
  SectionHeader,
  StatBlock,
} from "@/components/ui/page";
import type { ListenLog } from "@/lib/types";

type WatchLog = {
  rating: number | null;
  media_type: "movie" | "tv";
  watched_date: string | null;
  created_at: string;
  tmdb_id: number | null;
  title: string;
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
  voteAvg: number | null;
  releaseYear: number | null;
  posterUrl: string | null;
};

type Tally = { name: string; count: number };

// ─── Helpers ────────────────────────────────────────────────────

function formatRuntime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatDate(value: Date | number | string, options: Intl.DateTimeFormatOptions): string {
  return new Date(value).toLocaleDateString("en-GB", options);
}

/** "Jun '26", from the one en-GB formatter. */
function formatMonthYear(value: number): string {
  return `${formatDate(value, { month: "short" })} '${formatDate(value, { year: "2-digit" })}`;
}

/** A log counts toward ratings only when it has one (null, undefined and 0 mean unrated). */
function isRated(l: { rating: number | null | undefined }): boolean {
  return Number(l.rating) > 0;
}

/** TMDB movie and TV ids are separate namespaces, so details are keyed by the pair. */
function detailKey(mediaType: "movie" | "tv", tmdbId: number): string {
  return `${mediaType}:${tmdbId}`;
}

function needsDetails(n: number, rated = false): string {
  return `Needs at least ${n} ${rated ? "rated " : ""}${plural(n, "film", "films")} with details to draw this.`;
}

function truncate(text: string, max = 14): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

function tally(values: (string | null | undefined)[]): Tally[] {
  const counts: Record<string, number> = {};
  values.forEach((v) => {
    if (v) counts[v] = (counts[v] || 0) + 1;
  });
  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

const MIN_POINTS = 3;

// ─── Chart chrome (tokens only; these follow the mode) ──────────

const CHART = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];
const GRID_STROKE = "var(--border-raw)";
const AXIS_TICK = { fill: "var(--text-muted)", fontSize: 11, fontFamily: "var(--font-ui)" };
const AXIS_PROPS = {
  tick: AXIS_TICK,
  tickLine: false,
  axisLine: { stroke: "var(--border-strong)" },
};
const TOOLTIP_PROPS = {
  contentStyle: {
    backgroundColor: "var(--surface-3)",
    border: "1px solid var(--border-strong)",
    borderRadius: 0,
    color: "var(--text)",
    fontFamily: "var(--font-ui)",
    fontSize: 12,
  },
  labelStyle: { color: "var(--text)", fontWeight: 600 },
  itemStyle: { color: "var(--text)" },
};
const BAR_CURSOR = { fill: "var(--surface-2)" };
const AXIS_LABEL = {
  fill: "var(--text-muted)",
  fontSize: 11,
  fontFamily: "var(--font-ui)",
  textAnchor: "middle" as const,
};

// ─── Local building blocks ──────────────────────────────────────

function Section({
  title,
  meta,
  note,
  children,
}: {
  title: string;
  meta?: React.ReactNode;
  /** One plain line explaining what the section shows. */
  note?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <SectionHeader title={title} meta={meta} description={note} />
      {children}
    </section>
  );
}

/** A chart in its single frame, with a title and a hidden one-sentence summary. */
function ChartFigure({
  title,
  summary,
  children,
}: {
  title: string;
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <figure className="frame min-w-0 p-4 sm:p-5">
      <figcaption className="mb-4">
        <span className="t-label">{title}</span>
        <span className="sr-only">. {summary}</span>
      </figcaption>
      {children}
    </figure>
  );
}

function ChartSkeleton({ label, className = "h-[260px]" }: { label: string; className?: string }) {
  return (
    <div role="status" aria-label={label} className="min-w-0">
      <Skeleton className={`w-full ${className}`} />
    </div>
  );
}

function ListSkeleton({ label, rows = 5 }: { label: string; rows?: number }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-3 py-1.5">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-3 w-full" />
      ))}
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="t-meta">{children}</p>;
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="t-label hairline mb-2 pb-2">{children}</h3>;
}

function RankedList({ items, unit }: { items: Tally[]; unit: (n: number) => string }) {
  return (
    <ol>
      {items.map((item, i) => (
        <li key={item.name}>
          <LeaderRow
            label={
              <>
                <span className="mr-2">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-foreground">{item.name}</span>
              </>
            }
            value={`${item.count} ${unit(item.count)}`}
          />
        </li>
      ))}
    </ol>
  );
}

/** Horizontal bars, one series: a count per named thing. */
function TallyBars({
  data,
  seriesName,
  color = CHART[0],
  labelWidth = 104,
}: {
  data: Tally[];
  seriesName: string;
  color?: string;
  labelWidth?: number;
}) {
  const height = Math.max(140, data.length * 30 + 36);
  return (
    <ResponsiveContainer width="100%" height={height} minWidth={0}>
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 12, top: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID_STROKE} horizontal={false} />
        <XAxis type="number" allowDecimals={false} {...AXIS_PROPS} />
        <YAxis
          dataKey="name"
          type="category"
          width={labelWidth}
          interval={0}
          tickFormatter={(v) => truncate(String(v))}
          {...AXIS_PROPS}
        />
        <Tooltip {...TOOLTIP_PROPS} cursor={BAR_CURSOR} />
        <Bar dataKey="count" name={seriesName} fill={color} radius={0} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function tallySummary(data: Tally[], what: string): string {
  const total = data.reduce((acc, d) => acc + d.count, 0);
  return `${what}: ${data[0].name} leads with ${data[0].count} of ${total}.`;
}

function CrowdPick({ pick, kind }: { pick: ControversialPick; kind: "gem" | "unpopular" }) {
  const gap = Math.abs(pick.delta);
  return (
    <div className="frame min-w-0 p-5">
      <Badge variant={kind === "gem" ? "default" : "secondary"}>
        {kind === "gem" ? "Your hidden gem" : "Unpopular opinion"}
      </Badge>
      <p className="t-meta mt-2">
        {kind === "gem" ? "You rated this higher than the crowd" : "You rated this lower than the crowd"}
      </p>
      <div className="mt-4 flex items-start gap-4">
        {pick.posterUrl ? (
          <img
            src={pick.posterUrl}
            alt=""
            className="h-[84px] w-14 shrink-0 border border-border object-cover"
          />
        ) : (
          <div className="well flex h-[84px] w-14 shrink-0 items-center justify-center">
            <Film className="size-5 text-dim" aria-hidden="true" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="t-card truncate">{pick.title}</p>
          <LeaderRow label="You" value={`${pick.userRating}/5`} className="mt-1" />
          <LeaderRow label="TMDB average" value={`${pick.tmdbRating}/10`} />
          <p className={`mt-1 text-[13px] font-medium ${kind === "gem" ? "text-primary" : "text-foreground"}`}>
            {gap} {plural(gap, "point", "points")} {kind === "gem" ? "above" : "below"} the average
          </p>
        </div>
      </div>
    </div>
  );
}

function DetailsNotice({
  failed,
  onRetry,
  className,
}: {
  failed: number;
  onRetry: () => void;
  className?: string;
}) {
  return (
    <Notice
      tone="error"
      title="Some details didn't load"
      className={className}
      action={
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      }
    >
      We couldn&apos;t fetch film and TV details for {failed} {plural(failed, "title", "titles")}, so
      the figures here may be incomplete.
    </Notice>
  );
}


// ─── Film mode ──────────────────────────────────────────────────

function FilmAnalytics({
  watchLogs,
  tmdbDetails,
  detailsLoading,
  detailsFailed,
  onRetry,
}: {
  watchLogs: WatchLog[];
  tmdbDetails: Map<string, TmdbDetail>;
  detailsLoading: boolean;
  detailsFailed: number;
  onRetry: () => void;
}) {
  const now = new Date();

  const movieCount = watchLogs.filter((l) => l.media_type === "movie").length;
  // Unrated entries still count as logged, but never as a rating of zero
  const ratedLogs = watchLogs.filter(isRated);
  const avgRating =
    ratedLogs.length > 0
      ? (ratedLogs.reduce((acc, l) => acc + Number(l.rating), 0) / ratedLogs.length).toFixed(1)
      : "—";

  // Total views including rewatches
  const totalViews = watchLogs.reduce((acc, l) => {
    if (!l.times_watched) return acc + 1;
    if (l.times_watched === "6+") return acc + 6;
    const n = parseInt(l.times_watched, 10);
    return acc + (isNaN(n) ? 1 : n);
  }, 0);
  const hasRewatches = totalViews > watchLogs.length;

  // Everything below depends on the film and TV details fetched per title
  const detailFor = (l: WatchLog) =>
    l.tmdb_id ? tmdbDetails.get(detailKey(l.media_type, l.tmdb_id)) : undefined;

  // Watch time and seasons are derived from the logs and the details; a dash until they arrive
  let runtimeSum = 0;
  let seasonSum = 0;
  let episodeSum = 0;
  watchLogs.forEach((l) => {
    const d = detailFor(l);
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

  const genreData = tally(watchLogs.flatMap((l) => detailFor(l)?.genres ?? [])).slice(0, 10);

  const decadeCounts: Record<string, number> = {};
  watchLogs.forEach((l) => {
    const d = detailFor(l);
    if (!d || !d.releaseYear) return;
    const decade = `${Math.floor(d.releaseYear / 10) * 10}s`;
    decadeCounts[decade] = (decadeCounts[decade] || 0) + 1;
  });
  const decadeData: Tally[] = Object.entries(decadeCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const movieRuntimes: number[] = [];
  watchLogs.forEach((l) => {
    if (l.media_type !== "movie") return;
    const d = detailFor(l);
    if (d?.runtime) movieRuntimes.push(d.runtime);
  });
  const avgMovieRuntime = movieRuntimes.length > 0
    ? Math.round(movieRuntimes.reduce((a, b) => a + b, 0) / movieRuntimes.length)
    : null;
  const runtimeBuckets: Tally[] = [
    { name: "<90m", count: movieRuntimes.filter((r) => r < 90).length },
    { name: "90–120m", count: movieRuntimes.filter((r) => r >= 90 && r < 120).length },
    { name: "120–150m", count: movieRuntimes.filter((r) => r >= 120 && r < 150).length },
    { name: "150m+", count: movieRuntimes.filter((r) => r >= 150).length },
  ];
  const commonRuntime = runtimeBuckets.reduce((a, b) => (b.count > a.count ? b : a), runtimeBuckets[0]);

  const scatterData: { watchDate: number; releaseYear: number; title: string }[] = [];
  watchLogs.forEach((l) => {
    const d = detailFor(l);
    if (!d?.releaseYear) return;
    const watchTs = new Date(l.watched_date || l.created_at).getTime();
    scatterData.push({ watchDate: watchTs, releaseYear: d.releaseYear, title: l.title });
  });
  const releaseYears = scatterData.map((p) => p.releaseYear);
  // Release axis: earliest decade up to the current year, whole-year ticks
  const yearNow = now.getFullYear();
  const yearMin = releaseYears.length > 0 ? Math.floor(Math.min(...releaseYears) / 10) * 10 : yearNow - 10;
  const yearMax = Math.max(yearNow, ...releaseYears);
  const yearStep = yearMax - yearMin > 60 ? 20 : 10;
  const yearTicks: number[] = [];
  for (let y = yearMin; y <= yearMax; y += yearStep) yearTicks.push(y);


  // Where your rating sits furthest from the public average
  const controversialPicks = watchLogs.reduce<{ gem: ControversialPick | null; unpopular: ControversialPick | null }>(
    (acc, l) => {
      const d = detailFor(l);
      if (!d || d.voteAvg === null || !isRated(l)) return acc;
      const userRating = Number(l.rating);
      const userOn10 = userRating * 2; // 0.5–5 → 1–10
      const delta = userOn10 - d.voteAvg;
      const pick: ControversialPick = {
        title: l.title,
        posterUrl: l.poster_url || d.posterUrl,
        userRating,
        tmdbRating: Math.round(d.voteAvg * 10) / 10,
        delta: Math.round(delta * 10) / 10,
      };
      if (delta > 0 && (!acc.gem || delta > acc.gem.delta)) acc.gem = pick;
      if (delta < 0 && (!acc.unpopular || delta < acc.unpopular.delta)) acc.unpopular = pick;
      return acc;
    },
    { gem: null, unpopular: null },
  );
  const hiddenGem = controversialPicks.gem;
  const unpopularOpinion = controversialPicks.unpopular;

  return (
    <>
      <div className="grid grid-cols-2 gap-x-8 gap-y-8 md:grid-cols-4">
        <StatBlock
          label="Watched"
          value={watchLogs.length}
          hint={
            hasRewatches
              ? `${totalViews}${watchLogs.some((l) => l.times_watched === "6+") ? "+" : ""} views with rewatches`
              : undefined
          }
        />
        <StatBlock label="Average rating" value={avgRating} hint="out of 5" />
        <StatBlock
          label="Film watch time"
          value={totalRuntime ? formatRuntime(totalRuntime) : "—"}
          hint={`${movieCount} ${plural(movieCount, "film", "films")}`}
        />
        <StatBlock
          label={`${totalSeasons === 1 ? "Season" : "Seasons"} of TV`}
          value={totalSeasons !== null ? totalSeasons : "—"}
          hint={
            totalEpisodes !== null
              ? `${totalEpisodes} ${plural(totalEpisodes, "episode", "episodes")}`
              : undefined
          }
        />
      </div>

      <Section title="Content profile" note="What you watch, how long it runs and when it was made.">
        {detailsFailed > 0 && <DetailsNotice failed={detailsFailed} onRetry={onRetry} className="mb-6" />}
        <div className="flex flex-col gap-10">
            <div className="grid items-start gap-x-10 gap-y-8 md:grid-cols-2">
              <div className="min-w-0">
                <SubHeading>Top genres</SubHeading>
                {detailsLoading ? (
                  <ListSkeleton label="Loading genres" rows={8} />
                ) : genreData.length > 0 ? (
                  <RankedList items={genreData} unit={(n) => plural(n, "title", "titles")} />
                ) : (
                  <Hint>{needsDetails(1)}</Hint>
                )}
              </div>
              {detailsLoading ? (
                <ChartSkeleton label="Loading decades" className="h-[300px]" />
              ) : decadeData.length > 0 ? (
                <ChartFigure
                  title="By decade of release"
                  summary={tallySummary(
                    [...decadeData].sort((a, b) => b.count - a.count),
                    "Titles by decade of release",
                  )}
                >
                  <ResponsiveContainer width="100%" height={240} minWidth={0}>
                    <BarChart data={decadeData} margin={{ left: -16, right: 4, top: 4, bottom: 0 }}>
                      <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                      <XAxis dataKey="name" minTickGap={4} {...AXIS_PROPS} />
                      <YAxis allowDecimals={false} {...AXIS_PROPS} />
                      <Tooltip {...TOOLTIP_PROPS} cursor={BAR_CURSOR} />
                      <Bar dataKey="count" name="Titles" fill={CHART[0]} radius={0} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartFigure>
              ) : (
                <Hint>{needsDetails(1)}</Hint>
              )}
            </div>
            <div className="grid items-start gap-x-10 gap-y-8 md:grid-cols-2">
              <div className="min-w-0">
                {detailsLoading ? (
                  <ChartSkeleton label="Loading film lengths" />
                ) : avgMovieRuntime !== null ? (
                  <>
                    <StatBlock
                      size="md"
                      className="mb-6"
                      label="Average film length"
                      value={formatRuntime(avgMovieRuntime)}
                    />
                    <ChartFigure
                      title="Films by length"
                      summary={`Average film length is ${formatRuntime(avgMovieRuntime)}. Most of your films run ${commonRuntime.name}: ${commonRuntime.count} of ${movieRuntimes.length}.`}
                    >
                      <TallyBars data={runtimeBuckets} seriesName="Films" labelWidth={72} />
                    </ChartFigure>
                  </>
                ) : (
                  <Hint>{needsDetails(1)}</Hint>
                )}
              </div>
              {detailsLoading ? (
                <ChartSkeleton label="Loading release years" className="h-[320px]" />
              ) : scatterData.length >= MIN_POINTS ? (
                <ChartFigure
                  title="Release year against watch date"
                  summary={`${scatterData.length} titles, released between ${Math.min(...releaseYears)} and ${Math.max(...releaseYears)}, plotted by the date you watched them.`}
                >
                  <ResponsiveContainer width="100%" height={280} minWidth={0}>
                    <ScatterChart margin={{ left: 4, right: 16, bottom: 20, top: 8 }}>
                      <CartesianGrid stroke={GRID_STROKE} />
                      <XAxis
                        dataKey="watchDate"
                        type="number"
                        domain={["dataMin", "dataMax"]}
                        tickCount={4}
                        tickFormatter={(v) => formatMonthYear(Number(v))}
                        name="Watched"
                        padding={{ left: 16, right: 16 }}
                        label={{ value: "Watched", position: "insideBottom", offset: -14, ...AXIS_LABEL }}
                        {...AXIS_PROPS}
                      />
                      <YAxis
                        dataKey="releaseYear"
                        type="number"
                        domain={[yearMin, yearMax]}
                        ticks={yearTicks}
                        allowDecimals={false}
                        name="Release year"
                        width={52}
                        padding={{ top: 8, bottom: 16 }}
                        label={{ value: "Released", angle: -90, position: "insideLeft", offset: 8, ...AXIS_LABEL }}
                        {...AXIS_PROPS}
                      />
                      <ZAxis range={[40, 40]} />
                      <Tooltip
                        {...TOOLTIP_PROPS}
                        cursor={{ stroke: "var(--border-strong)" }}
                        formatter={(value, name) => {
                          if (name === "Watched") {
                            return [
                              formatDate(value as number, { day: "numeric", month: "short", year: "numeric" }),
                              "Watched",
                            ];
                          }
                          return [String(value), "Release year"];
                        }}
                        labelFormatter={(_, payload) => payload?.[0]?.payload?.title || ""}
                      />
                      <Scatter data={scatterData} fill={CHART[0]} isAnimationActive={false} />
                    </ScatterChart>
                  </ResponsiveContainer>
                </ChartFigure>
              ) : (
                <Hint>{needsDetails(MIN_POINTS)}</Hint>
              )}
            </div>
        </div>
      </Section>

      <Section
        title="You and the crowd"
        note="Your rating next to the public average on TMDB, the film database this app uses. TMDB scores are out of 10, so your rating is doubled to compare."
      >
            {detailsLoading ? (
              <div className="grid gap-6 md:grid-cols-2">
                <ChartSkeleton label="Loading comparisons" className="h-[190px]" />
                <ChartSkeleton label="Loading comparisons" className="h-[190px]" />
              </div>
            ) : hiddenGem || unpopularOpinion ? (
              <div className="grid gap-6 md:grid-cols-2">
                {hiddenGem && <CrowdPick pick={hiddenGem} kind="gem" />}
                {unpopularOpinion && <CrowdPick pick={unpopularOpinion} kind="unpopular" />}
              </div>
            ) : (
              <Hint>{needsDetails(1, true)}</Hint>
            )}
      </Section>
    </>
  );
}

// ─── Music mode ─────────────────────────────────────────────────

function MusicAnalytics({ listenLogs }: { listenLogs: ListenLog[] }) {
  const albumCount = listenLogs.filter((l) => l.media_type === "album").length;
  const trackCount = listenLogs.filter((l) => l.media_type === "track").length;
  const ratedLogs = listenLogs.filter(isRated);
  const avgRating =
    ratedLogs.length > 0
      ? (ratedLogs.reduce((acc, l) => acc + Number(l.rating), 0) / ratedLogs.length).toFixed(1)
      : "—";

  const topArtists = tally(listenLogs.map((l) => l.artist)).slice(0, 10);

  return (
    <>
      <div className="grid grid-cols-2 gap-x-8 gap-y-8 md:grid-cols-4">
        <StatBlock label="Logged" value={listenLogs.length} />
        <StatBlock label="Average rating" value={avgRating} hint="out of 5" />
        <StatBlock label="Albums" value={albumCount} />
        <StatBlock label="Tracks" value={trackCount} />
      </div>

      <Section title="Top artists" note="The artists you have logged the most.">
        {topArtists.length > 0 ? (
          <div className="max-w-xl">
            <RankedList items={topArtists} unit={(n) => plural(n, "log", "logs")} />
          </div>
        ) : (
          <Hint>Log 1 more album or track with an artist to see this.</Hint>
        )}
      </Section>
    </>
  );
}

// ─── Page ───────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { mode } = useMode();
  const isMusic = mode === "music";
  const [watchLogs, setWatchLogs] = useState<WatchLog[]>([]);
  const [listenLogs, setListenLogs] = useState<ListenLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsFailed, setDetailsFailed] = useState(0);
  const [tmdbDetails, setTmdbDetails] = useState<Map<string, TmdbDetail>>(new Map());
  const [attempt, setAttempt] = useState(0);
  const [detailsAttempt, setDetailsAttempt] = useState(0);

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
      setTmdbDetails(new Map());
      setDetailsLoading(false);
      setDetailsFailed(0);
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
  }, [isMusic, attempt]);

  // Film and TV details (runtime, seasons, genres, release year, public score), once the logs are in.
  useEffect(() => {
    if (isMusic) return;
    let cancelled = false;

    async function fetchDetails() {
      const uniqueIds = new Map<string, { id: number; type: "movie" | "tv" }>();
      watchLogs.forEach((l) => {
        if (!l.tmdb_id) return;
        const key = detailKey(l.media_type, l.tmdb_id);
        if (!uniqueIds.has(key)) uniqueIds.set(key, { id: l.tmdb_id, type: l.media_type });
      });
      if (uniqueIds.size === 0) return;

      setDetailsLoading(true);
      setDetailsFailed(0);
      try {
        const entries = Array.from(uniqueIds.entries());
        // Fetch in batches of 10
        const details = new Map<string, TmdbDetail>();
        let failed = 0;
        for (let i = 0; i < entries.length; i += 10) {
          const batch = entries.slice(i, i + 10);
          const results = await Promise.all(
            batch.map(async ([key, { id: tmdbId, type: mediaType }]) => {
              try {
                const res = await fetch(`/api?action=detail&type=${mediaType}&id=${tmdbId}`);
                if (!res.ok) return null;
                const d = await res.json();
                const genres = (d.genres || []).map((g: { name: string }) => g.name);
                const relDate = d.release_date || d.first_air_date || "";
                const releaseYear = relDate ? parseInt(relDate.slice(0, 4), 10) : null;
                return {
                  key,
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
            }),
          );
          if (cancelled) return;
          results.forEach((r) => {
            if (r) {
              const { key, ...rest } = r;
              details.set(key, rest);
            } else {
              failed++;
            }
          });
        }
        if (cancelled) return;
        setTmdbDetails(details);
        setDetailsFailed(failed);
      } finally {
        if (!cancelled) setDetailsLoading(false);
      }
    }

    fetchDetails();
    return () => {
      cancelled = true;
    };
  }, [isMusic, watchLogs, detailsAttempt]);

  const retry = () => setAttempt((n) => n + 1);
  const retryDetails = () => setDetailsAttempt((n) => n + 1);

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
