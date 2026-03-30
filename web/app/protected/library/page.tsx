"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  LayoutGrid,
  List,
  Search,
  Plus,
  Star,
  Film,
  Tv,
  Loader2,
  Pencil,
  Trash2,
  MoreVertical,
  ArrowUpDown,
  Disc3,
  Music2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import { useMode } from "@/lib/mode-context";

type ViewType = "grid" | "list";
// "film" = movies+tv, "music" = albums+tracks
type FilterType = "all" | "film" | "movies" | "tv" | "music" | "albums" | "tracks";
type SortType = "date_watched_desc" | "date_watched_asc" | "rating_desc" | "rating_asc" | "title_asc" | "title_desc" | "date_added_desc" | "date_added_asc";

const SORT_OPTIONS: { value: SortType; label: string }[] = [
  { value: "date_watched_desc", label: "Date Watched (Newest)" },
  { value: "date_watched_asc", label: "Date Watched (Oldest)" },
  { value: "rating_desc", label: "Rating (Highest)" },
  { value: "rating_asc", label: "Rating (Lowest)" },
  { value: "title_asc", label: "Title (A–Z)" },
  { value: "title_desc", label: "Title (Z–A)" },
  { value: "date_added_desc", label: "Date Added (Newest)" },
  { value: "date_added_asc", label: "Date Added (Oldest)" },
];

type WatchLog = {
  id: string;
  title: string;
  media_type: "movie" | "tv" | "album" | "track";
  rating: number;
  review: string | null;
  watched_date: string | null;
  poster_url: string | null;
  tmdb_id: number | null;
  created_at: string;
  artist?: string | null;
};

