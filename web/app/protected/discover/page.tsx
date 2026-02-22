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
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

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

// ─── Constants ───

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

// Mock recommendations — placeholder for ML model
const mockRecommendations = [
  {
    id: 1,
    title: "Better Call Saul",
    type: "TV Show",
    year: 2015,
    rating: 9.0,
    matchScore: 98,
    reason: "Because you loved Breaking Bad",
    genres: ["Drama", "Crime"],
  },
  {
    id: 2,
    title: "The Dark Knight",
    type: "Movie",
    year: 2008,
    rating: 9.0,
    matchScore: 95,
    reason: "Similar to Inception",
    genres: ["Action", "Crime", "Drama"],
  },
  {
    id: 3,
    title: "Succession",
    type: "TV Show",
    year: 2018,
    rating: 8.9,
    matchScore: 92,
    reason: "Based on your drama preferences",
    genres: ["Drama", "Comedy"],
  },
  {
    id: 4,
    title: "Dune",
    type: "Movie",
    year: 2021,
    rating: 8.0,
    matchScore: 89,
    reason: "Similar to Interstellar",
    genres: ["Sci-Fi", "Adventure"],
  },
  {
    id: 5,
    title: "Severance",
    type: "TV Show",
    year: 2022,
    rating: 8.7,
    matchScore: 87,
    reason: "Mind-bending like your favourites",
    genres: ["Drama", "Mystery", "Sci-Fi"],
  },
  {
    id: 6,
    title: "Oppenheimer",
    type: "Movie",
    year: 2023,
    rating: 8.4,
    matchScore: 85,
    reason: "From the director of Inception",
    genres: ["Biography", "Drama", "History"],
  },
];

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

function SkeletonCard() {
  return (
    <div className="shrink-0 w-[130px] md:w-[150px]">
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

// ─── Page ───

type Tab = "for-you" | "browse";

export default function DiscoverPage() {
  const router = useRouter();
  const searchRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<Tab>("for-you");

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

  // ─── Search ───
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    const t = setTimeout(async () => {
      try {
        setIsSearching(true);
        const res = await fetch(`/api?action=search&q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (Array.isArray(data)) {
          setSearchResults(data);
          setShowDropdown(true);
        }
      } catch {
        // silently fail
      } finally {
        setIsSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [searchQuery]);

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

  const filterWatched = (items: MediaItem[]) =>
    watchedIds.size > 0 ? items.filter((i) => !watchedIds.has(i.id)) : items;

  return (
    <div className="flex flex-col gap-6">
      {/* ─── Header ─── */}
      <div>
        <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">Discover</h1>
        <p className="text-muted-foreground">Find your next favourite movie or show</p>
      </div>

      {/* ─── Search ─── */}
      <div className="max-w-xl w-full" ref={searchRef}>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search movies and TV shows..."
            className="pl-11 py-5 text-base bg-card border-2 border-border"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
          />
          {isSearching && (
            <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
          )}
          {showDropdown && searchResults.length > 0 && (
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
        </div>
      </div>

      {/* ─── Tabs ─── */}
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

      {/* ─── FOR YOU TAB ─── */}
      {activeTab === "for-you" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Recommended For You</h2>
            </div>
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>

          {/* Placeholder banner */}
          <div className="border-2 border-dashed border-border p-6 bg-muted/5 text-center">
            <Sparkles className="w-8 h-8 text-primary/40 mx-auto mb-3" />
            <p className="text-sm font-medium mb-1">ML-Powered Recommendations Coming Soon</p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Personalised picks trained on your watch history, ratings, and taste profile. For now, here are some sample recommendations.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {mockRecommendations.map((item) => (
              <div
                key={item.id}
                className="group border-2 border-border overflow-hidden hover:border-primary transition-all duration-300 cursor-pointer"
              >
                {/* Poster Area */}
                <div className="aspect-[16/9] bg-gradient-to-br from-primary/20 via-accent/10 to-secondary/20 flex items-center justify-center relative">
                  {item.type === "Movie" ? (
                    <Film className="w-10 h-10 text-white/20" />
                  ) : (
                    <Tv className="w-10 h-10 text-white/20" />
                  )}
                  <div className="absolute top-2 right-2 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5">
                    {item.matchScore}% match
                  </div>
                </div>

                {/* Content */}
                <div className="p-4 space-y-2.5">
                  <div>
                    <h3 className="font-semibold group-hover:text-primary transition-colors">
                      {item.title}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <span>{item.type}</span>
                      <span>·</span>
                      <span>{item.year}</span>
                      <span>·</span>
                      <span className="flex items-center gap-0.5">
                        <Star className="w-2.5 h-2.5 text-accent fill-accent" />
                        {item.rating}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-primary/70 italic">
                    &ldquo;{item.reason}&rdquo;
                  </p>

                  <div className="flex flex-wrap gap-1.5">
                    {item.genres.map((genre) => (
                      <span key={genre} className="text-[10px] bg-muted/50 text-muted-foreground px-2 py-0.5">
                        {genre}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── BROWSE TAB ─── */}
      {activeTab === "browse" && (
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
