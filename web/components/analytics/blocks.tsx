import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Film } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/loading";
import { LeaderRow, Notice, SectionHeader } from "@/components/ui/page";
import { AXIS_PROPS, BAR_CURSOR, CHART, GRID_STROKE, TOOLTIP_PROPS } from "./chart-chrome";
import { plural, truncate } from "./helpers";
import type { ControversialPick, Tally } from "./types";

export function Section({
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
export function ChartFigure({
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

export function ChartSkeleton({ label, className = "h-[260px]" }: { label: string; className?: string }) {
  return (
    <div role="status" aria-label={label} className="min-w-0">
      <Skeleton className={`w-full ${className}`} />
    </div>
  );
}

export function ListSkeleton({ label, rows = 5 }: { label: string; rows?: number }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-3 py-1.5">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-3 w-full" />
      ))}
    </div>
  );
}

export function Hint({ children }: { children: React.ReactNode }) {
  return <p className="t-meta">{children}</p>;
}

export function SubHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="t-label hairline mb-2 pb-2">{children}</h3>;
}

export function RankedList({ items, unit }: { items: Tally[]; unit: (n: number) => string }) {
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
export function TallyBars({
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

export function CrowdPick({ pick, kind }: { pick: ControversialPick; kind: "gem" | "unpopular" }) {
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

export function DetailsNotice({
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
