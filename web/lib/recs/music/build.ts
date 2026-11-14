import type { MusicRecommendation, MusicRecsResponse, SpotifyTops } from "@/lib/ai/types";
import { buildMusicRecommendUserPrompt, MUSIC_RECOMMEND_SYSTEM } from "@/lib/ai/prompts";
import type { searchSpotify } from "@/lib/spotify/spotify";
import { matchMusicPicks } from "./match";
import { computeRightNow } from "./right-now";

const MIN_RATED_LOGS = 5;
const KEEP = 20;

export interface ListenLogRow {
  spotify_id: string | null;
  title: string;
  artist: string | null;
  media_type: string;
  rating: number | null;
  review: string | null;
  lyrics_rating: number | null;
  production_rating: number | null;
  vocals_rating: number | null;
  melody_rating: number | null;
  replay_rating: number | null;
  energy_rating: number | null;
}

export async function buildMusicRecs(deps: {
  logs: ListenLogRow[];
  queue: { spotify_id: string | null; title: string; artist: string | null }[];
  tops: SpotifyTops | null;
  tasteDNA: {
    fingerprint?: string;
    music_profile?: { core?: string; aspect_lens?: string } | null;
  } | null;
  search: typeof searchSpotify;
  ai: (system: string, user: string) => Promise<{ recommendations: MusicRecommendation[] }>;
}): Promise<MusicRecsResponse> {
  const { logs, queue, tops, tasteDNA } = deps;
  const rightNow = tops ? computeRightNow(tops) : null;

  if (!tops && logs.filter((l) => l.rating != null).length < MIN_RATED_LOGS) {
    return { status: "not_enough_logs", items: [], right_now: null };
  }

  const exclude = new Set<string>();
  for (const row of [...logs, ...queue]) {
    if (row.spotify_id) exclude.add(row.spotify_id);
  }

  const user = buildMusicRecommendUserPrompt({ tasteDNA, listenLogs: logs, musicQueue: queue, tops });
  const { recommendations } = await deps.ai(MUSIC_RECOMMEND_SYSTEM, user);

  const items = await matchMusicPicks(recommendations, exclude, deps.search, KEEP);
  return items.length
    ? { status: "ok", items, right_now: rightNow }
    : { status: "empty", items: [], right_now: rightNow };
}
