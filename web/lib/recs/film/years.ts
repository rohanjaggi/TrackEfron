import type { WatchLogRow } from "./select-logs";
import { selectWatchLogs } from "./select-logs";

const MAX_TITLES = 60;
const BATCH = 10;

type Details = (type: "movie" | "tv", id: number) => Promise<{ release_date?: string; first_air_date?: string }>;

/**
 * Release years for the user's logs, from TMDB details. Covers at most
 * MAX_TITLES titles (the logs the prompt will show first), in batches, and
 * skips any title whose lookup fails.
 */
export async function fetchLogYears(logs: WatchLogRow[], details: Details): Promise<number[]> {
  const chosen = selectWatchLogs(logs);
  const chosenKeys = new Set(chosen.map((l) => `${l.media_type}:${l.tmdb_id}`));
  const rest = logs.filter((l) => !chosenKeys.has(`${l.media_type}:${l.tmdb_id}`));
  const targets = [...chosen, ...rest].slice(0, MAX_TITLES);

  const years: number[] = [];
  for (let i = 0; i < targets.length; i += BATCH) {
    const settled = await Promise.allSettled(
      targets.slice(i, i + BATCH).map((l) => details(l.media_type, l.tmdb_id)),
    );
    for (const r of settled) {
      if (r.status !== "fulfilled") continue;
      const date = r.value.release_date || r.value.first_air_date;
      const y = date ? parseInt(date.slice(0, 4), 10) : NaN;
      if (!Number.isNaN(y)) years.push(y);
    }
  }
  return years;
}
