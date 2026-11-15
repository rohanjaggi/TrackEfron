"use client";

import { useCallback, useEffect, useState } from "react";
import { detailKey } from "@/components/analytics/helpers";
import type { WatchLog } from "@/components/analytics/types";
import { fetchTitleDetail, type TmdbDetail } from "@/lib/tmdb/client";

/**
 * Film and TV details (runtime, seasons, genres, release year, public score) for every
 * titled log, fetched in batches of 10 once the logs are in. `reset` clears them when the
 * logs are reloaded; `setLoading` lets the logs loader flag the fetch before it starts.
 */
export function useTitleDetails(watchLogs: WatchLog[], isMusic: boolean) {
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsFailed, setDetailsFailed] = useState(0);
  const [tmdbDetails, setTmdbDetails] = useState<Map<string, TmdbDetail>>(new Map());
  const [detailsAttempt, setDetailsAttempt] = useState(0);

  useEffect(() => {
    if (isMusic) return;
    let cancelled = false;

    async function fetchDetails() {
      const uniqueIds = new Map<string, { id: number; type: "movie" | "tv" }>();
      watchLogs.forEach((l) => {
        if (!l.tmdb_id) return;
        const key = detailKey(l.media_type, l.tmdb_id);
        if (!uniqueIds.has(key)) uniqueIds.set(key, { id: l.tmdb_id, type: l.media_type });
      });
      if (uniqueIds.size === 0) return;

      setDetailsLoading(true);
      setDetailsFailed(0);
      try {
        const entries = Array.from(uniqueIds.entries());
        // Fetch in batches of 10
        const details = new Map<string, TmdbDetail>();
        let failed = 0;
        for (let i = 0; i < entries.length; i += 10) {
          const batch = entries.slice(i, i + 10);
          const results = await Promise.all(
            batch.map(async ([key, { id, type }]) => ({ key, detail: await fetchTitleDetail(type, id) })),
          );
          if (cancelled) return;
          results.forEach(({ key, detail }) => {
            if (detail) details.set(key, detail);
            else failed++;
          });
        }
        if (cancelled) return;
        setTmdbDetails(details);
        setDetailsFailed(failed);
      } finally {
        if (!cancelled) setDetailsLoading(false);
      }
    }

    fetchDetails();
    return () => {
      cancelled = true;
    };
  }, [isMusic, watchLogs, detailsAttempt]);

  const reset = useCallback(() => {
    setTmdbDetails(new Map());
    setDetailsLoading(false);
    setDetailsFailed(0);
  }, []);
  const retryDetails = () => setDetailsAttempt((n) => n + 1);

  return { tmdbDetails, detailsLoading, detailsFailed, setDetailsLoading, reset, retryDetails };
}
