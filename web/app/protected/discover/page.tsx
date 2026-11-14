"use client";

import { useState, useEffect, useRef, useCallback, useId } from "react";
import Link from "next/link";
import {
  Bookmark,
  BookmarkCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  Compass,
  Disc3,
  Film,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { RightNowStrip } from "@/components/discover/right-now-strip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingLine, MediaGridSkeleton, Skeleton } from "@/components/ui/loading";
import { MediaCard, MediaGrid } from "@/components/ui/media-card";
import { EmptyState, Field, Notice, PageHeader, SectionHeader } from "@/components/ui/page";
import { TabBar } from "@/components/ui/segmented-control";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { useMode } from "@/lib/mode-context";
import type {
  Confidence,
  FilmRecommendation,
  MusicRecommendation,
  MusicRecsResponse,
  RecsResponse,
  RightNow,
  VibeSearchResponse,
  VibeSearchResult,
} from "@/lib/ai/types";

// ─── Types ───

type MediaItem = {
  id: number;
  title?: string;
  name?: string;
  media_type: "movie" | "tv";
  poster_url?: string | null;
  poster_path?: string | null;
  vote_average?: number;
  release_date?: string;
  first_air_date?: string;
  genre_ids?: number[];
};

type SearchResult = {
  id: number;
  title?: string;
  name?: string;
  media_type: "movie" | "tv";
  release_date?: string;
  first_air_date?: string;
  poster_url?: string | null;
  vote_average?: number;
};

type ForYouRow = {
  id: string;
  title: string;
  subtitle?: string;
  items: MediaItem[];
};

type MusicMediaItem = {
  id: string;
  name: string;
  artist: string;
  album_name: string;
  image_url: string | null;
  release_date: string;
  type: "album" | "track";
};

type FilmRec = MediaItem & { explanation?: string; confidence?: Confidence };
type MusicRec = MusicMediaItem & { explanation?: string; confidence?: Confidence };

type Tab = "for-you" | "browse";

/** What one call to the recommendations endpoint came back with. */
type RecsLoad<T> =
  | { kind: "ok"; body: T }
  | { kind: "no_key" }
  | { kind: "error"; detail: string | null };

/** Why a For you section has nothing (new) to show. */
type RecsProblem =
  | { kind: "no_key" }
  | { kind: "not_enough_logs" }
  | { kind: "error"; detail: string | null };

/** A For you section. `loading` starts true: the section shows as loading until its first answer settles. */
type Recs<T> = { loading: boolean; items: T[]; problem: RecsProblem | null };

/** A settled title search, tagged with what it was for so a stale one is never shown. */
type TitleSearch = { key: string; failed: boolean; films: SearchResult[]; music: MusicMediaItem[] };

/** A search by description. It runs only when Enter is pressed. */
type VibeSearch = {
  query: string;
  loading: boolean;
  failed: boolean;
  interpretation: string;
  results: VibeSearchResult[];
};

// ─── Constants ───

const PROFILE_HREF = "/protected/profile";
const LOG_HREF = "/protected/log";
const SEARCH_RESULT_LIMIT = 10;
/** Postgres unique-violation: the row is already there. */
const DUPLICATE_ROW = "23505";

const NOT_ENOUGH_LOGS_COPY = "Log and rate at least 5 titles to get recommendations.";
const RECS_ERROR_COPY = "Couldn't build recommendations. Try again.";

const NO_TITLE_SEARCH: TitleSearch = { key: "", failed: false, films: [], music: [] };

const FILM_GENRES = [
  { id: 28, name: "Action" },
  { id: 35, name: "Comedy" },
  { id: 18, name: "Drama" },
  { id: 878, name: "Sci-Fi" },
  { id: 53, name: "Thriller" },
  { id: 27, name: "Horror" },
  { id: 10749, name: "Romance" },
  { id: 99, name: "Documentary" },
];

const FILM_GENRE_OPTIONS = FILM_GENRES.map((g) => ({ key: String(g.id), label: g.name }));

const TABS = [
  { value: "for-you", label: "For you", icon: Sparkles },
  { value: "browse", label: "Browse", icon: Compass },
] as const;

// ─── Helpers ───

/** TMDB movie and TV ids are separate namespaces, so a title is always the pair. */
function titleKey(mediaType: string | null | undefined, id: number) {
  return `${mediaType ?? "movie"}:${id}`;
}

function mediaHref(type: "movie" | "tv", id: number) {
  return `/protected/media/${type}/${id}`;
}

/** "Film · 2021 · 7.8/10": optional lead, release year and audience score, whichever exist. */
function filmMeta(
  item: { release_date?: string; first_air_date?: string; vote_average?: number },
  lead?: string,
) {
  const year = (item.release_date || item.first_air_date || "").slice(0, 4);
  const score =
    item.vote_average != null && item.vote_average > 0 ? `${item.vote_average.toFixed(1)}/10` : "";
  return [lead, year, score].filter(Boolean).join(" · ");
}

function titleSearchKey(mode: string, run: number, q: string) {
  return `${mode}:${run}:${q}`;
}

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

/**
 * The one loader for film and music picks. 402 means no AI key; any other failure
 * (an error status, a network failure, a body without `items`) is an error, and a
 * provider error carries the server's message to show beneath.
 */
async function loadRecs<T extends RecsResponse<unknown>>(url: string): Promise<RecsLoad<T>> {
  try {
    const res = await fetch(url);
    if (res.status === 402) return { kind: "no_key" };
    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const err = (body ?? {}) as { error?: unknown; code?: unknown };
      const detail = err.code === "PROVIDER_ERROR" && typeof err.error === "string" ? err.error : null;
      return { kind: "error", detail };
    }
    if (!body || !Array.isArray((body as { items?: unknown }).items)) return { kind: "error", detail: null };
    return { kind: "ok", body: body as T };
  } catch {
    return { kind: "error", detail: null };
  }
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

// ─── Shared pieces ───

/** The one chip pattern on this page: square toggle buttons, one active at a time, press again to clear. */
function ToggleGroup({
  label,
  options,
  activeKey,
  onToggle,
}: {
  label: string;
  options: { key: string; label: string }[];
  activeKey: string | null;
  onToggle: (key: string) => void;
}) {
  const labelId = useId();
  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-wrap items-center gap-2">
      <span id={labelId} className="t-label mr-1">
        {label}
      </span>
      {options.map((opt) => {
        const active = opt.key === activeKey;
        return (
          <Button
            key={opt.key}
            variant="outline"
            size="default"
            aria-pressed={active}
            className={active ? "border-primary bg-primary/10 text-primary" : "text-foreground"}
            onClick={() => onToggle(opt.key)}
          >
            {opt.label}
          </Button>
        );
      })}
    </div>
  );
}

function ClearButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button variant="ghost" size="sm" onClick={onClick} aria-label={label}>
      <X aria-hidden="true" /> Clear
    </Button>
  );
}

/** A titled row of cards that scrolls sideways inside its own container. */
function Shelf({
  title,
  subtitle,
  loading,
  aspect,
  itemCount,
  children,
}: {
  title: string;
  subtitle?: string;
  loading?: boolean;
  aspect: "poster" | "square";
  itemCount: number;
  children: React.ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", checkScroll, { passive: true });
    window.addEventListener("resize", checkScroll);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [checkScroll, itemCount, loading]);

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.75;
    el.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  return (
    <section>
      <SectionHeader
        title={title}
        className={subtitle ? "mb-3" : undefined}
        action={
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label={`Scroll ${title} back`}
              disabled={!canScrollLeft}
              onClick={() => scroll("left")}
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label={`Scroll ${title} forward`}
              disabled={!canScrollRight}
              onClick={() => scroll("right")}
            >
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        }
      />
      {subtitle && <p className="t-meta mb-5">{subtitle}</p>}
      <div className="relative">
        <div
          ref={scrollRef}
          role={loading ? "status" : "group"}
          aria-label={loading ? `Loading ${title}` : `${title}, scrolls sideways`}
          tabIndex={loading ? undefined : 0}
          className="-mx-1 flex snap-x snap-proximity gap-5 overflow-x-auto px-1 pb-2 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*]:w-[140px] [&>*]:shrink-0 [&>*]:snap-start sm:[&>*]:w-[160px]"
        >
          {loading
            ? Array.from({ length: 8 }, (_, i) => (
                <div key={i}>
                  <Skeleton className={aspect === "square" ? "aspect-square" : "aspect-[2/3]"} />
                  <Skeleton className="mt-3 h-3 w-3/4" />
                  <Skeleton className="mt-2 h-2.5 w-1/2" />
                </div>
              ))
            : children}
        </div>
        {canScrollRight && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-[var(--bg)] to-transparent"
          />
        )}
      </div>
    </section>
  );
}

/** Marks a pick that reaches past the user's usual taste. */
function StretchBadge() {
  return <Badge variant="secondary">Stretch</Badge>;
}

// ─── Film pieces ───

