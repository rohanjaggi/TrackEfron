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
import { averageRating } from "@/lib/media";
import { StatBlock } from "@/components/ui/page";
import { AXIS_LABEL, AXIS_PROPS, BAR_CURSOR, CHART, GRID_STROKE, TOOLTIP_PROPS } from "./chart-chrome";
import {
  ChartFigure,
  ChartSkeleton,
  CrowdPick,
  DetailsNotice,
  Hint,
  ListSkeleton,
  RankedList,
  Section,
  SubHeading,
  TallyBars,
} from "./blocks";
import {
  MIN_POINTS,
  detailKey,
  formatDate,
  formatMonthYear,
  formatRuntime,
  isRated,
  needsDetails,
  plural,
  tally,
  tallySummary,
} from "./helpers";
import type { ControversialPick, Tally, TmdbDetail, WatchLog } from "./types";

export function FilmAnalytics({
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
  const movieCount = watchLogs.filter((l) => l.media_type === "movie").length;
  // Unrated entries still count as logged, but never as a rating of zero
  const avgRating = averageRating(watchLogs.map((l) => l.rating));

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
  const yearNow = new Date().getFullYear();
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
