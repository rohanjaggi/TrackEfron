import type { MusicRecommendation, MusicRecsResponse, SpotifyTops } from "@/lib/ai/types";
import { buildMusicRecommendUserPrompt, MUSIC_RECOMMEND_SYSTEM } from "@/lib/ai/prompts";
import { groupRecentPlays, type RawPlay } from "@/lib/spotify/recent";
import type { searchSpotify } from "@/lib/spotify/spotify";
import { matchMusicPicks } from "./match";
import { computeRightNow } from "./right-now";

const MIN_RATED_LOGS = 5;
const KEEP = 20;
const RECENT_PROMPT_MAX = 30;

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
  recent: RawPlay[] | null;
  tasteDNA: {
    fingerprint?: string;
    music_profile?: { core?: string; aspect_lens?: string } | null;
  } | null;
  search: typeof searchSpotify;
  ai: (system: string, user: string) => Promise<{ recommendations: MusicRecommendation[] }>;
}): Promise<MusicRecsResponse> {
  const { logs, queue, tops, recent, tasteDNA } = deps;
  const rightNow = tops ? computeRightNow(tops) : null;

  if (!tops && logs.filter((l) => l.rating != null).length < MIN_RATED_LOGS) {
    return { status: "not_enough_logs", items: [], right_now: null };
  }

  const exclude = new Set<string>();
  for (const row of [...logs, ...queue]) {
    if (row.spotify_id) exclude.add(row.spotify_id);
  }

  if (tops) {
    for (const list of Object.values(tops.tracks)) for (const t of list) exclude.add(t.id);
  }
  const recentTracks: { name: string; artist: string }[] = [];
  if (recent) {
    for (const p of recent) if (p.track?.id) exclude.add(p.track.id);
    // Albums folded from 3+ recent tracks are excluded by album id too.
    for (const c of groupRecentPlays(recent, new Set(), Infinity)) if (c.type === "album") exclude.add(c.id);
    const seen = new Set<string>();
    const newestFirst = [...recent].sort((a, b) => Date.parse(b.played_at) - Date.parse(a.played_at));
    for (const p of newestFirst) {
      if (!p.track?.id || seen.has(p.track.id)) continue;
      seen.add(p.track.id);
      recentTracks.push({ name: p.track.name, artist: (p.track.artists ?? []).map((a) => a.name).join(", ") });
      if (recentTracks.length >= RECENT_PROMPT_MAX) break;
    }
  }

  const user = buildMusicRecommendUserPrompt({ tasteDNA, listenLogs: logs, musicQueue: queue, tops, recent: recentTracks });
  const { recommendations } = await deps.ai(MUSIC_RECOMMEND_SYSTEM, user);

  const items = await matchMusicPicks(recommendations, exclude, deps.search, KEEP);
  return items.length
    ? { status: "ok", items, right_now: rightNow }
    : { status: "empty", items: [], right_now: rightNow };
}
