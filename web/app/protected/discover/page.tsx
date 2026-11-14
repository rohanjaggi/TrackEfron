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
import type { FilmRecommendation, MusicRecommendation, VibeSearchResult } from "@/lib/ai/types";
import type { SpotifyArtistResult } from "@/app/api/spotify/me/route";

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

type FilmRec = MediaItem & { explanation?: string; source?: string };
type MusicRec = MusicMediaItem & { explanation?: string };

type Tab = "for-you" | "browse";

// ─── Constants ───

const PROFILE_HREF = "/protected/profile";
const LOG_HREF = "/protected/log";
const SEARCH_RESULT_LIMIT = 10;
/** Postgres unique-violation: the row is already there. */
const DUPLICATE_ROW = "23505";

const MOODS = [
  { label: "Chill", query: "chill vibes" },
  { label: "Workout", query: "workout motivation" },
  { label: "Study", query: "study focus lofi" },
  { label: "Party", query: "party hits" },
  { label: "Sleep", query: "sleep calm ambient" },
  { label: "Focus", query: "deep focus concentration" },
];

const MUSIC_GENRE_QUERIES = [
  { title: "Hot in pop", subtitle: "Chart-topping pop releases", query: "pop hits" },
  { title: "Hip-hop now", subtitle: "Latest rap and hip-hop", query: "hip hop rap" },
];

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

const MOOD_OPTIONS = MOODS.map((m) => ({ key: m.label, label: m.label }));
const FILM_GENRE_OPTIONS = FILM_GENRES.map((g) => ({ key: String(g.id), label: g.name }));

const TABS = [
  { value: "for-you", label: "For you", icon: Sparkles },
  { value: "browse", label: "Browse", icon: Compass },
] as const;

// ─── Helpers ───

/** True when a query reads like a description ("something slow for a rainy night") rather than a title. */
function detectVibeQuery(q: string): boolean {
  const vibeWords = ["something", "vibe", "mood", "feel", "for a", "that feels", "like a", "similar to", "reminds me", "give me", "recommend", "suggest"];
  const lower = q.toLowerCase();
  return vibeWords.some((w) => lower.includes(w)) || (q.length > 20 && !q.includes('"'));
}

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
  };
}

