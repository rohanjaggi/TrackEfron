"use client";

import { useEffect, useState } from "react";

import { Avatar } from "@/components/ui/page";
import { playedLabel, type RecentCandidate } from "@/lib/spotify/recent";

function metaLine(c: RecentCandidate, now: Date): string {
  const when = playedLabel(c.last_played_at, now);
  return c.type === "album"
    ? `album · ${c.plays} tracks · ${when}`
    : `track · ${c.plays} ${c.plays === 1 ? "play" : "plays"} · ${when}`;
}

/** Albums and tracks the user played lately on Spotify; picking one prefills the log form. Nothing when unavailable. */
export function RecentPlays({ onPick }: { onPick: (c: RecentCandidate) => void }) {
  const [items, setItems] = useState<RecentCandidate[] | null>(null);
  const [now] = useState(() => new Date());

  useEffect(() => {
    let cancelled = false;
    fetch("/api/spotify/me?action=recently-played")
      .then((res) => res.json() as Promise<unknown>)
      .then((data) => {
        if (!cancelled && Array.isArray(data)) setItems(data as RecentCandidate[]);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!items || items.length === 0) return null;
  return (
    <div className="min-w-0">
      <h3 className="t-label mb-2">Recently played on Spotify</h3>
      <ul>
        {items.map((c) => (
          <li key={`${c.type}:${c.id}`} className="row-item">
            <button
              type="button"
              onClick={() => onPick(c)}
              className="flex w-full items-center gap-3 px-2 py-2.5 text-left"
            >
              <Avatar src={c.image_url} name={c.name} size={36} />
              <span className="min-w-0 flex-1">
                <span className="t-card block truncate">
                  {c.name} · {c.artist}
                </span>
                <span className="t-meta block truncate">{metaLine(c, now)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
