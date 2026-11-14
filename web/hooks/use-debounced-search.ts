"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The superseding rule: each call to the returned function starts a new
 * search and hands back a check that is true only while no later search has
 * started. Responses whose check is false are discarded.
 */
export function latestOnly() {
  let latest = 0;
  return function begin(): () => boolean {
    const id = ++latest;
    return () => id === latest;
  };
}

/**
 * Debounced search. The caller owns fetching and mapping; the hook owns the
 * query, the delay, the loading flag and discarding superseded responses.
 * `deps` re-run the search for the current query (for example a mode switch).
 */
export function useDebouncedSearch<T>(
  search: (q: string) => Promise<T[]>,
  deps: unknown[] = [],
  delayMs = 350,
) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const searchRef = useRef(search);
  searchRef.current = search;
  const beginRef = useRef<ReturnType<typeof latestOnly> | null>(null);
  if (!beginRef.current) beginRef.current = latestOnly();

  const trimmed = query.trim();

  useEffect(() => {
    const begin = beginRef.current!;
    const isCurrent = begin();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    const t = setTimeout(async () => {
      try {
        setLoading(true);
        const data = await searchRef.current(trimmed);
        if (!isCurrent()) return;
        setResults(data);
        setError(null);
      } catch (err) {
        if (isCurrent()) setError(err);
      } finally {
        if (isCurrent()) setLoading(false);
      }
    }, delayMs);

    return () => {
      clearTimeout(t);
      begin();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmed, delayMs, ...deps]);

  return { query, setQuery, results, loading, error };
}
