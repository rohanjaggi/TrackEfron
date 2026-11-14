import type { RightNow, SpotifyTops } from "@/lib/ai/types";

const MAX_PER_LIST = 6;

function strip({ id, name, image_url }: { id: string; name: string; image_url: string | null }) {
  return { id, name, image_url };
}

export function computeRightNow(tops: SpotifyTops): RightNow {
  const { short_term, medium_term, long_term } = tops.artists;
  const longIds = new Set(long_term.map((a) => a.id));
  const recentIds = new Set([...short_term, ...medium_term].map((a) => a.id));

  return {
    rising: short_term.filter((a) => !longIds.has(a.id)).slice(0, MAX_PER_LIST).map(strip),
    dropped_off: long_term.filter((a) => !recentIds.has(a.id)).slice(0, MAX_PER_LIST).map(strip),
  };
}
