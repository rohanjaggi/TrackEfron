"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Compass, Sparkles } from "lucide-react";

import { BrowsePanel, FILM_GENRES } from "@/components/discover/browse-panel";
import { DiscoverSearch } from "@/components/discover/discover-search";
import { FilmCard } from "@/components/discover/film";
import { MusicSection } from "@/components/discover/music-section";
import { PicksSection } from "@/components/discover/recs";
import type { FilmRec, MediaItem, MusicRec, Recs, RecsProblem } from "@/components/discover/types";
import { useBrowseFeed } from "@/components/discover/use-browse-feed";
import { useMusicFeed } from "@/components/discover/use-music-feed";
import { MediaGrid } from "@/components/ui/media-card";
import { PageHeader } from "@/components/ui/page";
import { TabBar } from "@/components/ui/segmented-control";
import { useToast } from "@/components/ui/toast";
import { useSavedKeys } from "@/hooks/use-saved-keys";
import { loadRecs, type RecsLoad } from "@/lib/ai/recs-client";
import { useMode } from "@/lib/mode-context";
import { saveToQueue, saveToWatchlist, titleKey } from "@/lib/saved-items";
import type { SpotifySearchResult } from "@/lib/spotify/spotify";
import type {
  FilmRecommendation,
  MusicRecommendation,
  MusicRecsResponse,
  RecsResponse,
  RightNow,
} from "@/lib/ai/types";

type Tab = "for-you" | "browse";

const TABS = [
  { value: "for-you", label: "For you", icon: Sparkles },
  { value: "browse", label: "Browse", icon: Compass },
] as const;

// ─── Helpers ───

function toMusicRec(r: MusicRecommendation): MusicRec {
  return {
    id: r.spotify_id || r.title,
    name: r.title,
    artist: r.artist,
    album_name: r.album_name || "",
    image_url: r.image_url || null,
    release_date: "",
    type: r.type || "album",
    explanation: r.explanation,
    confidence: r.confidence,
  };
}

function toFilmRec(r: FilmRecommendation): FilmRec {
  return {
    id: r.tmdb_id,
    title: r.title,
    media_type: r.media_type,
    poster_url: r.poster_url,
    release_date: r.year != null ? String(r.year) : undefined,
    explanation: r.explanation,
    confidence: r.confidence,
  };
}

function recsStart<T>(): Recs<T> {
  return { loading: true, items: [], problem: null };
}

function recsProblem<R>(load: RecsLoad<RecsResponse<R>>): RecsProblem | null {
  if (load.kind === "no_key") return { kind: "no_key" };
  if (load.kind === "error") return { kind: "error", detail: load.detail };
  if (load.body.status === "not_enough_logs") return { kind: "not_enough_logs" };
  if (load.body.status === "empty" || load.body.items.length === 0) return { kind: "error", detail: null };
  return null;
}

/** Fold an answer into a section. A failure keeps the picks already on screen; too few logs clears them. */
function settleRecs<T, R>(prev: Recs<T>, load: RecsLoad<RecsResponse<R>>, toItem: (r: R) => T): Recs<T> {
  const problem = recsProblem(load);
  if (problem === null && load.kind === "ok") {
    return { loading: false, items: load.body.items.map(toItem), problem: null };
  }
  return { loading: false, items: problem?.kind === "not_enough_logs" ? [] : prev.items, problem };
}

// ─── Page ───