function FilmCard({
  item,
  rank,
  stretch,
  onWatchlist,
  watchlisted,
}: {
  item: FilmRec;
  rank?: number;
  /** A "discovery" pick: shown with a Stretch tag. */
  stretch?: boolean;
  onWatchlist?: (item: MediaItem) => void;
  watchlisted?: boolean;
}) {
  const title = item.title || item.name || "Untitled";
  return (
    <MediaCard
      title={title}
      subtitle={filmMeta(item) || undefined}
      image={item.poster_url}
      aspect="poster"
      href={mediaHref(item.media_type, item.id)}
      fallbackIcon={Film}
      badge={
        rank != null || stretch ? (
          <span className="flex flex-wrap gap-1">
            {rank != null && <Badge variant="secondary">No. {rank}</Badge>}
            {stretch && <StretchBadge />}
          </span>
        ) : undefined
      }
      footer={item.explanation ? <p className="line-clamp-4">{item.explanation}</p> : undefined}
      actions={
        onWatchlist ? (
          <Button
            size="icon"
            variant="secondary"
            className="h-8 w-8 disabled:text-primary disabled:opacity-100"
            aria-label={watchlisted ? `${title} is on your watchlist` : `Add ${title} to watchlist`}
            disabled={watchlisted}
            onClick={() => onWatchlist(item)}
          >
            {watchlisted ? <BookmarkCheck aria-hidden="true" /> : <Bookmark aria-hidden="true" />}
          </Button>
        ) : undefined
      }
    />
  );
}

function FilmShelf({
  title,
  subtitle,
  items,
  loading,
}: {
  title: string;
  subtitle?: string;
  items: MediaItem[];
  loading?: boolean;
}) {
  if (!loading && items.length === 0) return null;
  return (
    <Shelf title={title} subtitle={subtitle} loading={loading} aspect="poster" itemCount={items.length}>
      {items.map((item) => (
        <FilmCard key={`${item.media_type}-${item.id}`} item={item} />
      ))}
    </Shelf>
  );
}

// ─── Music pieces ───

function MusicCard({
  item,
  onQueue,
  queued,
  explanation,
  stretch,
  showType,
}: {
  item: MusicMediaItem;
  /** Leave out for things that cannot be queued (an artist). */
  onQueue?: (item: MusicMediaItem) => void;
  queued?: boolean;
  explanation?: string;
  /** A "discovery" pick: shown with a Stretch tag. */
  stretch?: boolean;
  /** Add "Album" or "Track" and the year to the second line. */
  showType?: boolean;
}) {
  const subtitle = showType
    ? [item.artist, item.type === "album" ? "Album" : "Track", item.release_date.slice(0, 4)]
        .filter(Boolean)
        .join(" · ")
    : item.artist;
  return (
    <MediaCard
      title={item.name}
      subtitle={subtitle || undefined}
      image={item.image_url}
      aspect="square"
      fallbackIcon={Disc3}
      badge={stretch ? <StretchBadge /> : undefined}
      footer={
        explanation || onQueue ? (
          <>
            {explanation && <p className="line-clamp-4">{explanation}</p>}
            {onQueue && (
              <Button
                variant="outline"
                size="sm"
                className="mt-2 w-full disabled:text-primary disabled:opacity-100"
                aria-label={queued ? `${item.name} is in your queue` : `Add ${item.name} to queue`}
                disabled={queued}
                onClick={() => onQueue(item)}
              >
                {queued ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}
                {queued ? "In queue" : "Queue"}
              </Button>
            )}
          </>
        ) : undefined
      }
    />
  );
}

function MusicShelf({
  title,
  subtitle,
  items,
  loading,
  onQueue,
  queuedIds,
}: {
  title: string;
  subtitle?: string;
  items: MusicMediaItem[];
  loading?: boolean;
  onQueue?: (item: MusicMediaItem) => void;
  queuedIds: Set<string>;
}) {
  if (!loading && items.length === 0) return null;
  return (
    <Shelf title={title} subtitle={subtitle} loading={loading} aspect="square" itemCount={items.length}>
      {items.map((item) => (
        <MusicCard key={item.id} item={item} onQueue={onQueue} queued={queuedIds.has(item.id)} />
      ))}
    </Shelf>
  );
}

/** The way forward wherever an AI feature has no key to run on. */
function AiKeyLink() {
  return (
    <Button asChild variant="outline" size="sm">
      <Link href={PROFILE_HREF}>Add a key in your profile</Link>
    </Button>
  );
}

// ─── For you pieces ───

/**
 * Why a For you section has nothing new to show. On its own it fills the section;
 * `withPicks` is the failed-refresh case, shown above the picks that stay on screen.
 */
