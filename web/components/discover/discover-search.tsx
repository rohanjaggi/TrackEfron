"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Film, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingLine, MediaGridSkeleton } from "@/components/ui/loading";
import { MediaCard, MediaGrid } from "@/components/ui/media-card";
import { EmptyState, Field, Notice, SectionHeader } from "@/components/ui/page";
import type { VibeSearchResponse } from "@/lib/ai/types";
import type { AppMode } from "@/lib/mode-context";
import { spotifySearchUrl, tmdbSearchUrl } from "@/lib/search-client";
import type { SpotifySearchResult } from "@/lib/spotify/spotify";
import { ClearButton } from "./controls";
import { MusicCard } from "./music";
import { filmMeta, mediaHref, PROFILE_HREF, type MediaItem, type TitleSearch, type VibeSearch } from "./types";

const SEARCH_RESULT_LIMIT = 10;

const NO_TITLE_SEARCH: TitleSearch = { key: "", failed: false, films: [], music: [] };

function titleSearchKey(mode: string, run: number, q: string) {
  return `${mode}:${run}:${q}`;
}

/**
 * Search (shared across modes). `searchQuery` is what is typed; `activeQuery` is the title search it
 * settles into. A search by description (`vibe`) runs only on Enter and is shown instead while it exists.
 * Always mounted, so its state lives as long as the page; a mode switch clears it.
 */
