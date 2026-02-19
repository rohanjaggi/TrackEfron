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
  Calendar,
  Film,
  Tv,
  Loader2
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type ViewType = "grid" | "list";
type FilterType = "all" | "movies" | "tv";

type WatchLog = {
  id: string;
  title: string;
  media_type: "movie" | "tv";
  rating: number;
  review: string | null;
  watched_date: string | null;
  poster_url: string | null;
  tmdb_id: number | null;
  created_at: string;
};

function upscalePoster(url: string | null, size = "w500"): string | null {
  if (!url) return null;
  return url.replace(/\/w\d+\//, `/${size}/`);
}

export default function LibraryPage() {
  const router = useRouter();
  const [viewType, setViewType] = useState<ViewType>("grid");
  const [filter, setFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [watchedItems, setWatchedItems] = useState<WatchLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLibrary() {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("watch_logs")
          .select("id, title, media_type, rating, review, watched_date, poster_url, tmdb_id, created_at")
          .order("created_at", { ascending: false });

        if (error) throw error;
        setWatchedItems(data || []);
      } catch {
        // silently fail, will show empty state
      } finally {
        setLoading(false);
      }
    }
    fetchLibrary();
  }, []);

  const filteredItems = watchedItems.filter((item) => {
    const matchesFilter =
      filter === "all" ||
      (filter === "movies" && item.media_type === "movie") ||
      (filter === "tv" && item.media_type === "tv");

    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  const stats = {
    total: watchedItems.length,
    movies: watchedItems.filter((i) => i.media_type === "movie").length,
    tvShows: watchedItems.filter((i) => i.media_type === "tv").length,
    avgRating: watchedItems.length > 0
      ? (watchedItems.reduce((acc, i) => acc + Number(i.rating), 0) / watchedItems.length).toFixed(1)
      : "—",
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">My Library</h1>
            <p className="text-muted-foreground">
              Your watched movies and TV shows, all in one place
            </p>
          </div>
          <Button
            className="group font-semibold border-2"
            size="lg"
            onClick={() => router.push("/protected/log")}
          >
            <Plus className="w-4 h-4 mr-2 transition-transform group-hover:rotate-90" />
            Add to Library
          </Button>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="border-2 border-border p-4">
            <div className="text-2xl font-bold text-primary">{stats.total}</div>
            <p className="text-sm text-muted-foreground">Total Watched</p>
          </div>
          <div className="border-2 border-border p-4">
            <div className="text-2xl font-bold text-accent">{stats.movies}</div>
            <p className="text-sm text-muted-foreground">{stats.movies === 1 ? "Movie" : "Movies"}</p>
          </div>
          <div className="border-2 border-border p-4">
            <div className="text-2xl font-bold text-secondary">{stats.tvShows}</div>
            <p className="text-sm text-muted-foreground">{stats.tvShows === 1 ? "TV Show" : "TV Shows"}</p>
          </div>
          <div className="border-2 border-border p-4">
            <div className="flex items-center gap-1">
              <Star className="w-5 h-5 text-accent fill-accent" />
              <span className="text-2xl font-bold">{stats.avgRating}</span>
            </div>
            <p className="text-sm text-muted-foreground">Avg Rating</p>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Filter Tabs */}
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

          {/* View Toggle */}
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
            <Film className="w-10 h-10 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold mb-2">No items found</h2>
          <p className="text-muted-foreground mb-6 max-w-md">
            {searchQuery
              ? "No results match your search. Try different keywords."
              : "Start adding movies and TV shows to your library to see them here."}
          </p>
          {!searchQuery && (
            <Button
              className="group font-semibold border-2"
              size="lg"
              onClick={() => router.push("/protected/log")}
            >
              <Plus className="w-4 h-4 mr-2 transition-transform group-hover:rotate-90" />
              Add Your First Item
            </Button>
          )}
        </div>
      ) : viewType === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="group border-2 border-border overflow-hidden hover:border-primary transition-all duration-300 cursor-pointer"
              onClick={() => item.tmdb_id && router.push(`/protected/media/${item.media_type}/${item.tmdb_id}`)}
            >
              {/* Poster */}
              <div className="aspect-[2/3] bg-gradient-to-br from-primary/30 via-accent/20 to-secondary/30 flex items-center justify-center relative overflow-hidden">
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
                {/* Rating Badge */}
                <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-full">
                  <Star className="w-3 h-3 text-accent fill-accent" />
                  <span className="text-xs font-medium text-white">{Number(item.rating)}</span>
                </div>
                {/* Hover Overlay */}
                {item.review && (
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                    <p className="text-xs text-white/80 line-clamp-3">{item.review}</p>
                  </div>
                )}
              </div>
              {/* Info */}
              <div className="p-4 space-y-2">
                <h3 className="font-semibold line-clamp-1 group-hover:text-primary transition-colors">
                  {item.title}
                </h3>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{item.media_type === "movie" ? "Movie" : "TV Show"}</span>
                </div>
                {item.watched_date && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    <span>{new Date(item.watched_date).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="group flex items-start gap-4 p-4 border-2 border-border hover:border-primary transition-all duration-300 cursor-pointer"
              onClick={() => item.tmdb_id && router.push(`/protected/media/${item.media_type}/${item.tmdb_id}`)}
            >
              {/* Poster Thumbnail */}
              <div className="w-20 h-28 flex-shrink-0 bg-gradient-to-br from-primary/30 via-accent/20 to-secondary/30 rounded-lg flex items-center justify-center overflow-hidden">
                {item.poster_url ? (
                  <img
                    src={upscalePoster(item.poster_url)!}
                    alt={item.title}
                    className="w-full h-full object-cover rounded-lg"
                  />
                ) : item.media_type === "movie" ? (
                  <Film className="w-8 h-8 text-white/50" />
                ) : (
                  <Tv className="w-8 h-8 text-white/50" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                      {item.title}
                    </h3>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                      <span className="flex items-center gap-1">
                        {item.media_type === "movie" ? <Film className="w-3 h-3" /> : <Tv className="w-3 h-3" />}
                        {item.media_type === "movie" ? "Movie" : "TV Show"}
                      </span>
                      {item.watched_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(item.watched_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 bg-primary/10 px-3 py-1.5 rounded-full">
                    <Star className="w-4 h-4 text-accent fill-accent" />
                    <span className="font-semibold">{Number(item.rating)}</span>
                  </div>
                </div>
                {item.review && (
                  <p className="text-sm text-muted-foreground mt-3 line-clamp-2">{item.review}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