function RecsProblemView({
  problem,
  domain,
  withPicks = false,
  onRetry,
}: {
  problem: RecsProblem;
  domain: "film" | "music";
  withPicks?: boolean;
  onRetry: () => void;
}) {
  if (problem.kind === "no_key") {
    return withPicks ? (
      <Notice tone="error" title="Couldn't refresh your picks" action={<AiKeyLink />} className="mb-6">
        Recommendations need an AI key, and none is saved. The picks below are from before.
      </Notice>
    ) : (
      <div className="frame">
        <EmptyState
          icon={Sparkles}
          title="Recommendations need an AI key."
          description="These picks are written using your own AI key, and none is saved yet. Add one in your profile and they will appear here."
          action={<AiKeyLink />}
        />
      </div>
    );
  }

  if (problem.kind === "not_enough_logs") {
    return (
      <div className="frame">
        <EmptyState
          icon={Sparkles}
          title={NOT_ENOUGH_LOGS_COPY}
          description="We need a few more ratings to learn your taste. Keep logging."
          action={
            <Button asChild variant="outline">
              <Link href={LOG_HREF}>{domain === "music" ? "Log a listen" : "Log a watch"}</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <Notice
      tone="error"
      title={RECS_ERROR_COPY}
      className={withPicks ? "mb-6" : undefined}
      action={
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      }
    >
      {(problem.detail || withPicks) && (
        <>
          {problem.detail && <p className="t-meta">{problem.detail}</p>}
          {withPicks && <p className={problem.detail ? "mt-1" : undefined}>The picks below are from before.</p>}
        </>
      )}
    </Notice>
  );
}

/** A For you section's header with Refresh, then its picks, its loading state, or why there are none. */
function PicksSection({
  title,
  note,
  domain,
  recs,
  onRefresh,
  children,
}: {
  title: string;
  note: string;
  domain: "film" | "music";
  recs: { loading: boolean; problem: RecsProblem | null; count: number };
  /** Asks for a rebuild: used by Refresh and by Try again, since an empty answer is cached. */
  onRefresh: () => void;
  /** The grid of picks. */
  children: React.ReactNode;
}) {
  const { loading, problem, count } = recs;
  return (
    <>
      <SectionHeader
        title={title}
        className="mb-3"
        meta={!loading && count > 0 ? `${count} picks` : undefined}
        action={
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
            <RefreshCw aria-hidden="true" />
            {loading ? "Refreshing" : "Refresh"}
          </Button>
        }
      />
      <p className="t-meta mb-5">{note}</p>

      {count > 0 ? (
        <>
          {problem && !loading && (
            <RecsProblemView problem={problem} domain={domain} withPicks onRetry={onRefresh} />
          )}
          {children}
        </>
      ) : loading ? (
        <>
          <LoadingLine label="Finding picks for you" className="mb-5" />
          <MediaGridSkeleton count={10} aspect={domain === "music" ? "square" : "poster"} />
        </>
      ) : problem ? (
        <RecsProblemView problem={problem} domain={domain} onRetry={onRefresh} />
      ) : null}
    </>
  );
}

// ─── Page ───

export default function DiscoverPage() {
  const { mode, ready } = useMode();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("for-you");

  // Music state. Lazy shelves start as loading; music mode shows them loading until their first fetch settles.
  const [queuedIds, setQueuedIds] = useState<Set<string>>(new Set());
  const [personalMusicRows, setPersonalMusicRows] = useState<{ title: string; items: MusicMediaItem[] }[]>([]);
  const [personalMusicLoading, setPersonalMusicLoading] = useState(true);
  const [spotifyTopTracks, setSpotifyTopTracks] = useState<MusicMediaItem[]>([]);
  const [spotifyOAuthConnected, setSpotifyOAuthConnected] = useState<boolean | null>(null);
  const [spotifyOAuthLoading, setSpotifyOAuthLoading] = useState(true);

  // Search (shared across modes). `searchQuery` is what is typed; `activeQuery` is the title search it
  // settles into. A search by description (`vibe`) runs only on Enter and is shown instead while it exists.
  const [searchQuery, setSearchQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [searchRun, setSearchRun] = useState(0);
  const [titleSearch, setTitleSearch] = useState<TitleSearch>(NO_TITLE_SEARCH);
  const [vibe, setVibe] = useState<VibeSearch | null>(null);
  const [searchNeedsKey, setSearchNeedsKey] = useState(false);

  // Browse tab state
  const [trending, setTrending] = useState<MediaItem[]>([]);
  const [nowPlaying, setNowPlaying] = useState<MediaItem[]>([]);
  const [topRated, setTopRated] = useState<MediaItem[]>([]);
  const [browseLoading, setBrowseLoading] = useState(true);
  const [selectedGenre, setSelectedGenre] = useState<{ id: number; name: string } | null>(null);
  const [genreResults, setGenreResults] = useState<MediaItem[]>([]);
  const [genreLoading, setGenreLoading] = useState(false);
  const [genreError, setGenreError] = useState(false);

  // Personalised rows (browse tab)
  const [forYouRows, setForYouRows] = useState<ForYouRow[]>([]);
  const [personalLoading, setPersonalLoading] = useState(true);
  const [watchedKeys, setWatchedKeys] = useState<Set<string>>(new Set());

  // For you picks, written by the AI recommendations route
  const [watchlistedKeys, setWatchlistedKeys] = useState<Set<string>>(new Set());
  const [filmRecs, setFilmRecs] = useState<Recs<FilmRec>>(recsStart);
  const [musicRecs, setMusicRecs] = useState<Recs<MusicRec>>(recsStart);
  const [rightNow, setRightNow] = useState<RightNow | null>(null);

  // AI key status
  const [aiNotConfigured, setAiNotConfigured] = useState(false);

  // Guards: ignore a slow response once a newer request (or a mode switch) has replaced it;
  // start each lazy fetch once; ignore a second press while saving.
  const genreRequest = useRef(0);
  const vibeRequest = useRef(0);
  const filmRecsRequest = useRef(0);
  const filmRecsInFlight = useRef(false);
  const musicRecsRequest = useRef(0);
  const musicRecsInFlight = useRef(false);
  const started = useRef({ library: false, spotify: false, browse: false });
  const savingIds = useRef(new Set<string>());

  // When the mode changes, drop the old mode's transient state in the same render so nothing stale paints.
  const [prevMode, setPrevMode] = useState(mode);
  if (prevMode !== mode) {
    setPrevMode(mode);
    setActiveTab("for-you");
    setSearchQuery("");
    setActiveQuery("");
    setVibe(null);
    setSearchNeedsKey(false);
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
    vibeRequest.current++;
    filmRecsRequest.current++;
    filmRecsInFlight.current = false;
    musicRecsRequest.current++;
    musicRecsInFlight.current = false;
  }, [mode]);

  // ─── Music queue keys (music mode only; reloaded on each visit) ───
  useEffect(() => {
    if (mode !== "music") return;
    let cancelled = false;

    async function fetchQueuedIds() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) return;
        const { data } = await supabase
          .from("music_queue")
          .select("spotify_id")
          .eq("user_id", user.id);
        if (data && !cancelled) {
          setQueuedIds(new Set(data.map((i: { spotify_id: string }) => i.spotify_id).filter(Boolean)));
        }
      } catch {
        // Queue buttons fall back to "Queue"; adding a duplicate is handled on save.
      }
    }

    fetchQueuedIds();
    return () => {
      cancelled = true;
    };
  }, [mode]);

  // ─── Film watchlist keys (film mode only, once the stored mode is known; reloaded on each visit) ───
  useEffect(() => {
    if (!ready || mode !== "film") return;
    let cancelled = false;

    async function fetchWatchlistKeys() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) return;
        const { data } = await supabase
          .from("watchlist")
          .select("tmdb_id, media_type")
          .eq("user_id", user.id);
        if (data && !cancelled) {
          setWatchlistedKeys(new Set(data.map((i) => titleKey(i.media_type, i.tmdb_id))));
        }
      } catch {
        // Add buttons fall back to "Add"; adding a duplicate is handled on save.
      }
    }

    fetchWatchlistKeys();
    return () => {
      cancelled = true;
    };
  }, [mode, ready]);

  // ─── Personalised music rows (lazy — top artist from listen_logs) ───
  useEffect(() => {
    if (mode !== "music" || started.current.library) return;
    started.current.library = true;

    async function fetchPersonalMusic() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: logs } = await supabase
          .from("listen_logs")
          .select("artist")
          .eq("user_id", user.id)
          .not("artist", "is", null);
        if (!logs || logs.length === 0) return;

        // Count artist frequency and take the top one
        const freq = new Map<string, number>();
        logs.forEach((l: { artist: string | null }) => {
          if (!l.artist) return;
          // Use first artist if comma-separated
          const primary = l.artist.split(",")[0].trim();
          freq.set(primary, (freq.get(primary) || 0) + 1);
        });
        const topArtists = Array.from(freq.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 1)
          .map(([name]) => name);

        const rows = await Promise.all(
          topArtists.map(async (artist) => {
            try {
              const res = await fetch(`/api/spotify?action=search&q=${encodeURIComponent(artist)}&type=album`);
              const data = await res.json();
              return { title: `More from ${artist}`, items: Array.isArray(data) ? data : [] };
            } catch {
              return { title: `More from ${artist}`, items: [] };
            }
          })
        );
        setPersonalMusicRows(rows.filter((r) => r.items.length > 0));
      } catch {
        // These shelves simply stay hidden.
      } finally {
        setPersonalMusicLoading(false);
      }
    }

    fetchPersonalMusic();
  }, [mode]);

  // ─── Spotify top tracks (lazy — music mode, needs a connected account) ───
  useEffect(() => {
    if (mode !== "music" || started.current.spotify) return;
    started.current.spotify = true;

    async function fetchSpotifyTopTracks() {
      try {
        const tracksRes = await fetch("/api/spotify/me?action=top-tracks");
        const tracksData = await tracksRes.json();

        if (tracksData.connected === false) {
          setSpotifyOAuthConnected(false);
          return;
        }
        setSpotifyOAuthConnected(true);
        if (Array.isArray(tracksData)) setSpotifyTopTracks(tracksData);
      } catch {
        setSpotifyOAuthConnected(false);
      } finally {
        setSpotifyOAuthLoading(false);
      }
    }

    fetchSpotifyTopTracks();
  }, [mode]);

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

  // ─── Fetch browse data (lazy — only when browse tab is first opened) ───
  useEffect(() => {
    if (mode !== "film" || activeTab !== "browse" || started.current.browse) return;
    started.current.browse = true;

    async function fetchBrowse() {
      try {
        const [trendingRes, nowPlayingRes, topRatedRes] = await Promise.all([
          fetch("/api?action=trending").then((r) => r.json()).catch(() => []),
          fetch("/api?action=now_playing").then((r) => r.json()).catch(() => []),
          fetch("/api?action=top_rated&type=movie").then((r) => r.json()).catch(() => []),
        ]);
        if (Array.isArray(trendingRes)) setTrending(trendingRes);
        if (Array.isArray(nowPlayingRes)) setNowPlaying(nowPlayingRes);
        if (Array.isArray(topRatedRes)) setTopRated(topRatedRes);
      } catch {
        // Handled below: if every shelf is empty the tab says so.
      } finally {
        setBrowseLoading(false);
      }
    }

    async function fetchPersonalized() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: logs, error } = await supabase
          .from("watch_logs")
          .select("rating, media_type, tmdb_id, title")
          .eq("user_id", user.id)
          .order("rating", { ascending: false });

        if (error || !logs || logs.length === 0) return;

        const watched = new Set<string>();
        logs.forEach((l) => { if (l.tmdb_id) watched.add(titleKey(l.media_type, l.tmdb_id)); });
        setWatchedKeys(watched);

        const uniqueEntries = new Map<string, { tmdbId: number; type: "movie" | "tv" }>();
        logs.forEach((l) => {
          const key = titleKey(l.media_type, l.tmdb_id);
          if (l.tmdb_id && !uniqueEntries.has(key)) {
            uniqueEntries.set(key, { tmdbId: l.tmdb_id, type: l.media_type });
          }
        });
        const entries = Array.from(uniqueEntries.values()).slice(0, 20);

        type DetailResult = { genres: { id: number; name: string }[] };
        const details: DetailResult[] = [];

        for (let i = 0; i < entries.length; i += 10) {
          const batch = entries.slice(i, i + 10);
          const results = await Promise.all(
            batch.map(async (info) => {
              try {
                const res = await fetch(`/api?action=detail&type=${info.type}&id=${info.tmdbId}`);
                if (!res.ok) return null;
                const d = await res.json();
                const genres = (d.genres || []).map((g: { id: number; name: string }) => ({ id: g.id, name: g.name }));
                return { genres };
              } catch { return null; }
            })
          );
          results.forEach((r) => { if (r) details.push(r); });
        }

        // Top genres
        const genreCount = new Map<number, { name: string; count: number }>();
        details.forEach((d) => {
          d.genres.forEach((g) => {
            const entry = genreCount.get(g.id) || { name: g.name, count: 0 };
            entry.count++;
            genreCount.set(g.id, entry);
          });
        });
        const topGenres = Array.from(genreCount.entries())
          .map(([id, { name, count }]) => ({ id, name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 2);

        const rowPromises: Promise<ForYouRow | null>[] = topGenres.map((genre) =>
          fetch(`/api?action=discover&type=movie&genres=${genre.id}`)
            .then((r) => r.json())
            .then((data) => {
              if (!Array.isArray(data)) return null;
              const filtered = data.filter((item: MediaItem) => !watched.has(titleKey(item.media_type, item.id)));
              if (filtered.length === 0) return null;
              return {
                id: `genre-${genre.id}`,
                title: `Because you love ${genre.name}`,
                subtitle: `Highly rated ${genre.name.toLowerCase()} picks`,
                items: filtered.slice(0, 20),
              };
            })
            .catch(() => null)
        );

        const rows = (await Promise.all(rowPromises)).filter((r): r is ForYouRow => r !== null);
        setForYouRows(rows);
      } catch {
        // These shelves simply stay hidden.
      } finally {
        setPersonalLoading(false);
      }
    }

    fetchBrowse();
    fetchPersonalized();
  }, [mode, activeTab]);

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
          const res = await fetch(`/api/spotify?action=search&q=${encodeURIComponent(q)}&type=album,track`);
          const data: unknown = await res.json();
          return Array.isArray(data) ? { key, failed: false, films: [], music: data as MusicMediaItem[] } : failed;
        }
        const res = await fetch(`/api?action=search&q=${encodeURIComponent(q)}`);
        const data: unknown = await res.json();
        return Array.isArray(data) ? { key, failed: false, films: data as SearchResult[], music: [] } : failed;
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
        setAiNotConfigured(true);
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

  async function handleAddToWatchlist(item: MediaItem) {
    const title = item.title || item.name || "Untitled";
    const titleId = titleKey(item.media_type, item.id);
    const key = `watch-${titleId}`;
    if (savingIds.current.has(key)) return;
    savingIds.current.add(key);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ mark: "Failed", tone: "error", title: "Sign in to add to your watchlist" });
        return;
      }
      const { error } = await supabase.from("watchlist").insert({
        user_id: user.id,
        tmdb_id: item.id,
        title,
        media_type: item.media_type,
        poster_url: item.poster_url || null,
      });
      if (error && error.code !== DUPLICATE_ROW) {
        toast({
          mark: "Failed",
          tone: "error",
          title: `Couldn't add ${title} to your watchlist`,
          description: "Try again in a moment.",
        });
        return;
      }
      setWatchlistedKeys((prev) => new Set([...prev, titleId]));
      if (error) toast({ tone: "info", title: `${title} is already on your watchlist` });
      else toast({ mark: "Added", title: `${title} added to your watchlist` });
    } catch {
      toast({
        mark: "Failed",
        tone: "error",
        title: `Couldn't add ${title} to your watchlist`,
        description: "Check your connection and try again.",
      });
    } finally {
      savingIds.current.delete(key);
    }
  }

  /** Resolves true once the item is in the queue (a duplicate counts). */
  async function handleAddToQueue(item: MusicMediaItem): Promise<boolean> {
    const key = `queue-${item.id}`;
    if (savingIds.current.has(key)) return false;
    savingIds.current.add(key);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ mark: "Failed", tone: "error", title: "Sign in to add to your queue" });
        return false;
      }
      const { error } = await supabase.from("music_queue").insert({
        user_id: user.id,
        spotify_id: item.id,
        media_type: item.type,
        title: item.name,
        artist: item.artist,
        image_url: item.image_url,
      });
      if (error && error.code !== DUPLICATE_ROW) {
        toast({
          mark: "Failed",
          tone: "error",
          title: `Couldn't add ${item.name} to your queue`,
          description: "Try again in a moment.",
        });
        return false;
      }
      setQueuedIds((prev) => new Set([...prev, item.id]));
      if (error) toast({ tone: "info", title: `${item.name} is already in your queue` });
      else toast({ mark: "Added", title: `${item.name} added to your queue` });
      return true;
    } catch {
      toast({
        mark: "Failed",
        tone: "error",
        title: `Couldn't add ${item.name} to your queue`,
        description: "Check your connection and try again.",
      });
      return false;
    } finally {
      savingIds.current.delete(key);
    }
  }

  /** Queueing a result found by description is picking it, so the search by description is done. */
  async function handleQueueVibeResult(item: MusicMediaItem) {
    if (await handleAddToQueue(item)) clearSearch();
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

  const filterWatched = (items: MediaItem[]) =>
    watchedKeys.size > 0 ? items.filter((i) => !watchedKeys.has(titleKey(i.media_type, i.id))) : items;

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

  const browseFailed =
    !browseLoading &&
    trending.length === 0 &&
    nowPlaying.length === 0 &&
    topRated.length === 0;

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
        {/* ─── Search ─── */}
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
                          onQueue={handleAddToQueue}
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

        {/* ─── MUSIC MODE ─── */}
        {isMusic && (
          <>
            {/* Right now: rising and dropped-off artists, from the same answer as the picks */}
            {rightNow && <RightNowStrip rightNow={rightNow} />}

            {/* For you */}
            <section>
              <PicksSection
                title="For you"
                note="Based on what you have logged and rated highly."
                domain="music"
                recs={{ loading: musicRecs.loading, problem: musicRecs.problem, count: musicRecs.items.length }}
                onRefresh={refreshMusicRecs}
              >
                <MediaGrid>
                  {musicRecs.items.map((item) => (
                    <MusicCard
                      key={item.id}
                      item={item}
                      explanation={item.explanation}
                      stretch={item.confidence === "discovery"}
                      onQueue={handleAddToQueue}
                      queued={queuedIds.has(item.id)}
                    />
                  ))}
                </MediaGrid>
              </PicksSection>
            </section>

            {/* Spotify — top tracks */}
            {spotifyOAuthLoading && (
              <MusicShelf
                title="Your top tracks"
                subtitle="Loading from Spotify"
                items={[]}
                loading
                queuedIds={queuedIds}
              />
            )}
            {spotifyOAuthConnected === true && (
              <MusicShelf
                title="Your top tracks"
                subtitle="Your most-played tracks on Spotify"
                items={spotifyTopTracks}
                onQueue={handleAddToQueue}
                queuedIds={queuedIds}
              />
            )}
            {spotifyOAuthConnected === false && (
              <Notice
                tone="info"
                title="Connect Spotify for personalised picks"
                action={
                  <Button
                    asChild
                    variant="outline"
                    className="shrink-0 border-[#1DB954] bg-[#1DB954] text-black hover:border-[#1DB954] hover:bg-[#1DB954]/85 hover:text-black"
                  >
                    <a href="/api/spotify/connect">Connect Spotify</a>
                  </Button>
                }
              >
                See your top tracks and what is rising in your listening once you connect your account.
              </Notice>
            )}

            {/* Personalised shelves — based on the artists logged most */}
            {personalMusicLoading ? (
              <MusicShelf
                title="From your library"
                subtitle="Based on artists you've logged"
                items={[]}
                loading
                queuedIds={queuedIds}
              />
            ) : (
              personalMusicRows.map((row) => (
                <MusicShelf
                  key={row.title}
                  title={row.title}
                  items={row.items}
                  onQueue={handleAddToQueue}
                  queuedIds={queuedIds}
                />
              ))
            )}
          </>
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
              <div
                role="tabpanel"
                id="discover-panel-browse"
                aria-labelledby="discover-tab-browse"
                className="flex flex-col gap-16"
              >
                <section>
                  <SectionHeader
                    title={selectedGenre ? `${selectedGenre.name} films` : "Pick a genre"}
                    className={selectedGenre ? "mb-3" : undefined}
                    action={
                      selectedGenre ? <ClearButton label="Clear genre" onClick={clearGenre} /> : undefined
                    }
                  />
                  {selectedGenre && <p className="t-meta mb-5">Top rated by audience score</p>}
                  <ToggleGroup
                    label="Genre"
                    options={FILM_GENRE_OPTIONS}
                    activeKey={selectedGenre ? String(selectedGenre.id) : null}
                    onToggle={handleGenreToggle}
                  />

                  {selectedGenre && (
                    <div className="mt-8">
                      {genreLoading ? (
                        <MediaGridSkeleton count={10} />
                      ) : genreError ? (
                        <Notice tone="error" title={`Couldn't load ${selectedGenre.name} films`}>
                          Check your connection, then pick the genre again.
                        </Notice>
                      ) : genreResults.length === 0 ? (
                        <div className="frame">
                          <EmptyState
                            icon={Film}
                            title="Nothing turned up for that genre."
                            description="Try another one."
                          />
                        </div>
                      ) : (
                        <MediaGrid>
                          {genreResults.map((item) => (
                            <FilmCard key={`${item.media_type}-${item.id}`} item={item} />
                          ))}
                        </MediaGrid>
                      )}
                    </div>
                  )}
                </section>

                {!selectedGenre && (
                  <>
                    {browseFailed && (
                      <Notice tone="error" title="Couldn't load films to browse">
                        Check your connection and reload the page.
                      </Notice>
                    )}

                    <FilmShelf title="Trending now" items={trending} loading={browseLoading} />

                    <FilmShelf
                      title="In cinemas now"
                      items={filterWatched(nowPlaying)}
                      loading={browseLoading}
                    />

                    {/* Picked from the watch history */}
                    {personalLoading ? (
                      <FilmShelf
                        title="Picked for you"
                        subtitle="Based on your watch history"
                        items={[]}
                        loading
                      />
                    ) : (
                      forYouRows.map((row) => (
                        <FilmShelf key={row.id} title={row.title} subtitle={row.subtitle} items={row.items} />
                      ))
                    )}

                    <FilmShelf
                      title="All-time greats"
                      subtitle="The highest rated films of all time"
                      items={filterWatched(topRated)}
                      loading={browseLoading}
                    />
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
