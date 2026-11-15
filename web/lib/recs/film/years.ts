import type { WatchLogRow } from "./select-logs";
import { selectWatchLogs } from "./select-logs";
import { mapBounded } from "../map-bounded";

const MAX_TITLES = 60;
const CONCURRENCY = 10;

type Details = (type: "movie" | "tv", id: number) => Promise<{ release_date?: string; first_air_date?: string }>;

/**
 * Release years for the user's logs, from TMDB details. Covers at most
 * MAX_TITLES titles (the logs the prompt will show first), with bounded concurrency, and
 * skips any title whose lookup fails.
 */
export async function fetchLogYears(logs: WatchLogRow[], details: Details): Promise<number[]> {
  const chosen = selectWatchLogs(logs);
  const chosenKeys = new Set(chosen.map((l) => `${l.media_type}:${l.tmdb_id}`));
  const rest = logs.filter((l) => !chosenKeys.has(`${l.media_type}:${l.tmdb_id}`));
  const targets = [...chosen, ...rest].slice(0, MAX_TITLES);

  const dates = await mapBounded(targets, CONCURRENCY, async (l) => {
    try {
      const d = await details(l.media_type, l.tmdb_id);
      return d.release_date || d.first_air_date;
    } catch {
      return undefined;
    }
  });
  const years: number[] = [];
  for (const date of dates) {
    const y = date ? parseInt(date.slice(0, 4), 10) : NaN;
    if (!Number.isNaN(y)) years.push(y);
  }
  return years;
}
