"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  Star,
  Film,
  Tv,
  TrendingUp,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Clapperboard,
  Calendar,
  Crown,
  Heart,
  Megaphone,
  Sparkles,
  X,
  Zap,
  RefreshCw,
  Compass,
  Bookmark,
  BookmarkCheck,
  Disc3,
  Music2,
  Headphones,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useMode } from "@/lib/mode-context";
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

// ─── Constants ───

const MOOD_PILLS = [
  { label: "Chill", query: "chill vibes" },
  { label: "Workout", query: "workout motivation" },
  { label: "Study", query: "study focus lofi" },
  { label: "Party", query: "party hits" },
  { label: "Sleep", query: "sleep calm ambient" },
  { label: "Focus", query: "deep focus concentration" },
];

const MUSIC_GENRE_QUERIES = [
  { title: "Hot in Pop", subtitle: "Chart-topping pop releases", query: "pop hits 2024" },
  { title: "Hip-Hop Now", subtitle: "Latest rap and hip-hop", query: "hip hop rap 2024" },
  { title: "R&B & Soul", subtitle: "Smooth soul and R&B", query: "r&b soul neo soul" },
  { title: "Electronic & Dance", subtitle: "Electronic beats and dance", query: "electronic dance edm" },
  { title: "Indie Picks", subtitle: "Independent and alternative", query: "indie alternative indie pop" },
  { title: "Jazz & Blues", subtitle: "Classic and contemporary", query: "jazz blues piano" },
];

const DEFAULT_GENRE_PILLS = [
  { id: 28, name: "Action" },
  { id: 35, name: "Comedy" },
  { id: 18, name: "Drama" },
  { id: 878, name: "Sci-Fi" },
  { id: 53, name: "Thriller" },
  { id: 27, name: "Horror" },
  { id: 10749, name: "Romance" },
  { id: 99, name: "Documentary" },
];


// ─── Explanation Tooltip ───

function ExplanationTooltip({ explanation, children }: { explanation?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  if (!explanation) return <>{children}</>;

  return (
    <div ref={ref} className="relative">
      {children}
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="absolute bottom-8 right-1.5 w-7 h-7 bg-primary text-primary-foreground flex items-center justify-center rounded-full shadow-md hover:scale-110 transition-transform z-10"
        title="Why this was recommended"
      >
        <Sparkles className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div
          className="absolute bottom-full left-0 right-0 mb-2 z-50 border-2 border-primary/30 bg-background p-3 shadow-lg"
          style={{ minWidth: "220px", maxWidth: "320px", width: "max-content" }}
        >
          <div className="flex items-start gap-2 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
            <span className="text-[10px] uppercase tracking-widest text-primary font-medium">Why this pick</span>
          </div>
          <p className="text-xs text-foreground leading-relaxed">{explanation}</p>
        </div>
      )}
    </div>
  );
}

// ─── RecMediaCard — MediaCard variant with inline watchlist button ───

