import type { FilmRecommendation, RawFilmPick, RecsResponse } from "@/lib/ai/types";
import { buildFilmRecommendUserPrompt, FILM_RECOMMEND_SYSTEM } from "@/lib/ai/prompts";
import type { gatherFilmCandidates } from "./candidates";
import { eraLimits } from "./era";
import { matchFilmPicks, type Lookup } from "./match";
import { formatWatchLogs, selectWatchLogs, type WatchLogRow } from "./select-logs";

const MIN_RATED_LOGS = 5;
const KEEP = 20;

export async function buildFilmRecs(deps: {
  logs: WatchLogRow[];
  watchlist: { tmdb_id: number; media_type: string }[];
  tasteDNA: {
    fingerprint?: string;
    film_profile?: { core?: string; aspect_lens?: string } | null;
    blind_spots?: string[] | null;
  } | null;
  yearsOf: (logs: WatchLogRow[]) => Promise<number[]>;
  gather: typeof gatherFilmCandidates;
  lookup: Lookup;
  ai: (system: string, user: string) => Promise<{ picks: RawFilmPick[] }>;
}): Promise<RecsResponse<FilmRecommendation>> {
  const { logs, watchlist, tasteDNA } = deps;
  if (logs.filter((l) => l.rating != null).length < MIN_RATED_LOGS) {
    return { status: "not_enough_logs", items: [] };
  }

  const exclude = new Set<string>([
    ...logs.map((l) => `${l.media_type}:${l.tmdb_id}`),
    ...watchlist.map((w) => `${w.media_type}:${w.tmdb_id}`),
  ]);

  const [years, candidates] = await Promise.all([deps.yearsOf(logs), deps.gather(logs, exclude)]);
  const era = eraLimits(years);

  const user = buildFilmRecommendUserPrompt({
    tasteDNA,
    era,
    logsText: formatWatchLogs(selectWatchLogs(logs)),
    seenTitles: logs.map((l) => l.title),
    candidates,
  });
  const { picks } = await deps.ai(FILM_RECOMMEND_SYSTEM, user);

  const items = await matchFilmPicks(picks, candidates, exclude, deps.lookup, {
    max: KEEP,
    maxOlder: era.maxOlder,
    olderBefore: era.olderBefore,
  });
  return items.length ? { status: "ok", items } : { status: "empty", items: [] };
}