export default function DiscoverPage() {
  const { mode, ready } = useMode();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("for-you");

  // What is already in the queue / on the watchlist, so a pick shows its state from the start.
  const { queuedIds, watchlistKeys: watchlistedKeys, markQueued, markWatchlisted } = useSavedKeys(mode, ready);

  // Browse tab: the genre picker
  const [selectedGenre, setSelectedGenre] = useState<{ id: number; name: string } | null>(null);
  const [genreResults, setGenreResults] = useState<MediaItem[]>([]);
  const [genreLoading, setGenreLoading] = useState(false);
  const [genreError, setGenreError] = useState(false);

  // For you picks, written by the AI recommendations route
  const [filmRecs, setFilmRecs] = useState<Recs<FilmRec>>(recsStart);
  const [musicRecs, setMusicRecs] = useState<Recs<MusicRec>>(recsStart);
  const [rightNow, setRightNow] = useState<RightNow | null>(null);

  // AI key status
  const [aiNotConfigured, setAiNotConfigured] = useState(false);

  // Guards: ignore a slow response once a newer request (or a mode switch) has replaced it;
  // ignore a second press while saving.
  const genreRequest = useRef(0);
  const filmRecsRequest = useRef(0);
  const filmRecsInFlight = useRef(false);
  const musicRecsRequest = useRef(0);
  const musicRecsInFlight = useRef(false);
  const savingIds = useRef(new Set<string>());

  // When the mode changes, drop the old mode's transient state in the same render so nothing stale paints.
  const [prevMode, setPrevMode] = useState(mode);
  if (prevMode !== mode) {
    setPrevMode(mode);
    setActiveTab("for-you");
    setSelectedGenre(null);
    setGenreResults([]);
    setGenreError(false);
    setGenreLoading(false);
  }
  // Late answers for a request made in the old mode must not land in the new one. A dropped For you
  // request leaves its section loading, so the fetch below asks again when the mode comes back.
  // Declared before the fetch effects so it runs first on a switch.
  const lastMode = useRef(mode);
  useEffect(() => {
    if (lastMode.current === mode) return;
    lastMode.current = mode;
    genreRequest.current++;
    filmRecsRequest.current++;
    filmRecsInFlight.current = false;
    musicRecsRequest.current++;
    musicRecsInFlight.current = false;
  }, [mode]);

  // Lazy shelves: music mode's, and the browse tab's (fetched once, the first time it opens).
  const musicFeed = useMusicFeed(mode);
  const browseFeed = useBrowseFeed(mode, activeTab === "browse");

  // ─── For you picks: one request at a time per mode, the newest wins ───
  const fetchFilmRecs = useCallback(
    async (refresh: boolean) => {
      const request = ++filmRecsRequest.current;
      filmRecsInFlight.current = true;
      const load = await loadRecs<RecsResponse<FilmRecommendation>>(
        `/api/ai/recommend?mode=film${refresh ? "&refresh=true" : ""}`,
      );
      if (request !== filmRecsRequest.current) return;
      filmRecsInFlight.current = false;
      if (load.kind === "no_key") setAiNotConfigured(true);
      setFilmRecs((prev) => settleRecs(prev, load, toFilmRec));
      if (refresh && recsProblem(load) === null) {
        toast({ mark: "Updated", title: "Your recommendations are fresh" });
      }
    },
    [toast],
  );

  const fetchMusicRecs = useCallback(
    async (refresh: boolean) => {
      const request = ++musicRecsRequest.current;
      musicRecsInFlight.current = true;
      const load = await loadRecs<MusicRecsResponse>(
        `/api/ai/recommend?mode=music${refresh ? "&refresh=true" : ""}`,
      );
      if (request !== musicRecsRequest.current) return;
      musicRecsInFlight.current = false;
      // "Right now" arrives with the picks; a failed or keyless answer has none.
      setRightNow(load.kind === "ok" ? (load.body.right_now ?? null) : null);
      if (load.kind === "no_key") setAiNotConfigured(true);
      setMusicRecs((prev) => settleRecs(prev, load, toMusicRec));
      if (refresh && recsProblem(load) === null) {
        toast({ mark: "Updated", title: "Your recommendations are fresh" });
      }
    },
    [toast],
  );

  // Music picks: lazy, music mode only.
  useEffect(() => {
    if (!ready || mode !== "music" || !musicRecs.loading || musicRecsInFlight.current) return;
    fetchMusicRecs(false);
  }, [ready, mode, musicRecs.loading, fetchMusicRecs]);

  // Film picks: lazy, For you tab in film mode only, and never before the stored mode is known
  // (the server renders film, so a music-mode reload must not start a film request).
  useEffect(() => {
    if (!ready || mode !== "film" || activeTab !== "for-you") return;
    if (!filmRecs.loading || filmRecsInFlight.current) return;
    fetchFilmRecs(false);
  }, [ready, mode, activeTab, filmRecs.loading, fetchFilmRecs]);

  // ─── Handlers ───

  async function handleAddToWatchlist(item: MediaItem) {
    const title = item.title || item.name || "Untitled";
    const titleId = titleKey(item.media_type, item.id);
    const key = `watch-${titleId}`;
    if (savingIds.current.has(key)) return;
    savingIds.current.add(key);
    try {
      const status = await saveToWatchlist({
        tmdb_id: item.id,
        title,
        media_type: item.media_type,
        poster_url: item.poster_url || null,
      });
      if (status === "signed_out") {
        toast({ mark: "Failed", tone: "error", title: "Sign in to add to your watchlist" });
      } else if (status === "failed") {
        toast({
          mark: "Failed",
          tone: "error",
          title: `Couldn't add ${title} to your watchlist`,
          description: "Try again in a moment.",
        });
      } else if (status === "unreachable") {
        toast({
          mark: "Failed",
          tone: "error",
          title: `Couldn't add ${title} to your watchlist`,
          description: "Check your connection and try again.",
        });
      } else {
        markWatchlisted(titleId);
        if (status === "duplicate") toast({ tone: "info", title: `${title} is already on your watchlist` });
        else toast({ mark: "Added", title: `${title} added to your watchlist` });
      }
    } finally {
      savingIds.current.delete(key);
    }
  }

  /** Resolves true once the item is in the queue (a duplicate counts). */
  async function handleAddToQueue(item: SpotifySearchResult): Promise<boolean> {
    const key = `queue-${item.id}`;
    if (savingIds.current.has(key)) return false;
    savingIds.current.add(key);
    try {
      const status = await saveToQueue({
        spotify_id: item.id,
        media_type: item.type,
        title: item.name,
        artist: item.artist,
        image_url: item.image_url,
      });
      if (status === "signed_out") {
        toast({ mark: "Failed", tone: "error", title: "Sign in to add to your queue" });
        return false;
      }
      if (status === "failed") {
        toast({
          mark: "Failed",
          tone: "error",
          title: `Couldn't add ${item.name} to your queue`,
          description: "Try again in a moment.",
        });
        return false;
      }
      if (status === "unreachable") {
        toast({
          mark: "Failed",
          tone: "error",
          title: `Couldn't add ${item.name} to your queue`,
          description: "Check your connection and try again.",
        });
        return false;
      }
      markQueued(item.id);
      if (status === "duplicate") toast({ tone: "info", title: `${item.name} is already in your queue` });
      else toast({ mark: "Added", title: `${item.name} added to your queue` });
      return true;
    } finally {
      savingIds.current.delete(key);
    }
  }

  // Refresh and Try again both ask for a rebuild: an empty answer is cached, so a plain retry would repeat it.
  function refreshFilmRecs() {
    setFilmRecs((r) => ({ ...r, loading: true, problem: null }));
    fetchFilmRecs(true);
  }

  function refreshMusicRecs() {
    setMusicRecs((r) => ({ ...r, loading: true, problem: null }));
    fetchMusicRecs(true);
  }

  function clearGenre() {
    genreRequest.current++;
    setSelectedGenre(null);
    setGenreResults([]);
    setGenreError(false);
    setGenreLoading(false);
  }

  async function handleGenreToggle(key: string) {
    const genre = FILM_GENRES.find((g) => String(g.id) === key);
    if (!genre || selectedGenre?.id === genre.id) {
      clearGenre();
      return;
    }
    const request = ++genreRequest.current;
    setSelectedGenre(genre);
    setGenreResults([]);
    setGenreError(false);
    setGenreLoading(true);
    try {
      const res = await fetch(`/api?action=discover&type=movie&genres=${genre.id}`);
      const data = await res.json();
      if (request !== genreRequest.current) return;
      if (Array.isArray(data)) setGenreResults(data);
      else setGenreError(true);
    } catch {
      if (request === genreRequest.current) setGenreError(true);
    } finally {
      if (request === genreRequest.current) setGenreLoading(false);
    }
  }

  const isMusic = mode === "music";

  return (
    <div>
      <PageHeader
        title={
          <>
            Discover <em>{isMusic ? "your next listen" : "your next watch"}</em>
          </>
        }
        description={
          isMusic
            ? "Find your next favourite album or track."
            : "Find your next favourite film or show."
        }
      />

      <div className="flex flex-col gap-16">
        <DiscoverSearch
          mode={mode}
          aiNotConfigured={aiNotConfigured}
          onNoKey={() => setAiNotConfigured(true)}
          queuedIds={queuedIds}
          onQueue={handleAddToQueue}
        />

        {/* ─── MUSIC MODE ─── */}
        {isMusic && (
          <MusicSection
            rightNow={rightNow}
            recs={musicRecs}
            onRefresh={refreshMusicRecs}
            feed={musicFeed}
            queuedIds={queuedIds}
            onQueue={handleAddToQueue}
          />
        )}

        {/* ─── FILM MODE ─── */}
        {!isMusic && (
          <div>
            <TabBar
              className="mb-10"
              label="Discover sections"
              idBase="discover"
              value={activeTab}
              onChange={setActiveTab}
              tabs={TABS}
            />

            {/* ─── For you ─── */}
            {activeTab === "for-you" && (
              <section
                role="tabpanel"
                id="discover-panel-for-you"
                aria-labelledby="discover-tab-for-you"
              >
                <PicksSection
                  title="Recommended for you"
                  note="Based on what you have rated highly."
                  domain="film"
                  recs={{ loading: filmRecs.loading, problem: filmRecs.problem, count: filmRecs.items.length }}
                  onRefresh={refreshFilmRecs}
                >
                  <MediaGrid>
                    {filmRecs.items.map((item, idx) => (
                      <FilmCard
                        key={`rec-${item.id}-${idx}`}
                        item={item}
                        rank={idx + 1}
                        stretch={item.confidence === "discovery"}
                        onWatchlist={handleAddToWatchlist}
                        watchlisted={watchlistedKeys.has(titleKey(item.media_type, item.id))}
                      />
                    ))}
                  </MediaGrid>
                </PicksSection>
              </section>
            )}

            {/* ─── Browse ─── */}
            {activeTab === "browse" && (
              <BrowsePanel
                selectedGenre={selectedGenre}
                genreResults={genreResults}
                genreLoading={genreLoading}
                genreError={genreError}
                onGenreToggle={handleGenreToggle}
                onGenreClear={clearGenre}
                feed={browseFeed}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
