"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { BarChart3, Disc3, Film, Headphones, Music2, Plus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar as RechartsRadar,
  CartesianGrid,
  ScatterChart,
  Scatter,
  ZAxis,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import { useMode } from "@/lib/mode-context";
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
import { TabBar } from "@/components/ui/segmented-control";
import { Stars } from "@/components/ui/stars";

type WatchLog = {
  rating: number | null;
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
  review: string | null;
};

type ListenLog = {
  id: string;
  media_type: "album" | "track";
  title: string;
  artist: string | null;
  album_name: string | null;
  image_url: string | null;
  rating: number | null;
  review: string | null;
  listened_date: string | null;
  created_at: string;
  lyrics_rating: number | null;
  production_rating: number | null;
  vocals_rating: number | null;
  melody_rating: number | null;
  replay_rating: number | null;
  energy_rating: number | null;
  listened_on: string | null;
  listening_context: string | null;
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

type Tally = { name: string; count: number };
type CategoryAverage = { label: string; full: string; avg: number; count: number };

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

/** The last 12 calendar months, oldest first, each with two zeroed counters. */
function lastTwelveMonths(now: Date) {
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return { key, label: formatDate(d, { month: "short" }), a: 0, b: 0 };
  });
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

function TabPanel({
  idBase,
  value,
  children,
}: {
  idBase: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role="tabpanel"
      id={`${idBase}-panel-${value}`}
      aria-labelledby={`${idBase}-tab-${value}`}
      tabIndex={0}
      className="advance mt-10 flex flex-col gap-16"
    >
      {children}
    </div>
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

function Swatch({ color }: { color: string }) {
  return (
    <span
      aria-hidden="true"
      className="mr-2 inline-block size-2 shrink-0"
      style={{ background: color }}
    />
  );
}

function SeriesKey({ series }: { series: { name: string; color: string }[] }) {
  return (
    <div className="mb-3 flex flex-wrap gap-x-5 gap-y-1" aria-hidden="true">
      {series.map((s) => (
        <span key={s.name} className="t-label inline-flex items-center">
          <Swatch color={s.color} />
          {s.name}
        </span>
      ))}
    </div>
  );
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

/** Stacked monthly columns for two kinds of log. */
function MonthlyBars({
  data,
  nameA,
  nameB,
}: {
  data: { label: string; a: number; b: number }[];
  nameA: string;
  nameB: string;
}) {
  return (
    <>
      <SeriesKey
        series={[
          { name: nameA, color: CHART[0] },
          { name: nameB, color: CHART[1] },
        ]}
      />
      <ResponsiveContainer width="100%" height={240} minWidth={0}>
        <BarChart data={data} margin={{ left: -16, right: 4, top: 4, bottom: 0 }}>
          <CartesianGrid stroke={GRID_STROKE} vertical={false} />
          <XAxis dataKey="label" minTickGap={4} {...AXIS_PROPS} />
          <YAxis allowDecimals={false} {...AXIS_PROPS} />
          <Tooltip {...TOOLTIP_PROPS} cursor={BAR_CURSOR} />
          <Bar dataKey="a" name={nameA} stackId="logs" fill={CHART[0]} radius={0} isAnimationActive={false} />
          <Bar dataKey="b" name={nameB} stackId="logs" fill={CHART[1]} radius={0} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </>
  );
}

function monthlySummary(data: { label: string; a: number; b: number }[], noun: string): string {
  const total = data.reduce((acc, m) => acc + m.a + m.b, 0);
  const busiest = data.reduce((best, m) => (m.a + m.b > best.a + best.b ? m : best), data[0]);
  if (total === 0) return `Nothing ${noun} in the last 12 months.`;
  return `${total} ${noun} in the last 12 months. Busiest month: ${busiest.label}, with ${busiest.a + busiest.b}.`;
}

function tallySummary(data: Tally[], what: string): string {
  const total = data.reduce((acc, d) => acc + d.count, 0);
  return `${what}: ${data[0].name} leads with ${data[0].count} of ${total}.`;
}

type RadarTickProps = {
  x?: number | string;
  y?: number | string;
  textAnchor?: string;
  payload?: { value?: unknown };
};

/** Full category name, wrapped onto two lines at a space, so no label is clipped. */
function RadarLabel({ x = 0, y = 0, textAnchor, payload }: RadarTickProps) {
  const words = String(payload?.value ?? "").split(" ");
  return (
    <text x={x} y={y} textAnchor={textAnchor as "start" | "middle" | "end" | undefined} style={{ ...AXIS_TICK, fontSize: 10 }}>
      {words.map((w, i) => (
        <tspan key={i} x={x} dy={i === 0 ? "0.32em" : "1.1em"}>
          {w}
        </tspan>
      ))}
    </text>
  );
}

/** Category averages: the web chart in a frame, the exact figures beside it. */
function CategoryProfile({ data }: { data: CategoryAverage[] }) {
  const rated = data.filter((c) => c.count > 0);
  const best = rated.reduce((a, b) => (b.avg > a.avg ? b : a), rated[0]);
  const worst = rated.reduce((a, b) => (b.avg < a.avg ? b : a), rated[0]);
  return (
    <div className="grid items-start gap-x-10 gap-y-6 md:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <div className="min-w-0 max-w-[420px]">
        <ChartFigure
          title="Average by category"
          summary={`Highest: ${best.full} at ${best.avg.toFixed(1)} out of 5. Lowest: ${worst.full} at ${worst.avg.toFixed(1)}.`}
        >
          <ResponsiveContainer width="100%" aspect={1} minWidth={0}>
            <RadarChart data={data} cx="50%" cy="50%" outerRadius="54%">
              <PolarGrid stroke={GRID_STROKE} />
              <PolarAngleAxis dataKey="full" tick={RadarLabel} tickLine={false} stroke={GRID_STROKE} />
              <PolarRadiusAxis angle={90} domain={[0, 5]} tickCount={6} tick={false} axisLine={false} />
              <RechartsRadar
                dataKey="avg"
                name="Average"
                stroke={CHART[0]}
                fill={CHART[0]}
                fillOpacity={0.2}
                strokeWidth={1.5}
                isAnimationActive={false}
              />
              <Tooltip {...TOOLTIP_PROPS} formatter={(value) => [Number(value).toFixed(1), "Average"]} />
            </RadarChart>
          </ResponsiveContainer>
        </ChartFigure>
      </div>
      <div className="min-w-0">
        <SubHeading>Averages out of 5</SubHeading>
        {data.map((c) => (
          <LeaderRow key={c.full} truncate label={c.full} value={c.count > 0 ? c.avg.toFixed(1) : "—"} />
        ))}
      </div>
    </div>
  );
}

/** One logged title on a ruled line: artwork, title, rating. */
function TitleRow({
  label,
  title,
  meta,
  image,
  aspect,
  rating,
  fallbackIcon: FallbackIcon,
}: {
  label?: string;
  title: string;
  meta?: string | null;
  image: string | null;
  aspect: "poster" | "square";
  rating: number;
  fallbackIcon: LucideIcon;
}) {
  const box = aspect === "poster" ? "h-[60px] w-10" : "size-10";
  return (
    <li className="hairline flex items-center gap-4 py-3">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className={`${box} shrink-0 border border-border object-cover`} />
      ) : (
        <div className={`well flex ${box} shrink-0 items-center justify-center`}>
          <FallbackIcon className="size-4 text-dim" aria-hidden="true" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        {label && <p className="t-label mb-0.5">{label}</p>}
        <p className="t-card truncate">{title}</p>
        {meta && <p className="t-meta truncate">{meta}</p>}
      </div>
      <Stars value={Number(rating)} showValue className="shrink-0" />
    </li>
  );
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
          // eslint-disable-next-line @next/next/no-img-element
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

type FilmTab = "overview" | "taste" | "library" | "habits";

const FILM_TABS: { value: FilmTab; label: string }[] = [
  { value: "overview", label: "Overview" },
  { value: "taste", label: "Taste" },
  { value: "library", label: "What you watch" },
  { value: "habits", label: "Habits" },
];

const FILM_CATEGORIES = [
  { key: "plot_rating", label: "Plot", full: "Plot" },
  { key: "cinematography_rating", label: "Cinema", full: "Cinematography" },
  { key: "acting_rating", label: "Acting", full: "Acting" },
  { key: "soundtrack_rating", label: "Sound", full: "Soundtrack" },
  { key: "pacing_rating", label: "Pacing", full: "Pacing" },
  { key: "casting_rating", label: "Casting", full: "Casting" },
] as const;

function FilmAnalytics({
  watchLogs,
  tmdbDetails,
  totalRuntime,
  totalSeasons,
  totalEpisodes,
  detailsLoading,
  detailsFailed,
  onRetry,
}: {
  watchLogs: WatchLog[];
  tmdbDetails: Map<string, TmdbDetail>;
  totalRuntime: number | null;
  totalSeasons: number | null;
  totalEpisodes: number | null;
  detailsLoading: boolean;
  detailsFailed: number;
  onRetry: () => void;
}) {
  const [tab, setTab] = useState<FilmTab>("overview");
  const idBase = "analytics-film";
  const now = new Date();

  const movieCount = watchLogs.filter((l) => l.media_type === "movie").length;
  const tvCount = watchLogs.filter((l) => l.media_type === "tv").length;
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

  // Rating distribution: every half-star from 0.5 to 5, highest first
  const allRatings = Array.from({ length: 10 }, (_, i) => (i + 1) * 0.5);
  const ratingBuckets: Record<string, number> = {};
  allRatings.forEach((r) => { ratingBuckets[String(r)] = 0; });
  ratedLogs.forEach((l) => {
    const key = String(Number(l.rating));
    if (key in ratingBuckets) ratingBuckets[key]++;
  });
  const ratingData: Tally[] = allRatings
    .map((r) => ({ name: String(r), count: ratingBuckets[String(r)] }))
    .reverse();
  const commonRating = ratingData.reduce((a, b) => (b.count > a.count ? b : a), ratingData[0]);

  // Monthly activity, stacked by films (a) and TV (b)
  const monthlyData = lastTwelveMonths(now);
  watchLogs.forEach((l) => {
    const ym = (l.watched_date || l.created_at).slice(0, 7);
    const bucket = monthlyData.find((m) => m.key === ym);
    if (bucket) {
      if (l.media_type === "movie") bucket.a++;
      else bucket.b++;
    }
  });

  const platformData = tally(watchLogs.map((l) => l.watched_on));
  const rewatchData = tally(watchLogs.map((l) => l.rewatchability));
  const discoveryData = tally(watchLogs.map((l) => l.discovered_via));

  // Category averages
  const categoryData: CategoryAverage[] = FILM_CATEGORIES.map(({ key, label, full }) => {
    const values = watchLogs.map((l) => l[key]).filter((v): v is number => v !== null && v > 0);
    const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    return { label, full, avg: Math.round(avg * 10) / 10, count: values.length };
  });
  const categoryLogCount = watchLogs.filter((l) =>
    FILM_CATEGORIES.some(({ key }) => (l[key] ?? 0) > 0),
  ).length;

  // Highest and lowest rated (earliest log wins a tie)
  const sortedByDate = [...ratedLogs].sort((a, b) =>
    (a.watched_date || a.created_at).localeCompare(b.watched_date || b.created_at),
  );
  const highestRated = sortedByDate.reduce<WatchLog | null>(
    (best, l) => (!best || Number(l.rating) > Number(best.rating) ? l : best),
    null,
  );
  const lowestRated = sortedByDate.reduce<WatchLog | null>(
    (worst, l) => (!worst || Number(l.rating) < Number(worst.rating) ? l : worst),
    null,
  );

  // Everything below depends on the film and TV details fetched per title
  const detailFor = (l: WatchLog) =>
    l.tmdb_id ? tmdbDetails.get(detailKey(l.media_type, l.tmdb_id)) : undefined;

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

  const topDirectors = tally(watchLogs.flatMap((l) => detailFor(l)?.directors ?? [])).slice(0, 5);
  const topActors = tally(watchLogs.flatMap((l) => detailFor(l)?.topCast ?? [])).slice(0, 5);

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

  const split = [
    { name: "Films", count: movieCount, color: CHART[0] },
    { name: "TV", count: tvCount, color: CHART[1] },
  ].filter((p) => p.count > 0);

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
          loading={detailsLoading}
        />
        <StatBlock
          label={`${totalSeasons === 1 ? "Season" : "Seasons"} of TV`}
          value={totalSeasons !== null ? totalSeasons : "—"}
          hint={
            totalEpisodes !== null
              ? `${totalEpisodes} ${plural(totalEpisodes, "episode", "episodes")}`
              : undefined
          }
          loading={detailsLoading}
        />
      </div>

      <TabBar
        className="mt-12"
        label="Analytics sections"
        idBase={idBase}
        value={tab}
        onChange={setTab}
        tabs={FILM_TABS}
      />

      {tab === "overview" && (
        <TabPanel key="overview" idBase={idBase} value="overview">
          <Section title="Ratings and activity" note="How you rate and when you watch.">
            <div className="grid gap-6 md:grid-cols-2">
              <ChartFigure
                title="Logged per month"
                summary={monthlySummary(monthlyData, "logged")}
              >
                <MonthlyBars data={monthlyData} nameA="Films" nameB="TV" />
              </ChartFigure>
              {ratedLogs.length > 0 ? (
                <ChartFigure
                  title="How you rate"
                  summary={`Your most common rating is ${commonRating.name} out of 5, given ${commonRating.count} of ${ratedLogs.length} times.`}
                >
                  <TallyBars data={ratingData} seriesName="Logs" labelWidth={32} />
                </ChartFigure>
              ) : (
                <Hint>Rate at least 1 watch to see how you rate.</Hint>
              )}
            </div>
          </Section>

          {highestRated && lowestRated && (
            <Section title="Highs and lows">
              <ul>
                <TitleRow
                  label="Highest rated"
                  title={highestRated.title}
                  image={highestRated.poster_url}
                  aspect="poster"
                  rating={Number(highestRated.rating)}
                  fallbackIcon={Film}
                />
                <TitleRow
                  label="Lowest rated"
                  title={lowestRated.title}
                  image={lowestRated.poster_url}
                  aspect="poster"
                  rating={Number(lowestRated.rating)}
                  fallbackIcon={Film}
                />
              </ul>
            </Section>
          )}
        </TabPanel>
      )}

      {tab === "taste" && (
        <TabPanel key="taste" idBase={idBase} value="taste">
          <Section
            title="Category ratings"
            note="When you log a watch you can also score its plot, acting and so on. These are your averages for each, out of 5."
          >
            {categoryLogCount >= MIN_POINTS ? (
              <CategoryProfile data={categoryData} />
            ) : (
              <Hint>
                Score the categories on {MIN_POINTS - categoryLogCount} more{" "}
                {plural(MIN_POINTS - categoryLogCount, "watch", "watches")} to see this.
              </Hint>
            )}
          </Section>

          <Section
            title="You and the crowd"
            note="Your rating next to the public average on TMDB, the film database this app uses. TMDB scores are out of 10, so your rating is doubled to compare."
          >
            {detailsFailed > 0 && <DetailsNotice failed={detailsFailed} onRetry={onRetry} className="mb-5" />}
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
        </TabPanel>
      )}

      {tab === "library" && (
        <TabPanel key="library" idBase={idBase} value="library">
          {detailsFailed > 0 && <DetailsNotice failed={detailsFailed} onRetry={onRetry} />}

          <Section title="Genres and decades" note="What you watch and when it was made.">
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
          </Section>

          <Section title="Length and age" note="How long your films run, and how old they were when you got to them.">
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
          </Section>

          <Section title="People" note="The directors and actors you keep coming back to.">
            {detailsLoading ? (
              <div className="grid gap-x-10 gap-y-8 md:grid-cols-2">
                <ListSkeleton label="Loading directors" />
                <ListSkeleton label="Loading actors" />
              </div>
            ) : topDirectors.length > 0 || topActors.length > 0 ? (
              <div className="grid items-start gap-x-10 gap-y-8 md:grid-cols-2">
                {topDirectors.length > 0 && (
                  <div className="min-w-0">
                    <SubHeading>Top directors</SubHeading>
                    <RankedList items={topDirectors} unit={(n) => plural(n, "title", "titles")} />
                  </div>
                )}
                {topActors.length > 0 && (
                  <div className="min-w-0">
                    <SubHeading>Top actors</SubHeading>
                    <RankedList items={topActors} unit={(n) => plural(n, "title", "titles")} />
                  </div>
                )}
              </div>
            ) : (
              <Hint>{needsDetails(1)}</Hint>
            )}
          </Section>
        </TabPanel>
      )}

      {tab === "habits" && (
        <TabPanel key="habits" idBase={idBase} value="habits">
          <Section title="What and where" note="The split between films and TV, and where you watch them.">
            <div className="grid items-start gap-x-10 gap-y-8 md:grid-cols-2">
              <div className="min-w-0">
                <SubHeading>Films and TV</SubHeading>
                <div
                  role="img"
                  aria-label={`${movieCount} ${plural(movieCount, "film", "films")} and ${tvCount} ${plural(tvCount, "TV show", "TV shows")} logged.`}
                  className="my-3 flex h-3 w-full border border-border"
                >
                  {split.map((p) => (
                    <div
                      key={p.name}
                      style={{ width: `${(p.count / watchLogs.length) * 100}%`, background: p.color }}
                    />
                  ))}
                </div>
                {split.map((p) => (
                  <LeaderRow
                    key={p.name}
                    label={
                      <>
                        <Swatch color={p.color} />
                        {p.name}
                      </>
                    }
                    value={`${p.count} (${Math.round((p.count / watchLogs.length) * 100)}%)`}
                  />
                ))}
              </div>
              {platformData.length > 0 ? (
                <ChartFigure title="Where you watch" summary={tallySummary(platformData, "Where you watch")}>
                  <TallyBars data={platformData} seriesName="Logs" />
                </ChartFigure>
              ) : (
                <Hint>Add where you watched to 1 more log to see this.</Hint>
              )}
            </div>
          </Section>

          <Section title="Finding and rewatching" note="How you come across things, and whether you would watch them again.">
            <div className="grid items-start gap-x-10 gap-y-8 md:grid-cols-2">
              {discoveryData.length > 0 ? (
                <ChartFigure title="How you find things" summary={tallySummary(discoveryData, "How you find things")}>
                  <TallyBars data={discoveryData} seriesName="Logs" />
                </ChartFigure>
              ) : (
                <Hint>Add how you found it to 1 more log to see this.</Hint>
              )}
              {rewatchData.length > 0 ? (
                <ChartFigure title="Would you rewatch" summary={tallySummary(rewatchData, "Would you rewatch")}>
                  <TallyBars data={rewatchData} seriesName="Logs" />
                </ChartFigure>
              ) : (
                <Hint>Add whether you would rewatch to 1 more log to see this.</Hint>
              )}
            </div>
          </Section>
        </TabPanel>
      )}
    </>
  );
}

// ─── Music mode ─────────────────────────────────────────────────

type MusicTab = "overview" | "taste" | "top";

const MUSIC_TABS: { value: MusicTab; label: string }[] = [
  { value: "overview", label: "Overview" },
  { value: "taste", label: "Taste" },
  { value: "top", label: "Top rated" },
];

const MUSIC_CATEGORIES = [
  { key: "lyrics_rating", label: "Lyrics", full: "Lyrics" },
  { key: "production_rating", label: "Production", full: "Production" },
  { key: "vocals_rating", label: "Vocals", full: "Vocals" },
  { key: "melody_rating", label: "Melody", full: "Melody" },
  { key: "replay_rating", label: "Replay", full: "Replay value" },
  { key: "energy_rating", label: "Energy", full: "Energy" },
] as const;

function MusicAnalytics({ listenLogs }: { listenLogs: ListenLog[] }) {
  const [tab, setTab] = useState<MusicTab>("overview");
  const idBase = "analytics-music";
  const now = new Date();

  const albumCount = listenLogs.filter((l) => l.media_type === "album").length;
  const trackCount = listenLogs.filter((l) => l.media_type === "track").length;
  const ratedLogs = listenLogs.filter(isRated);
  const avgRating =
    ratedLogs.length > 0
      ? (ratedLogs.reduce((acc, l) => acc + Number(l.rating), 0) / ratedLogs.length).toFixed(1)
      : "—";

  const topArtists = tally(listenLogs.map((l) => l.artist)).slice(0, 10);

  // Monthly activity, stacked by albums (a) and tracks (b)
  const monthlyData = lastTwelveMonths(now);
  listenLogs.forEach((l) => {
    const ym = (l.listened_date || l.created_at).slice(0, 7);
    const bucket = monthlyData.find((m) => m.key === ym);
    if (bucket) {
      if (l.media_type === "album") bucket.a++;
      else bucket.b++;
    }
  });

  const topAlbums = ratedLogs
    .filter((l) => l.media_type === "album")
    .sort((a, b) => Number(b.rating) - Number(a.rating))
    .slice(0, 5);
  const topTracks = ratedLogs
    .filter((l) => l.media_type === "track")
    .sort((a, b) => Number(b.rating) - Number(a.rating))
    .slice(0, 5);

  const contextData = tally(listenLogs.map((l) => l.listening_context));

  const categoryData: CategoryAverage[] = MUSIC_CATEGORIES.map(({ key, label, full }) => {
    const values = listenLogs.map((l) => l[key]).filter((v): v is number => v !== null && v > 0);
    const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    return { label, full, avg: Math.round(avg * 10) / 10, count: values.length };
  });
  const categoryLogCount = listenLogs.filter((l) =>
    MUSIC_CATEGORIES.some(({ key }) => (l[key] ?? 0) > 0),
  ).length;

  return (
    <>
      <div className="grid grid-cols-2 gap-x-8 gap-y-8 md:grid-cols-4">
        <StatBlock label="Logged" value={listenLogs.length} />
        <StatBlock label="Average rating" value={avgRating} hint="out of 5" />
        <StatBlock label="Albums" value={albumCount} />
        <StatBlock label="Tracks" value={trackCount} />
      </div>

      <TabBar
        className="mt-12"
        label="Analytics sections"
        idBase={idBase}
        value={tab}
        onChange={setTab}
        tabs={MUSIC_TABS}
      />

      {tab === "overview" && (
        <TabPanel key="overview" idBase={idBase} value="overview">
          <Section title="Listening activity" note="Albums and tracks logged per month.">
            <ChartFigure title="Logged per month" summary={monthlySummary(monthlyData, "logged")}>
              <MonthlyBars data={monthlyData} nameA="Albums" nameB="Tracks" />
            </ChartFigure>
          </Section>

          <Section title="Top artists" note="The artists you have logged the most.">
            {topArtists.length > 0 ? (
              <div className="max-w-xl">
                <RankedList items={topArtists} unit={(n) => plural(n, "log", "logs")} />
              </div>
            ) : (
              <Hint>Log 1 more album or track with an artist to see this.</Hint>
            )}
          </Section>
        </TabPanel>
      )}

      {tab === "taste" && (
        <TabPanel key="taste" idBase={idBase} value="taste">
          <Section
            title="Category ratings"
            note="When you log a listen you can also score its lyrics, production and so on. These are your averages for each, out of 5."
          >
            {categoryLogCount >= MIN_POINTS ? (
              <CategoryProfile data={categoryData} />
            ) : (
              <Hint>
                Score the categories on {MIN_POINTS - categoryLogCount} more{" "}
                {plural(MIN_POINTS - categoryLogCount, "listen", "listens")} to see this.
              </Hint>
            )}
          </Section>

          <Section title="Where you listen" note="The settings you note down when you log a listen.">
            {contextData.length > 0 ? (
              <ChartFigure title="Listens by setting" summary={tallySummary(contextData, "Listens by setting")}>
                <TallyBars data={contextData} seriesName="Listens" />
              </ChartFigure>
            ) : (
              <Hint>Add where you listened to 1 more log to see this.</Hint>
            )}
          </Section>
        </TabPanel>
      )}

      {tab === "top" && (
        <TabPanel key="top" idBase={idBase} value="top">
          <Section title="Highest rated" note="Your top albums and tracks.">
            <div className="grid items-start gap-x-10 gap-y-8 md:grid-cols-2">
              <div className="min-w-0">
                <SubHeading>Top albums</SubHeading>
                {topAlbums.length > 0 ? (
                  <ol>
                    {topAlbums.map((item) => (
                      <TitleRow
                        key={item.id}
                        title={item.title}
                        meta={item.artist}
                        image={item.image_url}
                        aspect="square"
                        rating={Number(item.rating)}
                        fallbackIcon={Disc3}
                      />
                    ))}
                  </ol>
                ) : (
                  <Hint>Log 1 album to see this.</Hint>
                )}
              </div>
              <div className="min-w-0">
                <SubHeading>Top tracks</SubHeading>
                {topTracks.length > 0 ? (
                  <ol>
                    {topTracks.map((item) => (
                      <TitleRow
                        key={item.id}
                        title={item.title}
                        meta={item.artist}
                        image={item.image_url}
                        aspect="square"
                        rating={Number(item.rating)}
                        fallbackIcon={Music2}
                      />
                    ))}
                  </ol>
                ) : (
                  <Hint>Log 1 track to see this.</Hint>
                )}
              </div>
            </div>
          </Section>
        </TabPanel>
      )}
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
  const [detailsLoading, setDetailsLoading] = useState(true);
  const [detailsFailed, setDetailsFailed] = useState(0);
  const [totalRuntime, setTotalRuntime] = useState<number | null>(null);
  const [totalSeasons, setTotalSeasons] = useState<number | null>(null);
  const [totalEpisodes, setTotalEpisodes] = useState<number | null>(null);
  const [tmdbDetails, setTmdbDetails] = useState<Map<string, TmdbDetail>>(new Map());
  const [attempt, setAttempt] = useState(0);

  // Only the current mode's data is fetched. The effect re-runs on a mode change
  // (or a retry); `cancelled` stops the previous run from writing into the new one.
  useEffect(() => {
    let cancelled = false;

    async function fetchFilm(userId: string) {
      const supabase = createClient();
      const result = await supabase
        .from("watch_logs")
        .select("rating, media_type, watched_date, created_at, tmdb_id, title, plot_rating, cinematography_rating, acting_rating, soundtrack_rating, pacing_rating, casting_rating, watched_on, discovered_via, rewatchability, times_watched, poster_url, review")
        .eq("user_id", userId)
        .in("media_type", ["movie", "tv"])
        .order("watched_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (cancelled) return;
      if (result.error) {
        setLoadError(true);
        setLoading(false);
        setDetailsLoading(false);
        return;
      }
      const logs = (result.data as WatchLog[] | null) || [];
      setWatchLogs(logs);
      setLoading(false);

      // Fetch film and TV details for runtime, seasons, genres, people and public scores
      try {
        const uniqueIds = new Map<string, { id: number; type: "movie" | "tv" }>();
        logs.forEach((l) => {
          if (!l.tmdb_id) return;
          const key = detailKey(l.media_type, l.tmdb_id);
          if (!uniqueIds.has(key)) uniqueIds.set(key, { id: l.tmdb_id, type: l.media_type });
        });
        if (uniqueIds.size === 0) return;

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
                  key,
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

        let rtSum = 0;
        let sSum = 0;
        let eSum = 0;
        logs.forEach((l) => {
          if (!l.tmdb_id) return;
          const d = details.get(detailKey(l.media_type, l.tmdb_id));
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
      } finally {
        if (!cancelled) setDetailsLoading(false);
      }
    }

    async function fetchMusic(userId: string) {
      const supabase = createClient();
      const result = await supabase
        .from("listen_logs")
        .select("id, media_type, title, artist, album_name, image_url, rating, review, listened_date, created_at, lyrics_rating, production_rating, vocals_rating, melody_rating, replay_rating, energy_rating, listened_on, listening_context")
        .eq("user_id", userId)
        .in("media_type", ["album", "track"])
        .order("listened_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (cancelled) return;
      if (result.error) {
        setLoadError(true);
      } else {
        setListenLogs((result.data as ListenLog[] | null) || []);
      }
      setLoading(false);
    }

    async function run() {
      setLoading(true);
      setLoadError(false);
      setWatchLogs([]);
      setListenLogs([]);
      setTmdbDetails(new Map());
      setDetailsLoading(!isMusic);
      setDetailsFailed(0);
      setTotalRuntime(null);
      setTotalSeasons(null);
      setTotalEpisodes(null);
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        if (cancelled) return;
        const user = data.user;
        if (!user) {
          setLoadError(true);
          setLoading(false);
          setDetailsLoading(false);
          return;
        }
        if (isMusic) await fetchMusic(user.id);
        else await fetchFilm(user.id);
      } catch {
        if (cancelled) return;
        setLoadError(true);
        setLoading(false);
        setDetailsLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [isMusic, attempt]);

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

  if (loading) {
    return (
      <div>
        {header}
        <div className="grid grid-cols-2 gap-x-8 gap-y-8 md:grid-cols-4">
          <StatBlock label={isMusic ? "Logged" : "Watched"} value="" loading />
          <StatBlock label="Average rating" value="" loading />
          <StatBlock label={isMusic ? "Albums" : "Film watch time"} value="" loading />
          <StatBlock label={isMusic ? "Tracks" : "Seasons of TV"} value="" loading />
        </div>
        <div className="mt-16 grid gap-6 md:grid-cols-2">
          <ChartSkeleton label="Loading your analytics" className="h-[300px]" />
          <ChartSkeleton label="Loading your analytics" className="h-[300px]" />
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div>
        {header}
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
      </div>
    );
  }

  const isEmpty = isMusic ? listenLogs.length === 0 : watchLogs.length === 0;

  if (isEmpty) {
    return (
      <div>
        {header}
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
      </div>
    );
  }

  return (
    <div>
      {header}
      {isMusic ? (
        <MusicAnalytics key="music" listenLogs={listenLogs} />
      ) : (
        <FilmAnalytics
          key="film"
          watchLogs={watchLogs}
          tmdbDetails={tmdbDetails}
          totalRuntime={totalRuntime}
          totalSeasons={totalSeasons}
          totalEpisodes={totalEpisodes}
          detailsLoading={detailsLoading}
          detailsFailed={detailsFailed}
          onRetry={retry}
        />
      )}
    </div>
  );
}
