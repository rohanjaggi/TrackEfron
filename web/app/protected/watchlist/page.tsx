"use client";

import { useState, useEffect, useRef } from "react";
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
  Trash2,
  Check,
  Clock,
  Loader2
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type ViewType = "grid" | "list";
type FilterType = "all" | "movies" | "tv";

type WatchlistItem = {
  id: string;
  tmdb_id: number;
  title: string;
  media_type: "movie" | "tv";
  poster_url: string | null;
  added_at: string;
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

function upscalePoster(url: string | null, size = "w500"): string | null {
  if (!url) return null;
  return url.replace(/\/w\d+\//, `/${size}/`);
}

export default function WatchlistPage() {
  const router = useRouter();
  const searchRef = useRef<HTMLDivElement>(null);
  const [viewType, setViewType] = useState<ViewType>("grid");
  const [filter, setFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Add search state
  const [addQuery, setAddQuery] = useState("");
  const [addResults, setAddResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showAddDropdown, setShowAddDropdown] = useState(false);
  const [addingId, setAddingId] = useState<number | null>(null);

  useEffect(() => {
    fetchWatchlist();
  }, []);

  async function fetchWatchlist() {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("watchlist")
        .select("*")
        .order("added_at", { ascending: false });

      if (error) throw error;
      setWatchlist(data || []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  // Debounced search for adding
  useEffect(() => {
    const q = addQuery.trim();
    if (!q) {
      setAddResults([]);
      setShowAddDropdown(false);
      return;
    }

    const t = setTimeout(async () => {
      try {
        setIsSearching(true);
        const res = await fetch(`/api?action=search&q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (Array.isArray(data)) {
          setAddResults(data);
          setShowAddDropdown(true);
        }
      } catch {
        // silently fail
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => clearTimeout(t);
  }, [addQuery]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowAddDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleAdd(result: SearchResult) {
    setAddingId(result.id);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from("watchlist").insert({
        user_id: user.id,
        tmdb_id: result.id,
        title: result.title || result.name || "Untitled",
        media_type: result.media_type,
        poster_url: result.poster_url || null,
      });

      if (error) {
        if (error.code === "23505") {
          // duplicate — already in watchlist
        } else {
          throw error;
        }
      }

      setAddQuery("");
      setShowAddDropdown(false);
      await fetchWatchlist();
    } catch {
      // silently fail
    } finally {
      setAddingId(null);
    }
  }

  async function handleRemove(id: string) {
    try {
      const supabase = createClient();
      await supabase.from("watchlist").delete().eq("id", id);
      setWatchlist(watchlist.filter((item) => item.id !== id));
    } catch {
      // silently fail
    }
  }

  function handleMarkWatched(item: WatchlistItem) {
    // Navigate to log page — user can log the watch from there
    router.push("/protected/log");
  }

  const filteredItems = watchlist.filter((item) => {
    const matchesFilter =
      filter === "all" ||
      (filter === "movies" && item.media_type === "movie") ||
      (filter === "tv" && item.media_type === "tv");

    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  const stats = {
    total: watchlist.length,
    movies: watchlist.filter((i) => i.media_type === "movie").length,
    tvShows: watchlist.filter((i) => i.media_type === "tv").length,
  };

  // Check which tmdb_ids are already in the watchlist for the add dropdown
  const watchlistTmdbIds = new Set(watchlist.map((i) => i.tmdb_id));

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">My Watchlist</h1>
            <p className="text-muted-foreground">
              Movies and shows you want to watch next
            </p>
          </div>
        </div>

        {/* Add to Watchlist Search */}
        <div ref={searchRef} className="relative border-2 border-primary/30 bg-primary/5 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">Add to Watchlist</span>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search for a movie or TV show..."
              value={addQuery}
              onChange={(e) => setAddQuery(e.target.value)}
              onFocus={() => addResults.length > 0 && setShowAddDropdown(true)}
              className="pl-10 py-5 text-base bg-card border-2 border-border"
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
            )}
          </div>

          {showAddDropdown && addResults.length > 0 && (
            <div className="absolute left-5 right-5 z-50 border-2 border-border bg-card max-h-72 overflow-auto shadow-lg">
              {addResults.slice(0, 8).map((result) => {
                const label = result.title || result.name || "Untitled";
                const year = (result.release_date || result.first_air_date || "").slice(0, 4);
                const alreadyAdded = watchlistTmdbIds.has(result.id);
                return (
                  <div
                    key={`${result.media_type}-${result.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors"
                  >
                    {result.poster_url ? (
                      <img
                        src={result.poster_url}
                        alt={label}
                        className="w-8 h-12 object-cover rounded shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-12 bg-muted/50 rounded flex items-center justify-center shrink-0">
                        {result.media_type === "movie"
                          ? <Film className="w-4 h-4 text-muted-foreground" />
                          : <Tv className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{label}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <span>{result.media_type === "movie" ? "Movie" : "TV Show"}</span>
                        {year && <><span>·</span><span>{year}</span></>}
                        {result.vote_average != null && result.vote_average > 0 && (
                          <>
                            <span>·</span>
                            <span className="flex items-center gap-1">
                              <Star className="w-3 h-3 text-accent fill-accent" />
                              {result.vote_average.toFixed(1)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    {alreadyAdded ? (
                      <span className="text-xs text-muted-foreground px-3 py-1.5 border border-border rounded-md">
                        Added
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0"
                        disabled={addingId === result.id}
                        onClick={() => handleAdd(result)}
                      >
                        {addingId === result.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <><Plus className="w-4 h-4 mr-1" /> Add</>
                        )}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-3 gap-4">
          <div className="border-2 border-border p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 border-2 border-primary flex items-center justify-center">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.total}</div>
                <p className="text-sm text-muted-foreground">To Watch</p>
              </div>
            </div>
          </div>
          <div className="border-2 border-border p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 border-2 border-accent flex items-center justify-center">
                <Film className="w-5 h-5 text-accent" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.movies}</div>
                <p className="text-sm text-muted-foreground">{stats.movies === 1 ? "Movie" : "Movies"}</p>
              </div>
            </div>
          </div>
          <div className="border-2 border-border p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 border-2 border-secondary flex items-center justify-center">
                <Tv className="w-5 h-5 text-secondary" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.tvShows}</div>
                <p className="text-sm text-muted-foreground">{stats.tvShows === 1 ? "TV Show" : "TV Shows"}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 border-2 border-border p-1">
            <button
              onClick={() => setFilter("all")}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                filter === "all"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter("movies")}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                filter === "movies"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Film className="w-4 h-4" />
              Movies
            </button>
            <button
              onClick={() => setFilter("tv")}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                filter === "tv"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Tv className="w-4 h-4" />
              TV Shows
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Filter watchlist..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-card/50 border-border/50 w-full sm:w-64"
            />
          </div>

          <div className="flex items-center gap-1 bg-card/50 border border-border/50 rounded-lg p-1">
            <button
              onClick={() => setViewType("grid")}
              className={`p-2 rounded transition-colors ${
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
              className={`p-2 rounded transition-colors ${
                viewType === "list"
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="List view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-card/50 flex items-center justify-center mb-6">
            <Clock className="w-10 h-10 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Your watchlist is empty</h2>
          <p className="text-muted-foreground mb-6 max-w-md">
            {searchQuery
              ? "No results match your search. Try different keywords."
              : "Use the search bar above to find movies and TV shows to add."}
          </p>
        </div>
      ) : viewType === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="group border-2 border-border overflow-hidden hover:border-primary transition-all duration-300 cursor-pointer relative"
              onClick={() => router.push(`/protected/media/${item.media_type}/${item.tmdb_id}`)}
            >
              {/* Poster */}
              <div className="aspect-[2/3] bg-gradient-to-br from-primary/20 via-accent/10 to-secondary/20 flex items-center justify-center relative overflow-hidden">
                {item.poster_url ? (
                  <img
                    src={upscalePoster(item.poster_url)!}
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                ) : item.media_type === "movie" ? (
                  <Film className="w-12 h-12 text-white/50" />
                ) : (
                  <Tv className="w-12 h-12 text-white/50" />
                )}
                {/* Hover Actions */}
                <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button
                    size="sm"
                    className="bg-green-500 hover:bg-green-600"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMarkWatched(item);
                    }}
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(item.id);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              {/* Info */}
              <div className="p-4 space-y-2">
                <h3 className="font-semibold line-clamp-1 group-hover:text-primary transition-colors">
                  {item.title}
                </h3>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{item.media_type === "movie" ? "Movie" : "TV Show"}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="group flex items-center gap-4 p-4 border-2 border-border hover:border-primary transition-all duration-300 cursor-pointer"
              onClick={() => router.push(`/protected/media/${item.media_type}/${item.tmdb_id}`)}
            >
              {/* Poster Thumbnail */}
              <div className="w-16 h-24 flex-shrink-0 bg-gradient-to-br from-primary/30 via-accent/20 to-secondary/30 rounded-lg flex items-center justify-center overflow-hidden">
                {item.poster_url ? (
                  <img
                    src={upscalePoster(item.poster_url, "w185")!}
                    alt={item.title}
                    className="w-full h-full object-cover rounded-lg"
                  />
                ) : item.media_type === "movie" ? (
                  <Film className="w-6 h-6 text-white/50" />
                ) : (
                  <Tv className="w-6 h-6 text-white/50" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                  {item.title}
                </h3>
                <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                  <span className="flex items-center gap-1">
                    {item.media_type === "movie" ? <Film className="w-3 h-3" /> : <Tv className="w-3 h-3" />}
                    {item.media_type === "movie" ? "Movie" : "TV Show"}
                  </span>
                  <span className="text-xs">
                    Added {new Date(item.added_at).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="bg-green-500 hover:bg-green-600"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMarkWatched(item);
                  }}
                  title="Mark as watched"
                >
                  <Check className="w-4 h-4 mr-1" />
                  Watched
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemove(item.id);
                  }}
                  title="Remove from watchlist"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tips */}
      {!loading && filteredItems.length > 0 && (
        <div className="border-2 border-border p-4 text-center">
          <p className="text-sm text-muted-foreground">
            Click <Check className="w-4 h-4 inline text-green-500" /> to log a watch, or <Trash2 className="w-4 h-4 inline text-destructive" /> to remove from watchlist.
          </p>
        </div>
      )}
    </div>
  );
}