function upscalePoster(url: string | null, size = "w780"): string | null {
  if (!url) return null;
  return url.replace(/\/w\d+\//, `/${size}/`);
}

function StarDisplay({ rating, accent }: { rating: number; accent: string }) {
  const full = Math.floor(rating);
  const hasHalf = rating % 1 >= 0.5;
  const empty = 5 - full - (hasHalf ? 1 : 0);
  return (
    <span style={{ letterSpacing: "2px", fontSize: "11px", display: "inline-flex", alignItems: "center" }}>
      <span style={{ color: accent }}>{"★".repeat(full)}</span>
      {hasHalf && <span style={{ color: accent, opacity: 0.55 }}>★</span>}
      <span style={{ color: accent, opacity: 0.2 }}>{"★".repeat(empty)}</span>
    </span>
  );
}

export default function LibraryPage() {
  const router = useRouter();
  const { mode } = useMode();

  // Default filter and view depend on mode:
  // film mode → show film content by default (grid)
  // music mode → show music content by default (grid)
  // user picks "all" → list view (mixed aspect ratios don't work in grid)
  const defaultFilter: FilterType = mode === "music" ? "music" : "film";
  const [viewType, setViewType] = useState<ViewType>("grid");
  const [filter, setFilter] = useState<FilterType>(defaultFilter);
  const [sortBy, setSortBy] = useState<SortType | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [watchedItems, setWatchedItems] = useState<WatchLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // When mode changes externally, reset to the new default filter
  useEffect(() => {
    setFilter(mode === "music" ? "music" : "film");
    setViewType("grid");
  }, [mode]);

  async function fetchLibrary() {
    try {
      const supabase = createClient();
      const [filmRes, musicRes] = await Promise.all([
        supabase
          .from("watch_logs")
          .select("id, title, media_type, rating, review, watched_date, poster_url, tmdb_id, created_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("listen_logs")
          .select("id, title, media_type, rating, review, listened_date, image_url, created_at, artist")
          .order("created_at", { ascending: false }),
      ]);

      const filmItems: WatchLog[] = (filmRes.data || []);
      const musicItems: WatchLog[] = (musicRes.data || []).map((m) => ({
        id: m.id,
        title: m.title,
        media_type: m.media_type as "album" | "track",
        rating: m.rating,
        review: m.review,
        watched_date: m.listened_date,
        poster_url: m.image_url,
        tmdb_id: null,
        created_at: m.created_at,
        artist: m.artist,
      }));

      const combined = [...filmItems, ...musicItems].sort((a, b) =>
        b.created_at.localeCompare(a.created_at)
      );
      setWatchedItems(combined);
    } catch {
      // silently fail, will show empty state
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLibrary();
  }, []);

  async function handleDelete(id: string) {
    const item = watchedItems.find((i) => i.id === id);
    const isMusic = item?.media_type === "album" || item?.media_type === "track";
    setWatchedItems((prev) => prev.filter((i) => i.id !== id));
    setDeletingId(null);
    try {
      const supabase = createClient();
      await supabase.from(isMusic ? "listen_logs" : "watch_logs").delete().eq("id", id);
    } catch {
      fetchLibrary();
    }
  }

  const filteredItems = watchedItems
    .filter((item) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "film" && (item.media_type === "movie" || item.media_type === "tv")) ||
        (filter === "movies" && item.media_type === "movie") ||
        (filter === "tv" && item.media_type === "tv") ||
        (filter === "music" && (item.media_type === "album" || item.media_type === "track")) ||
        (filter === "albums" && item.media_type === "album") ||
        (filter === "tracks" && item.media_type === "track");

      const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesFilter && matchesSearch;
    })
    .sort((a, b) => {
      if (!sortBy) return 0;
      switch (sortBy) {
        case "date_watched_desc":
          return (b.watched_date || b.created_at).localeCompare(a.watched_date || a.created_at);
        case "date_watched_asc":
          return (a.watched_date || a.created_at).localeCompare(b.watched_date || b.created_at);
        case "rating_desc":
          return Number(b.rating) - Number(a.rating);
        case "rating_asc":
          return Number(a.rating) - Number(b.rating);
        case "title_asc":
          return a.title.localeCompare(b.title);
        case "title_desc":
          return b.title.localeCompare(a.title);
        case "date_added_desc":
          return b.created_at.localeCompare(a.created_at);
        case "date_added_asc":
          return a.created_at.localeCompare(b.created_at);
        default:
          return 0;
      }
    });

  const filmItems = watchedItems.filter((i) => i.media_type === "movie" || i.media_type === "tv");
  const musicItems = watchedItems.filter((i) => i.media_type === "album" || i.media_type === "track");

  const stats = {
    total: watchedItems.length,
    movies: watchedItems.filter((i) => i.media_type === "movie").length,
    tvShows: watchedItems.filter((i) => i.media_type === "tv").length,
    albums: watchedItems.filter((i) => i.media_type === "album").length,
    tracks: watchedItems.filter((i) => i.media_type === "track").length,
    avgRating: watchedItems.length > 0
      ? (watchedItems.reduce((acc, i) => acc + Number(i.rating), 0) / watchedItems.length).toFixed(1)
      : "—",
  };

  // Whether the current filter shows music content (square art) or film content (portrait art)
  const isFilmFilter = filter === "film" || filter === "movies" || filter === "tv";
  const isMusicFilter = filter === "music" || filter === "albums" || filter === "tracks";
  // In "all" mode, list view is better — auto-switch viewType
  const effectiveViewType = filter === "all" ? "list" : viewType;

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">My Library</h1>
            <p className="text-muted-foreground">
              {mode === "music"
                ? "Your albums and tracks, all in one place"
                : mode === "film"
                ? "Your watched movies and TV shows, all in one place"
                : "Your complete media collection"}
            </p>
          </div>
          <Button
            className="group font-semibold border-2"
            size="lg"
            onClick={() => router.push("/protected/log")}
          >
            <Plus className="w-4 h-4 mr-2 transition-transform group-hover:rotate-90" />
            {mode === "music" ? "Add to Library" : "Add to Library"}
          </Button>
        </div>

        {/* Stats Bar — adapts to current mode */}
        {mode === "music" ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="border-2 border-border p-4 hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
              <div className="text-2xl font-bold text-primary">{stats.albums + stats.tracks}</div>
              <p className="text-sm text-muted-foreground">Total Logged</p>
            </div>
            <div className="border-2 border-border p-4 hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
              <div className="text-2xl font-bold text-accent">{stats.albums}</div>
              <p className="text-sm text-muted-foreground">{stats.albums === 1 ? "Album" : "Albums"}</p>
            </div>
            <div className="border-2 border-border p-4 hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
              <div className="text-2xl font-bold text-secondary">{stats.tracks}</div>
              <p className="text-sm text-muted-foreground">{stats.tracks === 1 ? "Track" : "Tracks"}</p>
            </div>
            <div className="border-2 border-border p-4 hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
              <div className="flex items-center gap-1">
                <Star className="w-5 h-5 text-accent fill-accent" />
                <span className="text-2xl font-bold">{stats.avgRating}</span>
              </div>
              <p className="text-sm text-muted-foreground">Avg Rating</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="border-2 border-border p-4 hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
              <div className="text-2xl font-bold text-primary">{filmItems.length}</div>
              <p className="text-sm text-muted-foreground">Total Watched</p>
            </div>
            <div className="border-2 border-border p-4 hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
              <div className="text-2xl font-bold text-accent">{stats.movies}</div>
              <p className="text-sm text-muted-foreground">{stats.movies === 1 ? "Movie" : "Movies"}</p>
            </div>
            <div className="border-2 border-border p-4 hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
              <div className="text-2xl font-bold text-secondary">{stats.tvShows}</div>
              <p className="text-sm text-muted-foreground">{stats.tvShows === 1 ? "TV Show" : "TV Shows"}</p>
            </div>
            <div className="border-2 border-border p-4 hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
              <div className="flex items-center gap-1">
                <Star className="w-5 h-5 text-accent fill-accent" />
                <span className="text-2xl font-bold">{stats.avgRating}</span>
              </div>
              <p className="text-sm text-muted-foreground">Avg Rating</p>
            </div>
          </div>
        )}
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        {/* Filter Tabs — context-sensitive chips */}
        <div className="flex items-center gap-1 border-2 border-border p-1 flex-wrap">
          {/* Mode-specific primary filters */}
          {mode === "music" ? (
            <>
              <button
                onClick={() => { setFilter("music"); setViewType("grid"); }}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all ${
                  filter === "music"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Music2 className="w-4 h-4" />
                Music
              </button>
              <button
                onClick={() => { setFilter("albums"); setViewType("grid"); }}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all ${
                  filter === "albums"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Disc3 className="w-4 h-4" />
                Albums
              </button>
              <button
                onClick={() => { setFilter("tracks"); setViewType("grid"); }}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all ${
                  filter === "tracks"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Music2 className="w-4 h-4" />
                Tracks
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => { setFilter("film"); setViewType("grid"); }}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all ${
                  filter === "film"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Film className="w-4 h-4" />
                Film &amp; TV
              </button>
              <button
                onClick={() => { setFilter("movies"); setViewType("grid"); }}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all ${
                  filter === "movies"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Film className="w-4 h-4" />
                Movies
              </button>
              <button
                onClick={() => { setFilter("tv"); setViewType("grid"); }}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all ${
                  filter === "tv"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Tv className="w-4 h-4" />
                TV Shows
              </button>
            </>
          )}
          {/* "All" always available — switches to list view */}
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2 text-sm font-medium transition-all ${
              filter === "all"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title="Shows all media types in list view"
          >
            All
          </button>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Search */}
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search library..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-card/50 border-border/50 w-full sm:w-64"
            />
          </div>

          {/* Sort Icon */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={`p-2.5 border-2 transition-all duration-200 ${
                  sortBy
                    ? "border-primary text-primary hover:bg-primary/10"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-primary"
                }`}
                title="Sort"
              >
                <ArrowUpDown className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => setSortBy(null)}
                className={!sortBy ? "bg-primary/10 text-primary" : ""}
              >
                Default
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {SORT_OPTIONS.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onSelect={() => setSortBy(option.value)}
                  className={sortBy === option.value ? "bg-primary/10 text-primary" : ""}
                >
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* View Toggle — hidden in "all" mode since list is forced */}
          {filter !== "all" && (
            <div className="flex items-center gap-1 bg-card/50 border border-border/50 rounded-lg p-1">
              <button
                onClick={() => setViewType("grid")}
                className={`p-2 rounded transition-all ${
                  viewType === "grid"
                    ? "bg-primary/20 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Grid view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewType("list")}
                className={`p-2 rounded transition-all ${
                  viewType === "list"
                    ? "bg-primary/20 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="List view"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          )}
          {filter === "all" && (
            <div className="text-xs text-muted-foreground italic hidden sm:block">
              List view — mixed media
            </div>
          )}
        </div>
      </div>

      {/* "All" mode notice */}
      {filter === "all" && (
        <p className="text-xs text-muted-foreground -mt-4 italic">
          Showing all media types — list view used to handle mixed aspect ratios (film posters are 2:3, album covers are 1:1).
        </p>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-card/50 flex items-center justify-center mb-6">
            {isMusicFilter
              ? <Disc3 className="w-10 h-10 text-muted-foreground" />
              : <Film className="w-10 h-10 text-muted-foreground" />}
          </div>
          <h2 className="text-xl font-semibold mb-2">No items found</h2>
          <p className="text-muted-foreground mb-6 max-w-md">
            {searchQuery
              ? "No results match your search. Try different keywords."
              : isMusicFilter
              ? "Start logging albums and tracks to your library to see them here."
              : "Start adding movies and TV shows to your library to see them here."}
          </p>
          {!searchQuery && (
            <Button
              className="group font-semibold border-2"
              size="lg"
              onClick={() => router.push("/protected/log")}
            >
              <Plus className="w-4 h-4 mr-2 transition-transform group-hover:rotate-90" />
              {isMusicFilter ? "Log Your First Listen" : "Add Your First Item"}
            </Button>
          )}
        </div>
      ) : effectiveViewType === "grid" ? (
        /* ── GRID VIEW ─────────────────────────────────────────────
           Film filters → portrait 2:3 cards (5-col)
           Music filters → square 1:1 cards (5-col, slightly larger)
        ────────────────────────────────────────────────────────── */
        <div className={`grid gap-4 ${
          isMusicFilter
            ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
            : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
        }`}>
          {filteredItems.map((item) => {
            const isMusic = item.media_type === "album" || item.media_type === "track";
            const accent = isMusic ? "var(--music)" : "var(--film)";
            const typeLabel = item.media_type === "movie" ? "Movie"
              : item.media_type === "tv" ? "TV Show"
              : item.media_type === "album" ? "Album"
              : "Track";
            return (
              <div
                key={item.id}
                className="group cursor-pointer"
                style={{
                  position: "relative",
                  overflow: "hidden",
                  border: "1px solid var(--border-raw)",
                  transition: "border-color 0.2s",
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = "var(--border-hover)"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = "var(--border-raw)"}
                onClick={() => item.tmdb_id && router.push(`/protected/media/${item.media_type}/${item.tmdb_id}`)}
              >
                {/* Accent top line */}
                <div className="absolute top-0 left-0 right-0 h-px z-20" style={{ background: accent }} />

                {/* Art */}
                <div
                  className={isMusic ? "aspect-square" : "aspect-[2/3]"}
                  style={{ position: "relative", overflow: "hidden", background: "var(--surface-2)" }}
                >
                  {item.poster_url ? (
                    <img
                      src={upscalePoster(item.poster_url)!}
                      alt={item.title}
                      className="group-hover:scale-105 transition-transform duration-500"
                      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {item.media_type === "movie" ? <Film className="w-10 h-10" style={{ color: "var(--text-dim)" }} />
                        : item.media_type === "tv" ? <Tv className="w-10 h-10" style={{ color: "var(--text-dim)" }} />
                        : <Disc3 className="w-10 h-10" style={{ color: "var(--text-dim)" }} />}
                    </div>
                  )}

                  {/* Permanent bottom gradient */}
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{ background: "linear-gradient(to top, rgba(10,10,8,0.97) 0%, rgba(10,10,8,0.5) 38%, transparent 65%)" }}
                  />

                  {/* Info overlaid at bottom */}
                  <div className="absolute bottom-0 left-0 right-0 p-3 z-10">
                    <StarDisplay rating={item.rating} accent={accent} />
                    <h3
                      className="font-display leading-tight mt-1 mb-0.5"
                      style={{ fontSize: "13px", fontWeight: 700, color: "var(--text)", lineHeight: 1.25 }}
                    >
                      {item.title}
                    </h3>
                    {isMusic && item.artist && (
                      <p style={{ fontSize: "10px", color: accent, letterSpacing: "0.03em", marginBottom: "2px" }} className="truncate">
                        {item.artist}
                      </p>
                    )}
                    <p style={{ fontSize: "9px", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                      {typeLabel}
                      {item.watched_date && ` · ${new Date(item.watched_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`}
                    </p>
                  </div>

                  {/* Review hover overlay */}
                  {item.review && (
                    <div
                      className="absolute inset-0 flex items-end p-3 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10"
                      style={{ background: "rgba(10,10,8,0.88)" }}
                    >
                      <p className="text-[10px] italic line-clamp-5" style={{ color: "var(--text-muted)" }}>
                        &ldquo;{item.review}&rdquo;
                      </p>
                    </div>
                  )}

                  {/* Edit/Delete — top-left on hover */}
                  <div className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-20">
                    <button
                      onClick={(e) => { e.stopPropagation(); router.push(`/protected/log?edit=${item.id}`); }}
                      className="p-1.5 transition-colors"
                      style={{ background: "rgba(10,10,8,0.85)", border: "1px solid var(--border-hover)" }}
                      title="Edit"
                    >
                      <Pencil className="w-3 h-3" style={{ color: "var(--text)" }} />
                    </button>
                    {deletingId === item.id ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                        className="px-2 py-1 text-[10px] font-medium tracking-wide uppercase"
                        style={{ background: "#ef4444", color: "white", border: "1px solid transparent" }}
                      >
                        Confirm
                      </button>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeletingId(item.id); }}
                        className="p-1.5 transition-colors"
                        style={{ background: "rgba(10,10,8,0.85)", border: "1px solid var(--border-hover)" }}
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── LIST VIEW ─────────────────────────────────────────────
           Used for "All" mode and manually selected list view.
           Film thumbnails: portrait (w-14 h-20)
           Music thumbnails: square (w-14 h-14)
           Both coexist cleanly in list layout.
        ────────────────────────────────────────────────────────── */
        <div style={{ display: "flex", flexDirection: "column" }}>
          {filteredItems.map((item) => {
            const isMusic = item.media_type === "album" || item.media_type === "track";
            const accent = isMusic ? "var(--music)" : "var(--film)";
            const typeLabel = item.media_type === "movie" ? "Movie"
              : item.media_type === "tv" ? "TV Show"
              : item.media_type === "album" ? "Album"
              : "Track";
            return (
              <div
                key={item.id}
                className="group flex items-start gap-4 cursor-pointer"
                style={{
                  padding: "16px 0",
                  borderBottom: "1px solid var(--border-raw)",
                  transition: "opacity 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = "0.8"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = "1"}
                onClick={() => item.tmdb_id && router.push(`/protected/media/${item.media_type}/${item.tmdb_id}`)}
              >
                {/* Thumbnail */}
                <div
                  className="flex-shrink-0 overflow-hidden"
                  style={{
                    width: isMusic ? 48 : 40,
                    height: isMusic ? 48 : 60,
                    background: "var(--surface-2)",
                    border: "1px solid var(--border-raw)",
                  }}
                >
                  {item.poster_url ? (
                    <img src={upscalePoster(item.poster_url)!} alt={item.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      {item.media_type === "movie" ? <Film className="w-4 h-4" style={{ color: "var(--text-dim)" }} />
                        : item.media_type === "tv" ? <Tv className="w-4 h-4" style={{ color: "var(--text-dim)" }} />
                        : <Disc3 className="w-4 h-4" style={{ color: "var(--text-dim)" }} />}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h3
                    className="font-display truncate mb-0.5"
                    style={{ fontSize: "15px", fontWeight: 700, color: "var(--text)", lineHeight: 1.3 }}
                  >
                    {item.title}
                  </h3>
                  {isMusic && item.artist && (
                    <p style={{ fontSize: "11px", color: accent, marginBottom: "2px" }} className="truncate">
                      {item.artist}
                    </p>
                  )}
                  <p style={{ fontSize: "10px", letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                    {typeLabel}
                    {item.watched_date && ` · ${new Date(item.watched_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`}
                  </p>
                  {item.review && (
                    <p className="mt-1.5 text-[11px] italic line-clamp-2" style={{ color: "var(--text-muted)" }}>
                      &ldquo;{item.review}&rdquo;
                    </p>
                  )}
                </div>

                {/* Rating + actions */}
                <div className="flex-shrink-0 flex items-center gap-3">
                  <div className="text-right">
                    <StarDisplay rating={item.rating} accent={accent} />
                    <p style={{ fontSize: "10px", color: "var(--text-dim)", letterSpacing: "0.05em", marginTop: "2px" }}>
                      {item.rating}/5
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ color: "var(--text-muted)", border: "1px solid var(--border-raw)" }}
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => router.push(`/protected/log?edit=${item.id}`)}>
                        <Pencil className="w-4 h-4 mr-2" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => handleDelete(item.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