function RecMediaCard({
  item,
  onClick,
  onWatchlist,
  watchlisted,
  rank,
}: {
  item: MediaItem;
  onClick: (item: MediaItem) => void;
  onWatchlist: (item: MediaItem) => void;
  watchlisted: boolean;
  rank?: number;
}) {
  const title = item.title || item.name || "Untitled";
  const year = (item.release_date || item.first_air_date || "").slice(0, 4);
  return (
    <div className="w-full group">
      <div className="relative cursor-pointer" onClick={() => onClick(item)}>
        {item.poster_url ? (
          <img
            src={item.poster_url}
            alt={title}
            className="w-full aspect-[2/3] object-cover border-2 border-border group-hover:border-primary transition-colors duration-200"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
        ) : (
          <div className="w-full aspect-[2/3] bg-muted/20 border-2 border-border flex items-center justify-center">
            <Film className="w-6 h-6 text-muted-foreground/50" />
          </div>
        )}
        {rank != null && (
          <span className="absolute bottom-0 left-0 bg-background/90 border-t-2 border-r-2 border-border px-1.5 py-0.5 text-xs font-bold text-primary font-display leading-none">
            #{rank}
          </span>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onWatchlist(item); }}
          disabled={watchlisted}
          className="absolute top-1.5 right-1.5 w-6 h-6 bg-background/80 border border-border flex items-center justify-center hover:bg-background transition-colors disabled:text-primary"
          title={watchlisted ? "On watchlist" : "Add to watchlist"}
        >
          {watchlisted
            ? <BookmarkCheck className="w-3 h-3 text-primary" />
            : <Bookmark className="w-3 h-3" />}
        </button>
      </div>
      <p className="text-sm font-medium truncate mt-1.5 group-hover:text-primary transition-colors cursor-pointer" onClick={() => onClick(item)}>
        {title}
      </p>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        {year && <span>{year}</span>}
        {year && item.vote_average != null && item.vote_average > 0 && <span>·</span>}
        {item.vote_average != null && item.vote_average > 0 && (
          <span className="flex items-center gap-0.5">
            <Star className="w-2.5 h-2.5 text-accent fill-accent" />
            {item.vote_average.toFixed(1)}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Shared Components ───

function MediaCard({ item, onClick }: { item: MediaItem; onClick: (item: MediaItem) => void }) {
  const title = item.title || item.name || "Untitled";
  const year = (item.release_date || item.first_air_date || "").slice(0, 4);
  return (
    <div
      onClick={() => onClick(item)}
      className="shrink-0 w-[130px] md:w-[150px] cursor-pointer group"
    >
      {item.poster_url ? (
        <img
          src={item.poster_url}
          alt={title}
          className="w-full aspect-[2/3] object-cover border-2 border-border group-hover:border-primary transition-colors duration-200"
          onError={(e) => { e.currentTarget.style.display = "none"; }}
        />
      ) : (
        <div className="w-full aspect-[2/3] bg-muted/20 border-2 border-border flex items-center justify-center">
          <Film className="w-6 h-6 text-muted-foreground/50" />
        </div>
      )}
      <p className="text-sm font-medium truncate mt-1.5 group-hover:text-primary transition-colors">
        {title}
      </p>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        {year && <span>{year}</span>}
        {year && item.vote_average != null && item.vote_average > 0 && <span>·</span>}
        {item.vote_average != null && item.vote_average > 0 && (
          <span className="flex items-center gap-0.5">
            <Star className="w-2.5 h-2.5 text-accent fill-accent" />
            {item.vote_average.toFixed(1)}
          </span>
        )}
      </div>
    </div>
  );
}

function SkeletonCard({ className }: { className?: string } = {}) {
  return (
    <div className={className ?? "shrink-0 w-[130px] md:w-[150px]"}>
      <div className="w-full aspect-[2/3] bg-muted/20 border-2 border-border animate-pulse" />
      <div className="h-3.5 bg-muted/20 rounded mt-1.5 w-3/4 animate-pulse" />
      <div className="h-3 bg-muted/20 rounded mt-1 w-1/2 animate-pulse" />
    </div>
  );
}

function MediaRow({
  title,
  subtitle,
  icon: Icon,
  items,
  loading,
  onItemClick,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ElementType;
  items: MediaItem[];
  loading?: boolean;
  onItemClick: (item: MediaItem) => void;
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
    if (el) {
      el.addEventListener("scroll", checkScroll, { passive: true });
      return () => el.removeEventListener("scroll", checkScroll);
    }
  }, [checkScroll, items]);

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.75;
    el.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  if (!loading && items.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          {Icon && <Icon className="w-4 h-4 text-primary shrink-0" />}
          <div className="min-w-0">
            <h2 className="font-display text-base md:text-lg font-bold truncate">{title}</h2>
            {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-2">
          {canScrollLeft && (
            <button onClick={() => scroll("left")} className="w-7 h-7 border border-border flex items-center justify-center hover:bg-muted/50 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          {canScrollRight && (
            <button onClick={() => scroll("right")} className="w-7 h-7 border border-border flex items-center justify-center hover:bg-muted/50 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-1"
        style={{ scrollbarWidth: "none" }}
      >
        {loading
          ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
          : items.map((item) => (
              <MediaCard
                key={`${item.media_type}-${item.id}`}
                item={item}
                onClick={onItemClick}
              />
            ))}
      </div>
    </div>
  );
}

function SectionDivider({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 pt-4 pb-1">
      <div className="w-8 h-8 border-2 border-border flex items-center justify-center shrink-0">
        <Icon className="w-3.5 h-3.5 text-primary" />
      </div>
      <div>
        <h2 className="font-display text-sm font-bold uppercase tracking-wider">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="flex-1 border-t border-border ml-2" />
    </div>
  );
}

// ─── Music Components ───

function MusicCard({
  item,
  onQueue,
  queued,
}: {
  item: MusicMediaItem;
  onQueue: (item: MusicMediaItem) => void;
  queued: boolean;
}) {
  return (
    <div className="shrink-0 w-[130px] md:w-[150px] group">
      <div className="relative">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.name}
            className="w-full aspect-square object-cover border-2 border-border group-hover:border-[var(--music)] transition-colors duration-200"
          />
        ) : (
          <div className="w-full aspect-square bg-muted/20 border-2 border-border flex items-center justify-center">
            <Disc3 className="w-6 h-6 text-muted-foreground/50" />
          </div>
        )}
        <button
          onClick={() => onQueue(item)}
          disabled={queued}
          className="absolute top-1.5 right-1.5 w-6 h-6 bg-background/80 border border-border flex items-center justify-center hover:bg-background transition-colors disabled:text-[var(--music)]"
          title={queued ? "In queue" : "Add to queue"}
        >
          {queued
            ? <BookmarkCheck className="w-3 h-3 text-[var(--music)]" />
            : <Bookmark className="w-3 h-3" />}
        </button>
      </div>
      <p className="text-sm font-medium truncate mt-1.5 group-hover:text-[var(--music)] transition-colors">
        {item.name}
      </p>
      <p className="text-xs text-muted-foreground truncate">{item.artist}</p>
    </div>
  );
}

function SkeletonMusicCard() {
  return (
    <div className="shrink-0 w-[130px] md:w-[150px]">
      <div className="w-full aspect-square bg-muted/20 border-2 border-border animate-pulse" />
      <div className="h-3.5 bg-muted/20 rounded mt-1.5 w-3/4 animate-pulse" />
      <div className="h-3 bg-muted/20 rounded mt-1 w-1/2 animate-pulse" />
    </div>
  );
}

function MusicRow({
  title,
  subtitle,
  icon: Icon,
  items,
  loading,
  onQueue,
  queuedIds,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ElementType;
  items: MusicMediaItem[];
  loading?: boolean;
  onQueue: (item: MusicMediaItem) => void;
  queuedIds: Set<string>;
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
    if (el) {
      el.addEventListener("scroll", checkScroll, { passive: true });
      return () => el.removeEventListener("scroll", checkScroll);
    }
  }, [checkScroll, items]);

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -el.clientWidth * 0.75 : el.clientWidth * 0.75, behavior: "smooth" });
  };

  if (!loading && items.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          {Icon && <Icon className="w-4 h-4 text-[var(--music)] shrink-0" />}
          <div className="min-w-0">
            <h2 className="font-display text-base md:text-lg font-bold truncate">{title}</h2>
            {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-2">
          {canScrollLeft && (
            <button onClick={() => scroll("left")} className="w-7 h-7 border border-border flex items-center justify-center hover:bg-muted/50 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          {canScrollRight && (
            <button onClick={() => scroll("right")} className="w-7 h-7 border border-border flex items-center justify-center hover:bg-muted/50 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      <div ref={scrollRef} className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {loading
          ? Array.from({ length: 8 }).map((_, i) => <SkeletonMusicCard key={i} />)
          : items.map((item) => (
              <MusicCard key={item.id} item={item} onQueue={onQueue} queued={queuedIds.has(item.id)} />
            ))}
      </div>
    </div>
  );
}

// ─── Page ───

type Tab = "for-you" | "browse";

export default function DiscoverPage() {
  const router = useRouter();
  const { mode } = useMode();
  const searchRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<Tab>("for-you");

  // Music state
  const [newReleases, setNewReleases] = useState<MusicMediaItem[]>([]);
  const [musicLoading, setMusicLoading] = useState(false);
  const [musicFetched, setMusicFetched] = useState(false);
  const [queuedIds, setQueuedIds] = useState<Set<string>>(new Set());
  const [musicSearchResults, setMusicSearchResults] = useState<MusicMediaItem[]>([]);
  const [activeMoodPill, setActiveMoodPill] = useState<string | null>(null);
  const [moodResults, setMoodResults] = useState<MusicMediaItem[]>([]);
  const [moodLoading, setMoodLoading] = useState(false);
  const [musicGenreRows, setMusicGenreRows] = useState<{ title: string; subtitle: string; items: MusicMediaItem[] }[]>([]);
  const [musicGenreLoading, setMusicGenreLoading] = useState(false);
  const [personalMusicRows, setPersonalMusicRows] = useState<{ title: string; items: MusicMediaItem[] }[]>([]);
  const [personalMusicLoading, setPersonalMusicLoading] = useState(false);
  const [personalMusicFetched, setPersonalMusicFetched] = useState(false);
  const [spotifyTopTracks, setSpotifyTopTracks] = useState<MusicMediaItem[]>([]);
  const [spotifyTopArtists, setSpotifyTopArtists] = useState<SpotifyArtistResult[]>([]);
  const [spotifyOAuthConnected, setSpotifyOAuthConnected] = useState<boolean | null>(null);
  const [spotifyOAuthLoading, setSpotifyOAuthLoading] = useState(false);
  const [spotifyOAuthFetched, setSpotifyOAuthFetched] = useState(false);

  // Search (shared across tabs)
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Browse tab state
  const [trending, setTrending] = useState<MediaItem[]>([]);
  const [nowPlaying, setNowPlaying] = useState<MediaItem[]>([]);
  const [upcoming, setUpcoming] = useState<MediaItem[]>([]);
  const [topRated, setTopRated] = useState<MediaItem[]>([]);
  const [browseLoading, setBrowseLoading] = useState(true);
  const [selectedGenre, setSelectedGenre] = useState<{ id: number; name: string } | null>(null);
  const [genreResults, setGenreResults] = useState<MediaItem[]>([]);
  const [genreLoading, setGenreLoading] = useState(false);

  // Personalized rows (browse tab, "Picked For You" section)
  const [forYouRows, setForYouRows] = useState<ForYouRow[]>([]);
  const [personalLoading, setPersonalLoading] = useState(true);
  const [watchedIds, setWatchedIds] = useState<Set<number>>(new Set());

  // Browse data fetched flag
  const [browseFetched, setBrowseFetched] = useState(false);

  // ML recommendations (For You tab)
  const [mlRecs, setMlRecs] = useState<MediaItem[]>([]);
  const [mlLoading, setMlLoading] = useState(false);
  const [mlFetched, setMlFetched] = useState(false);
  const [mlWatchlistedIds, setMlWatchlistedIds] = useState<Set<number>>(new Set());
  const [refreshStatus, setRefreshStatus] = useState<"idle" | "ok" | "error">("idle");

  // AI recommendations
  const [aiMusicRecs, setAiMusicRecs] = useState<(MusicMediaItem & { explanation?: string })[]>([]);
  const [aiMusicLoading, setAiMusicLoading] = useState(false);
  const [aiMusicFetched, setAiMusicFetched] = useState(false);
  const [aiFilmRecs, setAiFilmRecs] = useState<(MediaItem & { explanation?: string; source?: string })[]>([]);
  const [aiFilmLoading, setAiFilmLoading] = useState(false);
  const [aiFilmFetched, setAiFilmFetched] = useState(false);

  // Vibe search
  const [vibeResults, setVibeResults] = useState<any[]>([]);
  const [vibeInterpretation, setVibeInterpretation] = useState<string>("");
  const [vibeLoading, setVibeLoading] = useState(false);
  const [isVibeQuery, setIsVibeQuery] = useState(false);

  // AI key status
  const [aiNotConfigured, setAiNotConfigured] = useState(false);

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
        // silently fail
      } finally {
        setMusicLoading(false);
      }
    }

    async function fetchQueuedIds() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
          .from("music_queue")
          .select("spotify_id")
          .eq("user_id", user.id);
        if (data) setQueuedIds(new Set(data.map((i: { spotify_id: string }) => i.spotify_id).filter(Boolean)));
      } catch {
        // silently fail
      }
    }

    async function fetchMusicGenres() {
      setMusicGenreLoading(true);
      try {
        const rows = await Promise.all(
          MUSIC_GENRE_QUERIES.map(async (g) => {
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

    fetchMusicBrowse();
    fetchQueuedIds();
    fetchMusicGenres();
  }, [mode, musicFetched]);

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
          .not("artist", "is", null);
        if (!logs || logs.length === 0) return;

        // Count artist frequency and take top 3
        const freq = new Map<string, number>();
        logs.forEach((l: { artist: string | null }) => {
          if (!l.artist) return;
          // Use first artist if comma-separated
          const primary = l.artist.split(",")[0].trim();
          freq.set(primary, (freq.get(primary) || 0) + 1);
        });
        const topArtists = Array.from(freq.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
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
        // silently fail
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

  // ─── Fetch ML recommendations (lazy — only when For You tab is first opened) ───
  useEffect(() => {
    if (activeTab !== "for-you" || mlFetched) return;
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
        // silently fail — ML backend may not be running
      } finally {
        setMlLoading(false);
      }
    }

    fetchMlRecs();
  }, [activeTab, mlFetched]);

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
          setAiMusicRecs(data.map((r: any) => ({
            id: r.spotify_id || r.title,
            name: r.title,
            artist: r.artist,
            album_name: r.album_name || "",
            image_url: r.image_url || null,
            release_date: "",
            type: r.type || "album",
            explanation: r.explanation,
          })));
        }
      } catch {
        // AI endpoint may not be configured
      } finally {
        setAiMusicLoading(false);
      }
    }

    fetchAiMusicRecs();
  }, [mode, aiMusicFetched]);

  // ─── Fetch AI film recommendations (lazy — only when For You tab + film mode) ───
  useEffect(() => {
    if (mode === "music" || activeTab !== "for-you" || aiFilmFetched) return;
    setAiFilmFetched(true);
    setAiFilmLoading(true);

    async function fetchAiFilmRecs() {
      try {
        const res = await fetch("/api/ai/recommend?mode=film");
        const data = await res.json();
        if (Array.isArray(data)) {
          setAiFilmRecs(data.map((r: any) => ({
            id: r.tmdb_id,
            title: r.title,
            media_type: r.media_type,
            poster_url: r.poster_url,
            explanation: r.explanation,
            source: r.source,
          })));
        }
      } catch {
        // AI endpoint may not be configured
      } finally {
        setAiFilmLoading(false);
      }
    }

    fetchAiFilmRecs();
  }, [mode, activeTab, aiFilmFetched]);

  // ─── Fetch browse data (lazy — only when browse tab is first opened) ───
  useEffect(() => {
    if (activeTab !== "browse" || browseFetched) return;
    setBrowseFetched(true);

    async function fetchBrowse() {
      try {
        const [trendingRes, nowPlayingRes, upcomingRes, topRatedRes] = await Promise.all([
          fetch("/api?action=trending").then((r) => r.json()).catch(() => []),
          fetch("/api?action=now_playing").then((r) => r.json()).catch(() => []),
          fetch("/api?action=upcoming").then((r) => r.json()).catch(() => []),
          fetch("/api?action=top_rated&type=movie").then((r) => r.json()).catch(() => []),
        ]);
        if (Array.isArray(trendingRes)) setTrending(trendingRes);
        if (Array.isArray(nowPlayingRes)) setNowPlaying(nowPlayingRes);
        if (Array.isArray(upcomingRes)) setUpcoming(upcomingRes);
        if (Array.isArray(topRatedRes)) setTopRated(topRatedRes);
      } catch {
        // silently fail
      } finally {
        setBrowseLoading(false);
      }
    }

    async function fetchPersonalized() {
      try {
        const supabase = createClient();
        const { data: logs, error } = await supabase
          .from("watch_logs")
          .select("rating, media_type, tmdb_id, title")
          .order("rating", { ascending: false });

        if (error || !logs || logs.length === 0) {
          setPersonalLoading(false);
          return;
        }

        const watched = new Set<number>();
        logs.forEach((l) => { if (l.tmdb_id) watched.add(l.tmdb_id); });
        setWatchedIds(watched);

        const uniqueEntries = new Map<number, { type: "movie" | "tv"; rating: number; title: string }>();
        logs.forEach((l) => {
          if (l.tmdb_id && !uniqueEntries.has(l.tmdb_id)) {
            uniqueEntries.set(l.tmdb_id, { type: l.media_type, rating: l.rating, title: l.title });
          }
        });
        const entries = Array.from(uniqueEntries.entries()).slice(0, 20);

        type DetailResult = {
          tmdbId: number;
          genres: { id: number; name: string }[];
          directors: { id: number; name: string }[];
          mediaType: "movie" | "tv";
          rating: number;
          title: string;
        };
        const details: DetailResult[] = [];

        for (let i = 0; i < entries.length; i += 10) {
          const batch = entries.slice(i, i + 10);
          const results = await Promise.all(
            batch.map(async ([tmdbId, info]) => {
              try {
                const res = await fetch(`/api?action=detail&type=${info.type}&id=${tmdbId}`);
                if (!res.ok) return null;
                const d = await res.json();
                const genres = (d.genres || []).map((g: { id: number; name: string }) => ({ id: g.id, name: g.name }));
                const directors = (d.credits?.crew || [])
                  .filter((c: { job: string }) => c.job === "Director")
                  .map((c: { id: number; name: string }) => ({ id: c.id, name: c.name }));
                return { tmdbId, genres, directors, mediaType: info.type, rating: info.rating, title: info.title };
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

        // Top directors
        const dirCount = new Map<number, { name: string; count: number }>();
        details.forEach((d) => {
          d.directors.forEach((dir) => {
            const entry = dirCount.get(dir.id) || { name: dir.name, count: 0 };
            entry.count++;
            dirCount.set(dir.id, entry);
          });
        });
        const topDirectors = Array.from(dirCount.entries())
          .map(([id, { name, count }]) => ({ id, name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 2);

        // Highest rated for "similar to"
        const topTitles = details
          .sort((a, b) => b.rating - a.rating)
          .slice(0, 2);

        // Fetch all personalized rows in parallel
        const rowPromises: Promise<ForYouRow | null>[] = [];

        topGenres.forEach((genre) => {
          rowPromises.push(
            fetch(`/api?action=discover&type=movie&genres=${genre.id}`)
              .then((r) => r.json())
              .then((data) => {
                if (!Array.isArray(data)) return null;
                const filtered = data.filter((item: MediaItem) => !watched.has(item.id));
                if (filtered.length === 0) return null;
                return {
                  id: `genre-${genre.id}`,
                  title: `Because You Love ${genre.name}`,
                  subtitle: `Highly rated ${genre.name.toLowerCase()} picks`,
                  items: filtered.slice(0, 20),
                };
              })
              .catch(() => null)
          );
        });

        topDirectors.forEach((dir) => {
          rowPromises.push(
            fetch(`/api?action=person_credits&id=${dir.id}`)
              .then((r) => r.json())
              .then((data) => {
                if (!Array.isArray(data)) return null;
                const filtered = data.filter((item: MediaItem) => !watched.has(item.id));
                if (filtered.length === 0) return null;
                return {
                  id: `director-${dir.id}`,
                  title: `More from ${dir.name}`,
                  subtitle: `You've watched ${dir.count} of their ${dir.count === 1 ? "title" : "titles"}`,
                  items: filtered.slice(0, 20),
                };
              })
              .catch(() => null)
          );
        });

        topTitles.forEach((t) => {
          rowPromises.push(
            fetch(`/api?action=similar&type=${t.mediaType}&id=${t.tmdbId}`)
              .then((r) => r.json())
              .then((data) => {
                if (!Array.isArray(data)) return null;
                const filtered = data.filter((item: MediaItem) => !watched.has(item.id));
                if (filtered.length === 0) return null;
                return {
                  id: `similar-${t.tmdbId}`,
                  title: `Similar to ${t.title}`,
                  subtitle: `Because you rated it ${t.rating}/5`,
                  items: filtered.slice(0, 20),
                };
              })
              .catch(() => null)
          );
        });

        const rows = (await Promise.all(rowPromises)).filter((r): r is ForYouRow => r !== null);
        setForYouRows(rows);
      } catch {
        // silently fail
      } finally {
        setPersonalLoading(false);
      }
    }

    fetchBrowse();
    fetchPersonalized();
  }, [activeTab, browseFetched]);

  // ─── Vibe query detection ───
  function detectVibeQuery(q: string): boolean {
    const vibeWords = ["something", "vibe", "mood", "feel", "for a", "that feels", "like a", "similar to", "reminds me", "give me", "recommend", "suggest"];
    const lower = q.toLowerCase();
    return vibeWords.some((w) => lower.includes(w)) || (q.length > 20 && !q.includes('"'));
  }

  // ─── Search ───
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults([]);
      setMusicSearchResults([]);
      setVibeResults([]);
      setVibeInterpretation("");
      setIsVibeQuery(false);
      setShowDropdown(false);
      return;
    }

    const isVibe = detectVibeQuery(q);
    setIsVibeQuery(isVibe);

    if (isVibe) {
      const t = setTimeout(async () => {
        try {
          setVibeLoading(true);
          setShowDropdown(true);
          const res = await fetch("/api/ai/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: q, mode: mode === "music" ? "music" : "film" }),
          });
          const data = await res.json();
          if (data?.code === "NO_API_KEY") {
            setAiNotConfigured(true);
          } else if (data.results) {
            setVibeResults(data.results);
            setVibeInterpretation(data.interpretation || "");
          }
        } catch {
          // silently fail
        } finally {
          setVibeLoading(false);
        }
      }, 800);
      return () => clearTimeout(t);
    }

    const t = setTimeout(async () => {
      try {
        setIsSearching(true);
        if (mode === "music") {
          const res = await fetch(`/api/spotify?action=search&q=${encodeURIComponent(q)}&type=album,track`);
          const data = await res.json();
          if (Array.isArray(data)) {
            setMusicSearchResults(data);
            setShowDropdown(true);
          }
        } else {
          const res = await fetch(`/api?action=search&q=${encodeURIComponent(q)}`);
          const data = await res.json();
          if (Array.isArray(data)) {
            setSearchResults(data);
            setShowDropdown(true);
          }
        }
      } catch {
        // silently fail
      } finally {
        setIsSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [searchQuery, mode]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ─── Handlers ───

  async function handleAddMlToWatchlist(item: MediaItem) {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("watchlist").insert({
        user_id: user.id,
        tmdb_id: item.id,
        title: item.title || item.name || "Untitled",
        media_type: item.media_type,
        poster_url: item.poster_url || null,
      });
      setMlWatchlistedIds((prev) => new Set([...prev, item.id]));
    } catch {
      // silently fail (e.g. duplicate)
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
    try {
      const res = await fetch("/api/ai/recommend?mode=music&refresh=true");
      const data = await res.json();
      if (Array.isArray(data)) {
        setAiMusicRecs(data.map((r: any) => ({
          id: r.spotify_id || r.title,
          name: r.title,
          artist: r.artist,
          album_name: r.album_name || "",
          image_url: r.image_url || null,
          release_date: "",
          type: r.type || "album",
          explanation: r.explanation,
        })));
      }
    } catch {
      // silently fail
    } finally {
      setAiMusicLoading(false);
    }
  }

  async function handleRefreshAiFilmRecs() {
    setAiFilmLoading(true);
    try {
      const res = await fetch("/api/ai/recommend?mode=film&refresh=true");
      const data = await res.json();
      if (Array.isArray(data)) {
        setAiFilmRecs(data.map((r: any) => ({
          id: r.tmdb_id,
          title: r.title,
          media_type: r.media_type,
          poster_url: r.poster_url,
          explanation: r.explanation,
          source: r.source,
        })));
      }
    } catch {
      // silently fail
    } finally {
      setAiFilmLoading(false);
    }
  }

  async function handleGenreClick(genre: { id: number; name: string }) {
    if (selectedGenre?.id === genre.id) {
      setSelectedGenre(null);
      setGenreResults([]);
      return;
    }
    setSelectedGenre(genre);
    setGenreLoading(true);
    try {
      const res = await fetch(`/api?action=discover&type=movie&genres=${genre.id}`);
      const data = await res.json();
      if (Array.isArray(data)) setGenreResults(data);
    } catch {
      setGenreResults([]);
    } finally {
      setGenreLoading(false);
    }
  }

  function handleItemClick(item: MediaItem) {
    router.push(`/protected/media/${item.media_type}/${item.id}`);
  }

  function handleResultClick(result: SearchResult) {
    setShowDropdown(false);
    setSearchQuery("");
    router.push(`/protected/media/${result.media_type}/${result.id}`);
  }

  async function handleAddToQueue(item: MusicMediaItem) {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("music_queue").insert({
        user_id: user.id,
        spotify_id: item.id,
        media_type: item.type,
        title: item.name,
        artist: item.artist,
        image_url: item.image_url,
      });
      setQueuedIds((prev) => new Set([...prev, item.id]));
    } catch {
      // silently fail (e.g. duplicate)
    }
  }

  async function handleMoodClick(pill: { label: string; query: string }) {
    if (activeMoodPill === pill.label) {
      setActiveMoodPill(null);
      setMoodResults([]);
      return;
    }
    setActiveMoodPill(pill.label);
    setMoodLoading(true);
    try {
      const res = await fetch(`/api/spotify?action=search&q=${encodeURIComponent(pill.query)}&type=album,track`);
      const data = await res.json();
      if (Array.isArray(data)) setMoodResults(data);
    } catch {
      setMoodResults([]);
    } finally {
      setMoodLoading(false);
    }
  }

  const filterWatched = (items: MediaItem[]) =>
    watchedIds.size > 0 ? items.filter((i) => !watchedIds.has(i.id)) : items;

  return (
    <div className="flex flex-col gap-6">
      {/* ─── Header ─── */}
      <div>
        <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">Discover</h1>
        <p className="text-muted-foreground">
          {mode === "music"
            ? "Find your next favourite album or track"
            : "Find your next favourite movie or show"}
        </p>
      </div>

      {/* ─── Search ─── */}
      <div className="max-w-xl w-full" ref={searchRef}>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={mode === "music" ? "Search albums and tracks..." : "Search movies and TV shows..."}
            className="pl-11 py-5 text-base bg-card border-2 border-border"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => {
              if (mode === "music" && musicSearchResults.length > 0) setShowDropdown(true);
              if (mode !== "music" && searchResults.length > 0) setShowDropdown(true);
            }}
          />
          {(isSearching || vibeLoading) && (
            <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
          )}
          {isVibeQuery && <span className="absolute right-10 top-1/2 -translate-y-1/2 text-xs text-primary flex items-center gap-1"><Sparkles className="w-3 h-3" />Vibe</span>}
          {/* Vibe search dropdown */}
          {showDropdown && isVibeQuery && (vibeResults.length > 0 || vibeLoading) && (
            <div className="absolute top-full left-0 right-0 z-50 border-2 border-border bg-card mt-1 max-h-96 overflow-auto shadow-lg">
              {vibeInterpretation && (
                <div className="px-4 py-2 border-b border-border bg-primary/5">
                  <p className="text-xs text-primary flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3" />
                    {vibeInterpretation}
                  </p>
                </div>
              )}
              {vibeLoading ? (
                <div className="px-4 py-6 text-center">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Finding the perfect match...</p>
                </div>
              ) : (
                vibeResults.map((result: any, i: number) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setShowDropdown(false);
                      setSearchQuery("");
                      if (result.tmdb_id) {
                        router.push(`/protected/media/${result.type === "tv" ? "tv" : "movie"}/${result.tmdb_id}`);
                      } else if (result.spotify_id) {
                        handleAddToQueue({
                          id: result.spotify_id,
                          name: result.title,
                          artist: result.artist || "",
                          album_name: "",
                          image_url: result.image_url || null,
                          release_date: "",
                          type: result.type || "album",
                        });
                      }
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-muted/50 flex gap-3 items-center transition-colors"
                  >
                    {(result.image_url || result.poster_url) ? (
                      <img
                        src={result.image_url || result.poster_url}
                        alt={result.title}
                        className={`${mode === "music" ? "w-10 h-10" : "w-8 h-12"} object-cover shrink-0 border border-border`}
                      />
                    ) : (
                      <div className={`${mode === "music" ? "w-10 h-10" : "w-8 h-12"} bg-muted/30 flex items-center justify-center shrink-0 border border-border`}>
                        {mode === "music" ? <Disc3 className="w-4 h-4 text-muted-foreground" /> : <Film className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{result.title}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {result.artist && <span>{result.artist} · </span>}
                        {result.year && <span>{result.year} · </span>}
                        {result.why}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
          {/* Film search dropdown */}
          {mode !== "music" && showDropdown && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-50 border-2 border-border bg-card mt-1 max-h-80 overflow-auto shadow-lg">
              {searchResults.slice(0, 8).map((result) => {
                const label = result.title || result.name || "Untitled";
                const year = (result.release_date || result.first_air_date || "").slice(0, 4);
                return (
                  <button
                    key={`${result.media_type}-${result.id}`}
                    type="button"
                    onClick={() => handleResultClick(result)}
                    className="w-full text-left px-4 py-3 hover:bg-muted/50 flex gap-3 items-center transition-colors"
                  >
                    {result.poster_url ? (
                      <img src={result.poster_url} alt={label} className="w-8 h-12 object-cover shrink-0 border border-border" />
                    ) : (
                      <div className="w-8 h-12 bg-muted/30 flex items-center justify-center shrink-0 border border-border">
                        {result.media_type === "movie" ? <Film className="w-4 h-4 text-muted-foreground" /> : <Tv className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{label}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <span>{result.media_type === "movie" ? "Movie" : "TV Show"}</span>
                        {year && <><span>·</span><span>{year}</span></>}
                        {result.vote_average != null && result.vote_average > 0 && (
                          <><span>·</span><span className="flex items-center gap-0.5"><Star className="w-2.5 h-2.5 text-accent fill-accent" />{result.vote_average.toFixed(1)}</span></>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          {/* Music search dropdown */}
          {mode === "music" && showDropdown && musicSearchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-50 border-2 border-border bg-card mt-1 max-h-80 overflow-auto shadow-lg">
              {musicSearchResults.slice(0, 8).map((result) => (
                <button
                  key={result.id}
                  type="button"
                  onClick={() => {
                    setShowDropdown(false);
                    setSearchQuery("");
                    handleAddToQueue(result);
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-muted/50 flex gap-3 items-center transition-colors"
                >
                  {result.image_url ? (
                    <img src={result.image_url} alt={result.name} className="w-10 h-10 object-cover shrink-0 border border-border" />
                  ) : (
                    <div className="w-10 h-10 bg-muted/30 flex items-center justify-center shrink-0 border border-border">
                      <Disc3 className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{result.name}</div>
                    <div className="text-xs flex items-center gap-2">
                      <span className="text-[var(--music)] truncate">{result.artist}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground">{result.type === "album" ? "Album" : "Track"}</span>
                      {result.release_date && <><span className="text-muted-foreground">·</span><span className="text-muted-foreground">{result.release_date.slice(0, 4)}</span></>}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">+ Queue</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── MUSIC MODE ─── */}
      {mode === "music" && (
        <div className="flex flex-col gap-6">
          {/* Mood pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            <span className="text-xs text-muted-foreground uppercase tracking-wider shrink-0 mr-1">Mood</span>
            {MOOD_PILLS.map((pill) => (
              <button
                key={pill.label}
                onClick={() => handleMoodClick(pill)}
                className={`shrink-0 px-3 py-1.5 text-xs font-medium border-2 transition-colors ${
                  activeMoodPill === pill.label
                    ? "border-[var(--music)] bg-[var(--music)] text-background"
                    : "border-border hover:border-[var(--music)]/50"
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>

          {/* Mood results */}
          {activeMoodPill && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-display text-lg font-bold">{activeMoodPill} Music</h2>
                  <p className="text-xs text-muted-foreground">Albums and tracks for {activeMoodPill.toLowerCase()} vibes</p>
                </div>
                <button
                  onClick={() => { setActiveMoodPill(null); setMoodResults([]); }}
                  className="w-7 h-7 border border-border flex items-center justify-center hover:bg-muted/50 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {moodLoading ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-3">
                  {Array.from({ length: 14 }).map((_, i) => <SkeletonMusicCard key={i} />)}
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-3">
                  {moodResults.map((item) => (
                    <MusicCard key={item.id} item={item} onQueue={handleAddToQueue} queued={queuedIds.has(item.id)} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* AI Music Recommendations — For You */}
          {!activeMoodPill && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[var(--music)]" />
                  <h2 className="text-xl font-semibold">For You</h2>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={handleRefreshAiMusicRecs}
                  disabled={aiMusicLoading}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${aiMusicLoading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>

              {aiMusicLoading ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-3">
                  {Array.from({ length: 14 }).map((_, i) => <SkeletonMusicCard key={i} />)}
                </div>
              ) : aiMusicRecs.length > 0 ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-3">
                  {aiMusicRecs.map((item) => (
                    <ExplanationTooltip key={item.id} explanation={item.explanation}>
                      <MusicCard item={item} onQueue={handleAddToQueue} queued={queuedIds.has(item.id)} />
                    </ExplanationTooltip>
                  ))}
                </div>
              ) : !aiMusicLoading ? (
                <div className="border-2 border-dashed border-border p-8 text-center">
                  <Sparkles className="w-6 h-6 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {aiNotConfigured
                      ? "Add an AI API key in your profile settings to unlock personalized recommendations."
                      : "Log some music to get AI-powered recommendations"}
                  </p>
                </div>
              ) : null}
            </div>
          )}

          {/* Spotify OAuth — top tracks & artists */}
          {!activeMoodPill && spotifyOAuthLoading && (
            <MusicRow
              title="Your Top Tracks"
              subtitle="Loading from Spotify..."
              icon={TrendingUp}
              items={[]}
              loading
              onQueue={handleAddToQueue}
              queuedIds={queuedIds}
            />
          )}
          {!activeMoodPill && spotifyOAuthConnected === true && (
            <>
              {spotifyTopTracks.length > 0 && (
                <MusicRow
                  title="Your Top Tracks"
                  subtitle="Your most-played tracks on Spotify"
                  icon={TrendingUp}
                  items={spotifyTopTracks}
                  onQueue={handleAddToQueue}
                  queuedIds={queuedIds}
                />
              )}
              {spotifyTopArtists.length > 0 && (
                <MusicRow
                  title="Your Top Artists"
                  subtitle="Artists you listen to most"
                  icon={TrendingUp}
                  items={spotifyTopArtists.map((a) => ({
                    id: a.id,
                    name: a.name,
                    artist: a.genres.slice(0, 2).join(", ") || "Artist",
                    album_name: "",
                    image_url: a.image_url,
                    release_date: "",
                    type: "album" as const,
                  }))}
                  onQueue={handleAddToQueue}
                  queuedIds={queuedIds}
                />
              )}
            </>
          )}
          {!activeMoodPill && spotifyOAuthConnected === false && (
            <div
              className="border-2 p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4"
              style={{ borderColor: "var(--border-raw)", background: "var(--surface)" }}
            >
              <div
                className="w-10 h-10 flex items-center justify-center border-2 shrink-0"
                style={{ borderColor: "#1DB954", color: "#1DB954" }}
              >
                <Disc3 className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium mb-0.5">Connect Spotify for personalised picks</p>
                <p className="text-xs text-muted-foreground">
                  See your top tracks and artists right here once you connect your account.
                </p>
              </div>
              <a href="/api/spotify/connect" className="shrink-0">
                <button
                  className="px-4 py-2 text-sm font-medium border-2"
                  style={{ backgroundColor: "#1DB954", color: "#000", borderColor: "#1DB954" }}
                >
                  Connect Spotify
                </button>
              </a>
            </div>
          )}

          {/* New Releases row */}
          {!activeMoodPill && (
            <MusicRow
              title="New Releases"
              subtitle="Fresh drops from Spotify"
              icon={Disc3}
              items={newReleases}
              loading={musicLoading}
              onQueue={handleAddToQueue}
              queuedIds={queuedIds}
            />
          )}

          {/* Personalised rows — based on top artists in listen_logs */}
          {!activeMoodPill && (
            <>
              {personalMusicLoading
                ? (
                  <MusicRow
                    title="From Your Library"
                    subtitle="Based on artists you've logged"
                    icon={Headphones}
                    items={[]}
                    loading
                    onQueue={handleAddToQueue}
                    queuedIds={queuedIds}
                  />
                )
                : personalMusicRows.map((row) => (
                  <MusicRow
                    key={row.title}
                    title={row.title}
                    icon={Headphones}
                    items={row.items}
                    onQueue={handleAddToQueue}
                    queuedIds={queuedIds}
                  />
                ))}
            </>
          )}

          {/* Genre rows */}
          {!activeMoodPill && (
            <>
              {musicGenreLoading
                ? MUSIC_GENRE_QUERIES.slice(0, 3).map((g) => (
                  <MusicRow
                    key={g.title}
                    title={g.title}
                    subtitle={g.subtitle}
                    icon={Music2}
                    items={[]}
                    loading
                    onQueue={handleAddToQueue}
                    queuedIds={queuedIds}
                  />
                ))
                : musicGenreRows.map((row) => (
                  <MusicRow
                    key={row.title}
                    title={row.title}
                    subtitle={row.subtitle}
                    icon={Music2}
                    items={row.items}
                    onQueue={handleAddToQueue}
                    queuedIds={queuedIds}
                  />
                ))}
            </>
          )}
        </div>
      )}

      {/* ─── FILM MODE — Tabs ─── */}
      {mode !== "music" && (
      <div className="flex items-center gap-1 border-b-2 border-border">
        <button
          onClick={() => setActiveTab("for-you")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors relative ${
            activeTab === "for-you"
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Sparkles className="w-4 h-4" />
          For You
          {activeTab === "for-you" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
          )}
        </button>
        <button
          onClick={() => setActiveTab("browse")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors relative ${
            activeTab === "browse"
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Compass className="w-4 h-4" />
          Browse
          {activeTab === "browse" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
          )}
        </button>
      </div>
      )}

      {/* ─── FOR YOU TAB ─── */}
      {mode !== "music" && activeTab === "for-you" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Recommended For You</h2>
            </div>
            <div className="flex items-center gap-2">
              {refreshStatus === "ok" && !mlLoading && !aiFilmLoading && (
                <span className="text-xs text-green-500">Updated</span>
              )}
              {refreshStatus === "error" && !mlLoading && (
                <span className="text-xs text-destructive">Refresh failed — ML server may be down</span>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => { handleRefreshMlRecs(); handleRefreshAiFilmRecs(); }}
                disabled={mlLoading || aiFilmLoading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${(mlLoading || aiFilmLoading) ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>

          {(mlLoading || aiFilmLoading) && aiFilmRecs.length === 0 && mlRecs.length === 0 ? (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-4 h-4 text-primary shrink-0" />
                <h2 className="font-display text-base md:text-lg font-bold">Your Picks</h2>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-3">
                {Array.from({ length: 20 }).map((_, i) => <SkeletonCard key={i} className="w-full" />)}
              </div>
            </div>
          ) : (aiFilmRecs.length > 0 ? aiFilmRecs : mlRecs).length === 0 ? (
            <div className="border-2 border-dashed border-border p-12 text-center">
              <Sparkles className="w-8 h-8 text-primary/40 mx-auto mb-3" />
              <p className="text-sm font-medium mb-1">Log 5 or more watches to unlock personalised picks</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                The ML engine needs enough signal to build your taste profile. Keep logging!
              </p>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-4 h-4 text-primary shrink-0" />
                <h2 className="font-display text-base md:text-lg font-bold">Your Picks</h2>
                <span className="text-xs text-muted-foreground border border-border px-1.5 py-0.5">{(aiFilmRecs.length > 0 ? aiFilmRecs : mlRecs).length} picks</span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-3">
                {(aiFilmRecs.length > 0 ? aiFilmRecs : mlRecs).map((item, idx) => (
                  <ExplanationTooltip key={`rec-${item.id}-${idx}`} explanation={(item as any).explanation}>
                    <RecMediaCard
                      item={item}
                      onClick={handleItemClick}
                      onWatchlist={handleAddMlToWatchlist}
                      watchlisted={mlWatchlistedIds.has(item.id)}
                      rank={idx + 1}
                    />
                  </ExplanationTooltip>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── BROWSE TAB ─── */}
      {mode !== "music" && activeTab === "browse" && (
        <div className="flex flex-col gap-6">
          {/* Genre Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            <span className="text-xs text-muted-foreground uppercase tracking-wider shrink-0 mr-1">Genre</span>
            {DEFAULT_GENRE_PILLS.map((genre) => (
              <button
                key={genre.id}
                onClick={() => handleGenreClick(genre)}
                className={`shrink-0 px-3 py-1.5 text-xs font-medium border-2 transition-colors ${
                  selectedGenre?.id === genre.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:border-primary/50"
                }`}
              >
                {genre.name}
              </button>
            ))}
          </div>

          {/* Genre Browse Results */}
          {selectedGenre && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-display text-lg font-bold">{selectedGenre.name} Movies</h2>
                  <p className="text-xs text-muted-foreground">Top rated by audience score</p>
                </div>
                <button
                  onClick={() => { setSelectedGenre(null); setGenreResults([]); }}
                  className="w-7 h-7 border border-border flex items-center justify-center hover:bg-muted/50 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {genreLoading ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-3">
                  {Array.from({ length: 14 }).map((_, i) => <SkeletonCard key={i} />)}
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-3">
                  {genreResults.map((item) => (
                    <MediaCard key={`${item.media_type}-${item.id}`} item={item} onClick={handleItemClick} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Browse Rows */}
          {!selectedGenre && (
            <>
              <MediaRow
                title="Trending Now"
                icon={TrendingUp}
                items={trending}
                loading={browseLoading}
                onItemClick={handleItemClick}
              />

              <MediaRow
                title="Now in Theatres"
                icon={Clapperboard}
                items={filterWatched(nowPlaying)}
                loading={browseLoading}
                onItemClick={handleItemClick}
              />

              <MediaRow
                title="Coming Soon"
                subtitle="Upcoming releases"
                icon={Calendar}
                items={filterWatched(upcoming)}
                loading={browseLoading}
                onItemClick={handleItemClick}
              />

              {/* Picked For You */}
              {(personalLoading || forYouRows.length > 0) && (
                <>
                  <SectionDivider icon={Sparkles} title="Picked For You" subtitle="Based on your watch history" />

                  {personalLoading ? (
                    <div className="space-y-6">
                      <MediaRow title="Loading recommendations..." items={[]} loading={true} onItemClick={handleItemClick} />
                      <MediaRow title="" items={[]} loading={true} onItemClick={handleItemClick} />
                    </div>
                  ) : (
                    forYouRows.map((row) => (
                      <MediaRow
                        key={row.id}
                        title={row.title}
                        subtitle={row.subtitle}
                        icon={
                          row.id.startsWith("genre-") ? Heart :
                          row.id.startsWith("director-") ? Megaphone :
                          Star
                        }
                        items={row.items}
                        onItemClick={handleItemClick}
                      />
                    ))
                  )}
                </>
              )}

              {/* All-Time Greats */}
              <SectionDivider icon={Crown} title="All-Time Greats" subtitle="The highest rated of all time" />

              <MediaRow
                title="Top Rated Movies"
                icon={Film}
                items={filterWatched(topRated)}
                loading={browseLoading}
                onItemClick={handleItemClick}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