export function DiscoverSearch({
  mode,
  aiNotConfigured,
  onNoKey,
  queuedIds,
  onQueue,
}: {
  mode: AppMode;
  aiNotConfigured: boolean;
  /** The server said there is no AI key. */
  onNoKey: () => void;
  queuedIds: Set<string>;
  /** Resolves true once the item is in the queue (a duplicate counts). */
  onQueue: (item: SpotifySearchResult) => Promise<boolean>;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [searchRun, setSearchRun] = useState(0);
  const [titleSearch, setTitleSearch] = useState<TitleSearch>(NO_TITLE_SEARCH);
  const [vibe, setVibe] = useState<VibeSearch | null>(null);
  const [searchNeedsKey, setSearchNeedsKey] = useState(false);

  // Ignore a slow answer once a newer search (or a mode switch) has replaced it.
  const vibeRequest = useRef(0);

  // When the mode changes, drop the old mode's search in the same render so nothing stale paints.
  const [prevMode, setPrevMode] = useState(mode);
  if (prevMode !== mode) {
    setPrevMode(mode);
    setSearchQuery("");
    setActiveQuery("");
    setVibe(null);
    setSearchNeedsKey(false);
  }
  // A late answer for a search made in the old mode must not land in the new one.
  const lastMode = useRef(mode);
  useEffect(() => {
    if (lastMode.current === mode) return;
    lastMode.current = mode;
    vibeRequest.current++;
  }, [mode]);

  // ─── Title search: typing settles into `activeQuery` after a pause ───
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) return;
    const t = setTimeout(() => setActiveQuery(q), 350);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // ─── Title search: run whenever the settled query, the mode, or a retry changes ───
  useEffect(() => {
    const q = activeQuery;
    if (!q) return;
    const key = titleSearchKey(mode, searchRun, q);
    const failed: TitleSearch = { key, failed: true, films: [], music: [] };
    let cancelled = false;

    async function run(): Promise<TitleSearch> {
      try {
        if (mode === "music") {
          const res = await fetch(spotifySearchUrl(q, "album,track"));
          const data: unknown = await res.json();
          return Array.isArray(data) ? { key, failed: false, films: [], music: data as SpotifySearchResult[] } : failed;
        }
        const res = await fetch(tmdbSearchUrl(q));
        const data: unknown = await res.json();
        return Array.isArray(data) ? { key, failed: false, films: data as MediaItem[], music: [] } : failed;
      } catch {
        return failed;
      }
    }

    run().then((result) => {
      if (!cancelled) setTitleSearch(result);
    });
    return () => {
      cancelled = true;
    };
  }, [activeQuery, mode, searchRun]);

  // ─── Handlers ───

  function handleSearchChange(value: string) {
    setSearchQuery(value);
    // Typing goes back to the title search and drops any search by description still out.
    vibeRequest.current++;
    setVibe(null);
    setSearchNeedsKey(false);
    if (!value.trim()) setActiveQuery("");
  }

  /** Search by description. Run on Enter only, never while typing. */
  async function runVibeSearch(q: string) {
    const request = ++vibeRequest.current;
    setSearchNeedsKey(false);
    if (aiNotConfigured) {
      // No AI key: search the words as a title and note that describing a mood needs a key.
      setVibe(null);
      setActiveQuery(q);
      setSearchNeedsKey(true);
      return;
    }
    setVibe({ query: q, loading: true, failed: false, interpretation: "", results: [] });
    const failed: VibeSearch = { query: q, loading: false, failed: true, interpretation: "", results: [] };
    try {
      const res = await fetch("/api/ai/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, mode: mode === "music" ? "music" : "film" }),
      });
      const data = (await res.json().catch(() => null)) as (Partial<VibeSearchResponse> & { code?: string }) | null;
      if (request !== vibeRequest.current) return;
      if (res.status === 402 || data?.code === "NO_API_KEY") {
        onNoKey();
        setVibe(null);
        setActiveQuery(q);
        setSearchNeedsKey(true);
      } else if (res.ok && Array.isArray(data?.results)) {
        setVibe({
          query: q,
          loading: false,
          failed: false,
          interpretation: data.interpretation || "",
          results: data.results,
        });
      } else {
        setVibe(failed);
      }
    } catch {
      if (request === vibeRequest.current) setVibe(failed);
    }
  }

  function handleSearchSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    runVibeSearch(q);
  }

  function clearSearch() {
    vibeRequest.current++;
    setSearchQuery("");
    setActiveQuery("");
    setVibe(null);
    setSearchNeedsKey(false);
  }

  function retrySearch() {
    if (vibe) runVibeSearch(vibe.query);
    else setSearchRun((n) => n + 1);
  }

  /** Queueing a result found by description is picking it, so the search by description is done. */
  async function handleQueueVibeResult(item: SpotifySearchResult) {
    if (await onQueue(item)) clearSearch();
  }

  // ─── Derived ───

  const isMusic = mode === "music";

  const currentSearchKey = activeQuery ? titleSearchKey(mode, searchRun, activeQuery) : "";
  const titleSearchDone = currentSearchKey !== "" && titleSearch.key === currentSearchKey;
  const searchResults = titleSearchDone ? titleSearch.films : [];
  const musicSearchResults = titleSearchDone ? titleSearch.music : [];

  const isVibeQuery = vibe !== null;
  const shownQuery = vibe ? vibe.query : activeQuery;
  const searchLoading = vibe ? vibe.loading : activeQuery !== "" && !titleSearchDone;
  const searchError = vibe ? vibe.failed : titleSearchDone && titleSearch.failed;

  const vibeResults = vibe?.results ?? [];
  const filmVibeResults = vibeResults.filter((r) => r.tmdb_id != null);
  const musicVibeResults = vibeResults.filter((r) => r.spotify_id);
  const searchCount = isVibeQuery
    ? (isMusic ? musicVibeResults : filmVibeResults).length
    : Math.min((isMusic ? musicSearchResults : searchResults).length, SEARCH_RESULT_LIMIT);

  return (
        <section>
          <form role="search" onSubmit={handleSearchSubmit} className="max-w-xl">
            <Field
              label={isMusic ? "Search albums and tracks" : "Search films and TV"}
              htmlFor="discover-search"
              hint={
                isMusic
                  ? "Albums and tracks appear as you type. Or describe a mood, like “something calm for late at night”, and press Enter."
                  : "Films and shows appear as you type. Or describe a mood, like “something tense and slow”, and press Enter."
              }
            >
              <div className="flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    id="discover-search"
                    type="text"
                    enterKeyHint="search"
                    autoComplete="off"
                    placeholder="Search titles"
                    className="pl-9"
                    aria-describedby="discover-search-hint"
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    onKeyDown={(e) => {
                      // Enter that confirms an IME composition must not submit the search.
                      if (e.key === "Enter" && (e.nativeEvent.isComposing || e.keyCode === 229)) {
                        e.preventDefault();
                      }
                    }}
                  />
                </div>
                <Button type="submit">Search by mood</Button>
              </div>
            </Field>
          </form>

          {shownQuery && (
            <div className="mt-10">
              <SectionHeader
                title={`Results for “${shownQuery}”`}
                meta={
                  !searchLoading && searchCount > 0
                    ? `${searchCount} ${searchCount === 1 ? "match" : "matches"}`
                    : undefined
                }
                action={<ClearButton label="Clear search" onClick={clearSearch} />}
              />

              {searchLoading ? (
                <>
                  <LoadingLine label={isVibeQuery ? "Finding matches" : "Searching"} className="mb-5" />
                  <MediaGridSkeleton count={5} aspect={isMusic ? "square" : "poster"} />
                </>
              ) : searchError ? (
                <Notice tone="error" title="Search didn't go through">
                  <p>Check your connection and try again.</p>
                  <div className="mt-3">
                    <Button variant="outline" size="sm" onClick={retrySearch}>
                      Try again
                    </Button>
                  </div>
                </Notice>
              ) : searchCount === 0 ? (
                <div className="frame">
                  <EmptyState
                    icon={Search}
                    title={`Nothing matched “${shownQuery}”.`}
                    description={
                      isVibeQuery
                        ? "Try describing it another way, or search by title."
                        : "Check the spelling, or try a shorter title."
                    }
                  />
                </div>
              ) : (
                <>
                  {isVibeQuery && vibe.interpretation && (
                    <p className="t-meta mb-5 max-w-[62ch]">{vibe.interpretation}</p>
                  )}
                  <MediaGrid>
                    {isVibeQuery && isMusic &&
                      musicVibeResults.map((r) => (
                        <MusicCard
                          key={r.spotify_id}
                          item={{
                            id: r.spotify_id ?? "",
                            name: r.title,
                            artist: r.artist || "",
                            album_name: "",
                            image_url: r.image_url || null,
                            release_date: "",
                            type: r.type === "track" ? "track" : "album",
                          }}
                          explanation={r.why}
                          onQueue={handleQueueVibeResult}
                          queued={queuedIds.has(r.spotify_id ?? "")}
                        />
                      ))}
                    {isVibeQuery && !isMusic &&
                      filmVibeResults.map((r) => {
                        const type = r.type === "tv" ? "tv" : "movie";
                        return (
                          <MediaCard
                            key={`${type}-${r.tmdb_id}`}
                            title={r.title}
                            subtitle={[type === "tv" ? "TV" : "Film", r.year].filter(Boolean).join(" · ")}
                            image={r.poster_url}
                            aspect="poster"
                            href={mediaHref(type, r.tmdb_id ?? 0)}
                            fallbackIcon={Film}
                            footer={r.why ? <p className="line-clamp-4">{r.why}</p> : undefined}
                          />
                        );
                      })}
                    {!isVibeQuery && isMusic &&
                      musicSearchResults.slice(0, SEARCH_RESULT_LIMIT).map((item) => (
                        <MusicCard
                          key={item.id}
                          item={item}
                          showType
                          onQueue={onQueue}
                          queued={queuedIds.has(item.id)}
                        />
                      ))}
                    {!isVibeQuery && !isMusic &&
                      searchResults.slice(0, SEARCH_RESULT_LIMIT).map((result) => (
                        <MediaCard
                          key={`${result.media_type}-${result.id}`}
                          title={result.title || result.name || "Untitled"}
                          subtitle={filmMeta(result, result.media_type === "movie" ? "Film" : "TV")}
                          image={result.poster_url}
                          aspect="poster"
                          href={mediaHref(result.media_type, result.id)}
                          fallbackIcon={Film}
                        />
                      ))}
                  </MediaGrid>
                </>
              )}

              {searchNeedsKey && !searchLoading && (
                <p className="t-meta mt-5">
                  Describing a mood needs an AI key.{" "}
                  <Link href={PROFILE_HREF} className="text-primary underline underline-offset-4">
                    Add one in your profile
                  </Link>
                  .
                </p>
              )}
            </div>
          )}
        </section>
  );
}