function toFilmRec(r: FilmRecommendation): FilmRec {
  return {
    id: r.tmdb_id,
    title: r.title,
    media_type: r.media_type,
    poster_url: r.poster_url,
    explanation: r.explanation,
    source: r.source,
  };
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

// ─── Film pieces ───

function FilmCard({
  item,
  rank,
  onWatchlist,
  watchlisted,
}: {
  item: FilmRec;
  rank?: number;
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
      badge={rank != null ? <Badge variant="secondary">No. {rank}</Badge> : undefined}
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
  showType,
}: {
  item: MusicMediaItem;
  /** Leave out for things that cannot be queued (an artist). */
  onQueue?: (item: MusicMediaItem) => void;
  queued?: boolean;
  explanation?: string;
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

// ─── Page ───

export default function DiscoverPage() {
  const { mode } = useMode();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("for-you");

  // Music state
  const [newReleases, setNewReleases] = useState<MusicMediaItem[]>([]);
  const [musicLoading, setMusicLoading] = useState(false);
  const [musicFetched, setMusicFetched] = useState(false);
  const [queuedIds, setQueuedIds] = useState<Set<string>>(new Set());
  const [musicSearchResults, setMusicSearchResults] = useState<MusicMediaItem[]>([]);
  const [activeMood, setActiveMood] = useState<string | null>(null);
  const [moodResults, setMoodResults] = useState<MusicMediaItem[]>([]);
  const [moodLoading, setMoodLoading] = useState(false);
  const [moodError, setMoodError] = useState(false);
  const [musicGenreRows, setMusicGenreRows] = useState<{ title: string; subtitle: string; items: MusicMediaItem[] }[]>([]);
  const [musicGenreLoading, setMusicGenreLoading] = useState(false);
  const [musicGenreFetched, setMusicGenreFetched] = useState(false);
  const [personalMusicRows, setPersonalMusicRows] = useState<{ title: string; items: MusicMediaItem[] }[]>([]);
  const [personalMusicLoading, setPersonalMusicLoading] = useState(false);
  const [personalMusicFetched, setPersonalMusicFetched] = useState(false);
  const [spotifyTopTracks, setSpotifyTopTracks] = useState<MusicMediaItem[]>([]);
  const [spotifyTopArtists, setSpotifyTopArtists] = useState<SpotifyArtistResult[]>([]);
  const [spotifyOAuthConnected, setSpotifyOAuthConnected] = useState<boolean | null>(null);
  const [spotifyOAuthLoading, setSpotifyOAuthLoading] = useState(false);
  const [spotifyOAuthFetched, setSpotifyOAuthFetched] = useState(false);

  // Search (shared across modes). `searchQuery` is what is typed; `activeQuery` is what results are for.
  const [searchQuery, setSearchQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [searchRun, setSearchRun] = useState(0);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(false);
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

  // Browse data fetched flag
  const [browseFetched, setBrowseFetched] = useState(false);

  // Picks from the recommendation service (For you tab)
  const [mlRecs, setMlRecs] = useState<FilmRec[]>([]);
  const [mlLoading, setMlLoading] = useState(false);
  const [mlFetched, setMlFetched] = useState(false);
  const [watchlistedKeys, setWatchlistedKeys] = useState<Set<string>>(new Set());
  const [refreshStatus, setRefreshStatus] = useState<"idle" | "ok" | "error">("idle");

  // AI recommendations
  const [aiMusicRecs, setAiMusicRecs] = useState<MusicRec[]>([]);
  const [aiMusicLoading, setAiMusicLoading] = useState(false);
  const [aiMusicFetched, setAiMusicFetched] = useState(false);
  const [aiMusicError, setAiMusicError] = useState(false);
  const [aiFilmRecs, setAiFilmRecs] = useState<FilmRec[]>([]);
  const [aiFilmLoading, setAiFilmLoading] = useState(false);
  const [aiFilmFetched, setAiFilmFetched] = useState(false);
  const [aiFilmError, setAiFilmError] = useState(false);

  // Search by description
  const [vibeResults, setVibeResults] = useState<VibeSearchResult[]>([]);
  const [vibeInterpretation, setVibeInterpretation] = useState<string>("");
  const [isVibeQuery, setIsVibeQuery] = useState(false);

  // AI key status
  const [aiNotConfigured, setAiNotConfigured] = useState(false);

  // Guards: ignore a slow response once a newer request has been made; ignore a second press while saving.
  const moodRequest = useRef(0);
  const genreRequest = useRef(0);
  const savingIds = useRef(new Set<string>());
  // Mirrors `aiNotConfigured` so the search effect can read it without re-running when it flips.
  const noAiKey = useRef(false);
  useEffect(() => {
    noAiKey.current = aiNotConfigured;
  }, [aiNotConfigured]);

  // When the mode changes, drop the old mode's transient state in the same render so nothing stale paints.
  const [prevMode, setPrevMode] = useState(mode);
  if (prevMode !== mode) {
    setPrevMode(mode);
    setActiveTab("for-you");
    setSearchQuery("");
    setActiveQuery("");
    setSearchResults([]);
    setMusicSearchResults([]);
    setVibeResults([]);
    setVibeInterpretation("");
    setIsVibeQuery(false);
    setSearchLoading(false);
    setSearchError(false);
    setSearchNeedsKey(false);
    setActiveMood(null);
    setMoodResults([]);
    setMoodError(false);
    setMoodLoading(false);
    setSelectedGenre(null);
    setGenreResults([]);
    setGenreError(false);
    setGenreLoading(false);
  }
  // Late answers for a mood or genre picked in the old mode must not land in the new one.
  useEffect(() => {
    moodRequest.current++;
    genreRequest.current++;
  }, [mode]);

  // ─── Fetch music browse data (lazy — only when mode is music) ───
  useEffect(() => {
    if (mode !== "music" || musicFetched) return;
    setMusicFetched(true);
    setMusicLoading(true);

    async function fetchMusicBrowse() {
      try {
        const res = await fetch("/api/spotify?action=new-releases");
        const data = await res.json();
        if (Array.isArray(data)) setNewReleases(data);
      } catch {
        // The shelf simply stays hidden.
      } finally {
        setMusicLoading(false);
      }
    }

    fetchMusicBrowse();
  }, [mode, musicFetched]);

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

  // ─── Film watchlist keys (film mode only; reloaded on each visit) ───
  useEffect(() => {
    if (mode !== "film") return;
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
  }, [mode]);

  // ─── Music genre shelves (music mode; wait until Spotify connection is known so the shelf budget is exact) ───
  useEffect(() => {
    if (mode !== "music" || musicGenreFetched || !spotifyOAuthFetched || spotifyOAuthLoading) return;
    setMusicGenreFetched(true);
    setMusicGenreLoading(true);
    const queries = MUSIC_GENRE_QUERIES.slice(0, spotifyOAuthConnected ? 1 : 2);

    async function fetchMusicGenres() {
      try {
        const rows = await Promise.all(
          queries.map(async (g) => {
            try {
              const res = await fetch(`/api/spotify?action=search&q=${encodeURIComponent(g.query)}&type=album`);
              const data = await res.json();
              return { title: g.title, subtitle: g.subtitle, items: Array.isArray(data) ? data : [] };
            } catch {
              return { title: g.title, subtitle: g.subtitle, items: [] };
            }
          })
        );
        setMusicGenreRows(rows.filter((r) => r.items.length > 0));
      } finally {
        setMusicGenreLoading(false);
      }
    }

    fetchMusicGenres();
  }, [mode, musicGenreFetched, spotifyOAuthFetched, spotifyOAuthLoading, spotifyOAuthConnected]);

  // ─── Personalised music rows (lazy — top artists from listen_logs) ───
  useEffect(() => {
    if (mode !== "music" || personalMusicFetched) return;
    setPersonalMusicFetched(true);
    setPersonalMusicLoading(true);

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
  }, [mode, personalMusicFetched]);

  // ─── Fetch Spotify OAuth personalised data (lazy — top tracks & artists) ───
  useEffect(() => {
    if (mode !== "music" || spotifyOAuthFetched) return;
    setSpotifyOAuthFetched(true);
    setSpotifyOAuthLoading(true);

    async function fetchSpotifyOAuth() {
      try {
        const [tracksRes, artistsRes] = await Promise.all([
          fetch("/api/spotify/me?action=top-tracks"),
          fetch("/api/spotify/me?action=top-artists"),
        ]);
        const tracksData = await tracksRes.json();
        const artistsData = await artistsRes.json();

        if (tracksData.connected === false || artistsData.connected === false) {
          setSpotifyOAuthConnected(false);
          return;
        }
        setSpotifyOAuthConnected(true);
        if (Array.isArray(tracksData)) setSpotifyTopTracks(tracksData);
        if (Array.isArray(artistsData)) setSpotifyTopArtists(artistsData);
      } catch {
        setSpotifyOAuthConnected(false);
      } finally {
        setSpotifyOAuthLoading(false);
      }
    }

    fetchSpotifyOAuth();
  }, [mode, spotifyOAuthFetched]);

  // ─── Fetch picks from the recommendation service (lazy — only when the For you tab is first opened) ───
  useEffect(() => {
    if (mode !== "film" || activeTab !== "for-you" || mlFetched) return;
    setMlFetched(true);
    setMlLoading(true);

    async function fetchMlRecs() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const res = await fetch(`/api?action=recommend&user_id=${user.id}`);
        const data = await res.json();
        if (Array.isArray(data)) setMlRecs(data);
      } catch {
        // The recommendation service may not be running; AI picks or the empty state take over.
      } finally {
        setMlLoading(false);
      }
    }

    fetchMlRecs();
  }, [mode, activeTab, mlFetched]);

  // ─── Fetch AI music recommendations (lazy — only when mode is music) ───
  useEffect(() => {
    if (mode !== "music" || aiMusicFetched) return;
    setAiMusicFetched(true);
    setAiMusicLoading(true);

    async function fetchAiMusicRecs() {
      try {
        const res = await fetch("/api/ai/recommend?mode=music");
        const data = await res.json();
        if (data?.code === "NO_API_KEY") {
          setAiNotConfigured(true);
        } else if (Array.isArray(data)) {
          setAiMusicRecs((data as MusicRecommendation[]).map(toMusicRec));
        } else {
          setAiMusicError(true);
        }
      } catch {
        setAiMusicError(true);
      } finally {
        setAiMusicLoading(false);
      }
    }

    fetchAiMusicRecs();
  }, [mode, aiMusicFetched]);

  // ─── Fetch AI film recommendations (lazy — only when For you tab + film mode) ───
  useEffect(() => {
    if (mode !== "film" || activeTab !== "for-you" || aiFilmFetched) return;
    setAiFilmFetched(true);
    setAiFilmLoading(true);

    async function fetchAiFilmRecs() {
      try {
        const res = await fetch("/api/ai/recommend?mode=film");
        const data = await res.json();
        if (Array.isArray(data)) {
          setAiFilmRecs((data as FilmRecommendation[]).map(toFilmRec));
        } else if (data?.code === "NO_API_KEY") {
          setAiNotConfigured(true);
        } else {
          setAiFilmError(true);
        }
      } catch {
        setAiFilmError(true);
      } finally {
        setAiFilmLoading(false);
      }
    }

    fetchAiFilmRecs();
  }, [mode, activeTab, aiFilmFetched]);

  // ─── Fetch browse data (lazy — only when browse tab is first opened) ───
  useEffect(() => {
    if (mode !== "film" || activeTab !== "browse" || browseFetched) return;
    setBrowseFetched(true);

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
  }, [mode, activeTab, browseFetched]);

  // ─── Search: typing settles into `activeQuery` after a pause; submitting does it at once ───
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setActiveQuery("");
      return;
    }
    const t = setTimeout(() => setActiveQuery(q), detectVibeQuery(q) ? 800 : 350);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // ─── Search: run whenever the settled query, the mode, or a manual submit changes ───
  useEffect(() => {
    const q = activeQuery;
    setSearchResults([]);
    setMusicSearchResults([]);
    setVibeResults([]);
    setVibeInterpretation("");
    setSearchError(false);
    setSearchNeedsKey(false);

    if (!q) {
      setIsVibeQuery(false);
      setSearchLoading(false);
      return;
    }

    let cancelled = false;
    const isVibe = detectVibeQuery(q);
    setIsVibeQuery(isVibe);
    setSearchLoading(true);

    /** The ordinary title search for the current mode. */
    async function titleSearch() {
      if (mode === "music") {
        const res = await fetch(`/api/spotify?action=search&q=${encodeURIComponent(q)}&type=album,track`);
        const data = await res.json();
        if (cancelled) return;
        if (Array.isArray(data)) setMusicSearchResults(data);
        else setSearchError(true);
      } else {
        const res = await fetch(`/api?action=search&q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (cancelled) return;
        if (Array.isArray(data)) setSearchResults(data);
        else setSearchError(true);
      }
    }

    /** No AI key: search the words as a title and note that describing a mood needs a key. */
    async function titleSearchWithoutKey() {
      setIsVibeQuery(false);
      setSearchNeedsKey(true);
      await titleSearch();
    }

    async function run() {
      try {
        if (isVibe && noAiKey.current) {
          await titleSearchWithoutKey();
        } else if (isVibe) {
          const res = await fetch("/api/ai/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: q, mode: mode === "music" ? "music" : "film" }),
          });
          const data = await res.json();
          if (cancelled) return;
          if (data?.code === "NO_API_KEY") {
            noAiKey.current = true;
            setAiNotConfigured(true);
            await titleSearchWithoutKey();
          } else if (Array.isArray(data?.results)) {
            setVibeResults(data.results as VibeSearchResult[]);
            setVibeInterpretation(data.interpretation || "");
          } else {
            setSearchError(true);
          }
        } else {
          await titleSearch();
        }
      } catch {
        if (!cancelled) setSearchError(true);
      } finally {
        if (!cancelled) setSearchLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [activeQuery, mode, searchRun]);

  // ─── Handlers ───

  function handleSearchSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    setActiveQuery(q);
    setSearchRun((n) => n + 1);
  }

  function clearSearch() {
    setSearchQuery("");
    setActiveQuery("");
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

  async function handleAddToQueue(item: MusicMediaItem) {
    const key = `queue-${item.id}`;
    if (savingIds.current.has(key)) return;
    savingIds.current.add(key);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ mark: "Failed", tone: "error", title: "Sign in to add to your queue" });
        return;
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
        return;
      }
      setQueuedIds((prev) => new Set([...prev, item.id]));
      if (error) toast({ tone: "info", title: `${item.name} is already in your queue` });
      else toast({ mark: "Added", title: `${item.name} added to your queue` });
    } catch {
      toast({
        mark: "Failed",
        tone: "error",
        title: `Couldn't add ${item.name} to your queue`,
        description: "Check your connection and try again.",
      });
    } finally {
      savingIds.current.delete(key);
    }
  }

  async function handleRefreshMlRecs() {
    setMlLoading(true);
    setRefreshStatus("idle");
    try {
      const res = await fetch("/api?action=refresh_profile", { method: "POST" });
      setRefreshStatus(res.ok ? "ok" : "error");
    } catch {
      setRefreshStatus("error");
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
    setMlRecs([]);
    setMlFetched(false);
  }

  async function handleRefreshAiMusicRecs() {
    setAiMusicLoading(true);
    setAiMusicError(false);
    try {
      const res = await fetch("/api/ai/recommend?mode=music&refresh=true");
      const data = await res.json();
      if (Array.isArray(data)) {
        setAiMusicRecs((data as MusicRecommendation[]).map(toMusicRec));
        toast({ mark: "Updated", title: "Your recommendations are fresh" });
      } else if (data?.code === "NO_API_KEY") {
        setAiNotConfigured(true);
      } else {
        throw new Error("refresh failed");
      }
    } catch {
      toast({
        mark: "Failed",
        tone: "error",
        title: "Couldn't refresh your recommendations",
        description: "Try again in a moment.",
      });
    } finally {
      setAiMusicLoading(false);
    }
  }

  async function handleRefreshAiFilmRecs() {
    setAiFilmLoading(true);
    setAiFilmError(false);
    try {
      const res = await fetch("/api/ai/recommend?mode=film&refresh=true");
      const data = await res.json();
      if (Array.isArray(data)) {
        setAiFilmRecs((data as FilmRecommendation[]).map(toFilmRec));
      } else if (data?.code !== "NO_API_KEY") {
        setAiFilmError(true);
      }
    } catch {
      setAiFilmError(true);
    } finally {
      setAiFilmLoading(false);
    }
  }

  function handleRefreshFilmRecs() {
    handleRefreshMlRecs();
    handleRefreshAiFilmRecs();
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

  function clearMood() {
    moodRequest.current++;
    setActiveMood(null);
    setMoodResults([]);
    setMoodError(false);
    setMoodLoading(false);
  }

  async function handleMoodToggle(key: string) {
    const mood = MOODS.find((m) => m.label === key);
    if (!mood || activeMood === mood.label) {
      clearMood();
      return;
    }
    const request = ++moodRequest.current;
    setActiveMood(mood.label);
    setMoodResults([]);
    setMoodError(false);
    setMoodLoading(true);
    try {
      const res = await fetch(`/api/spotify?action=search&q=${encodeURIComponent(mood.query)}&type=album,track`);
      const data = await res.json();
      if (request !== moodRequest.current) return;
      if (Array.isArray(data)) setMoodResults(data);
      else setMoodError(true);
    } catch {
      if (request === moodRequest.current) setMoodError(true);
    } finally {
      if (request === moodRequest.current) setMoodLoading(false);
    }
  }

  const filterWatched = (items: MediaItem[]) =>
    watchedKeys.size > 0 ? items.filter((i) => !watchedKeys.has(titleKey(i.media_type, i.id))) : items;

  // ─── Derived ───

  const isMusic = mode === "music";

  const filmRecs = aiFilmRecs.length > 0 ? aiFilmRecs : mlRecs;
  const filmRecsLoading = mlLoading || aiFilmLoading;

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
                  ? "Type a title or an artist, or describe what you are in the mood for, like “something calm for late at night”."
                  : "Type a title, or describe what you are in the mood for, like “something tense and slow”."
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
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Button type="submit">Search</Button>
              </div>
            </Field>
          </form>

          {activeQuery && (
            <div className="mt-10">
              <SectionHeader
                title={`Results for “${activeQuery}”`}
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
                    <Button variant="outline" size="sm" onClick={() => setSearchRun((n) => n + 1)}>
                      Try again
                    </Button>
                  </div>
                </Notice>
              ) : searchCount === 0 ? (
                <div className="frame">
                  <EmptyState
                    icon={Search}
                    title={`Nothing matched “${activeQuery}”.`}
                    description={
                      isVibeQuery
                        ? "Try describing it another way, or search by title."
                        : "Check the spelling, or try a shorter title."
                    }
                  />
                </div>
              ) : (
                <>
                  {isVibeQuery && vibeInterpretation && (
                    <p className="t-meta mb-5 max-w-[62ch]">{vibeInterpretation}</p>
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
                          onQueue={handleAddToQueue}
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
            {/* Mood */}
            <section>
              <SectionHeader
                title={activeMood ? `${activeMood} music` : "Pick a mood"}
                action={activeMood ? <ClearButton label="Clear mood" onClick={clearMood} /> : undefined}
              />
              <ToggleGroup label="Mood" options={MOOD_OPTIONS} activeKey={activeMood} onToggle={handleMoodToggle} />

              {activeMood && (
                <div className="mt-8">
                  {moodLoading ? (
                    <MediaGridSkeleton count={10} aspect="square" />
                  ) : moodError ? (
                    <Notice tone="error" title="Couldn't load that mood">
                      Check your connection, then pick the mood again.
                    </Notice>
                  ) : moodResults.length === 0 ? (
                    <div className="frame">
                      <EmptyState
                        icon={Disc3}
                        title="Nothing turned up for that mood."
                        description="Try another one."
                      />
                    </div>
                  ) : (
                    <MediaGrid>
                      {moodResults.map((item) => (
                        <MusicCard
                          key={item.id}
                          item={item}
                          onQueue={handleAddToQueue}
                          queued={queuedIds.has(item.id)}
                        />
                      ))}
                    </MediaGrid>
                  )}
                </div>
              )}
            </section>

            {/* For you */}
            {!activeMood && (
              <section>
                <SectionHeader
                  title="For you"
                  className="mb-3"
                  meta={!aiMusicLoading && aiMusicRecs.length > 0 ? `${aiMusicRecs.length} picks` : undefined}
                  action={
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRefreshAiMusicRecs}
                      disabled={aiMusicLoading}
                    >
                      <RefreshCw aria-hidden="true" />
                      {aiMusicLoading ? "Refreshing" : "Refresh"}
                    </Button>
                  }
                />
                <p className="t-meta mb-5">Based on what you have logged and rated highly.</p>

                {aiMusicLoading ? (
                  <>
                    <LoadingLine label="Finding picks for you" className="mb-5" />
                    <MediaGridSkeleton count={10} aspect="square" />
                  </>
                ) : aiMusicRecs.length > 0 ? (
                  <MediaGrid>
                    {aiMusicRecs.map((item) => (
                      <MusicCard
                        key={item.id}
                        item={item}
                        explanation={item.explanation}
                        onQueue={handleAddToQueue}
                        queued={queuedIds.has(item.id)}
                      />
                    ))}
                  </MediaGrid>
                ) : aiNotConfigured ? (
                  <div className="frame">
                    <EmptyState
                      icon={Sparkles}
                      title="Recommendations need an AI key."
                      description="These picks are written using your own AI key, and none is saved yet. Add one in your profile and they will appear here."
                      action={<AiKeyLink />}
                    />
                  </div>
                ) : aiMusicError ? (
                  <Notice tone="error" title="Couldn't load your recommendations">
                    Something went wrong on our side. Press Refresh to try again.
                  </Notice>
                ) : (
                  <div className="frame">
                    <EmptyState
                      icon={Sparkles}
                      title="Nothing to go on yet."
                      description="Log some music and recommendations will appear here."
                      action={
                        <Button asChild variant="outline">
                          <Link href={LOG_HREF}>Log a listen</Link>
                        </Button>
                      }
                    />
                  </div>
                )}
              </section>
            )}

            {/* Spotify — top tracks and artists */}
            {!activeMood && spotifyOAuthLoading && (
              <MusicShelf
                title="Your top tracks"
                subtitle="Loading from Spotify"
                items={[]}
                loading
                queuedIds={queuedIds}
              />
            )}
            {!activeMood && spotifyOAuthConnected === true && (
              <>
                <MusicShelf
                  title="Your top tracks"
                  subtitle="Your most-played tracks on Spotify"
                  items={spotifyTopTracks}
                  onQueue={handleAddToQueue}
                  queuedIds={queuedIds}
                />
                <MusicShelf
                  title="Your top artists"
                  subtitle="Artists you listen to most"
                  items={spotifyTopArtists.map((a) => ({
                    id: a.id,
                    name: a.name,
                    artist: a.genres.slice(0, 2).join(", ") || "Artist",
                    album_name: "",
                    image_url: a.image_url,
                    release_date: "",
                    type: "album" as const,
                  }))}
                  queuedIds={queuedIds}
                />
              </>
            )}
            {!activeMood && spotifyOAuthConnected === false && (
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
                See your top tracks and artists right here once you connect your account.
              </Notice>
            )}

            {/* New releases */}
            {!activeMood && (
              <MusicShelf
                title="New releases"
                subtitle="New this week on Spotify"
                items={newReleases}
                loading={musicLoading}
                onQueue={handleAddToQueue}
                queuedIds={queuedIds}
              />
            )}

            {/* Personalised shelves — based on the artists logged most */}
            {!activeMood &&
              (personalMusicLoading ? (
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
              ))}

            {/* Genre shelves */}
            {!activeMood &&
              (musicGenreLoading || !musicGenreFetched
                ? MUSIC_GENRE_QUERIES.slice(0, 1).map((g) => (
                    <MusicShelf
                      key={g.title}
                      title={g.title}
                      subtitle={g.subtitle}
                      items={[]}
                      loading
                      queuedIds={queuedIds}
                    />
                  ))
                : musicGenreRows.map((row) => (
                    <MusicShelf
                      key={row.title}
                      title={row.title}
                      subtitle={row.subtitle}
                      items={row.items}
                      onQueue={handleAddToQueue}
                      queuedIds={queuedIds}
                    />
                  )))}
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
                <SectionHeader
                  title="Recommended for you"
                  className="mb-3"
                  meta={
                    filmRecsLoading
                      ? undefined
                      : refreshStatus === "ok"
                        ? "Updated"
                        : filmRecs.length > 0
                          ? `${filmRecs.length} picks`
                          : undefined
                  }
                  action={
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRefreshFilmRecs}
                      disabled={filmRecsLoading}
                    >
                      <RefreshCw aria-hidden="true" />
                      {filmRecsLoading ? "Refreshing" : "Refresh"}
                    </Button>
                  }
                />
                <p className="t-meta mb-5">Based on what you have rated highly.</p>

                {refreshStatus === "error" && !mlLoading && (
                  <Notice tone="error" title="Couldn't refresh your picks" className="mb-6">
                    The recommendation service didn&apos;t respond, so these may be out of date. Try again
                    in a few minutes.
                  </Notice>
                )}

                {filmRecsLoading && filmRecs.length === 0 ? (
                  <>
                    <LoadingLine label="Finding picks for you" className="mb-5" />
                    <MediaGridSkeleton count={10} />
                  </>
                ) : filmRecs.length > 0 ? (
                  <MediaGrid>
                    {filmRecs.map((item, idx) => (
                      <FilmCard
                        key={`rec-${item.id}-${idx}`}
                        item={item}
                        rank={idx + 1}
                        onWatchlist={handleAddToWatchlist}
                        watchlisted={watchlistedKeys.has(titleKey(item.media_type, item.id))}
                      />
                    ))}
                  </MediaGrid>
                ) : aiFilmError ? (
                  <Notice tone="error" title="Couldn't load your picks">
                    Something went wrong on our side. Press Refresh to try again.
                  </Notice>
                ) : (
                  <div className="frame">
                    <EmptyState
                      icon={Sparkles}
                      title="Log 5 or more watches to unlock personalised picks."
                      description="We need a few more ratings to learn your taste. Keep logging."
                      action={
                        <Button asChild variant="outline">
                          <Link href={LOG_HREF}>Log a watch</Link>
                        </Button>
                      }
                    />
                  </div>
                )}
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
