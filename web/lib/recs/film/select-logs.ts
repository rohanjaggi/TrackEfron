export type WatchLogRow = {
  tmdb_id: number;
  title: string;
  media_type: "movie" | "tv";
  rating: number | null;
  review: string | null;
  plot_rating: number | null;
  cinematography_rating: number | null;
  acting_rating: number | null;
  soundtrack_rating: number | null;
  pacing_rating: number | null;
  casting_rating: number | null;
  watched_date: string;
};

const FULL_LIST_LIMIT = 80;
const EXTREMES = 15;
const RECENT = 50;
const REVIEW_CHARS = 300;

const key = (l: WatchLogRow) => `${l.media_type}:${l.tmdb_id}`;

export function selectWatchLogs(logs: WatchLogRow[]): WatchLogRow[] {
  if (logs.length <= FULL_LIST_LIMIT) return logs;

  const rated = logs.filter((l) => l.rating != null);
  const byRating = [...rated].sort((a, b) => (b.rating as number) - (a.rating as number));
  const recent = [...logs]
    .sort((a, b) => b.watched_date.localeCompare(a.watched_date))
    .slice(0, RECENT);

  const chosen = new Map<string, WatchLogRow>();
  const groups = [
    logs.filter((l) => l.review && l.review.trim()),
    byRating.slice(0, EXTREMES),
    byRating.slice(-EXTREMES),
    recent,
  ];
  for (const group of groups) {
    for (const l of group) if (!chosen.has(key(l))) chosen.set(key(l), l);
  }
  return [...chosen.values()];
}

export function formatWatchLogs(logs: WatchLogRow[]): string {
  return logs
    .map((l) => {
      const parts = [`${l.title} (${l.media_type})`];
      if (l.rating != null) parts.push(`rating ${l.rating}/10`);
      const aspects: [string, number | null][] = [
        ["plot", l.plot_rating],
        ["cinematography", l.cinematography_rating],
        ["acting", l.acting_rating],
        ["soundtrack", l.soundtrack_rating],
        ["pacing", l.pacing_rating],
        ["casting", l.casting_rating],
      ];
      const aspectText = aspects
        .filter(([, v]) => v != null)
        .map(([name, v]) => `${name} ${v}`)
        .join(", ");
      if (aspectText) parts.push(aspectText);
      parts.push(`watched ${l.watched_date}`);
      let line = `- ${parts.join("; ")}`;
      if (l.review && l.review.trim()) line += `\n  Review: ${l.review.slice(0, REVIEW_CHARS)}`;
      return line;
    })
    .join("\n");
}
