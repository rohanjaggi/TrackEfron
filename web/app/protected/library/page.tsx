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
  Loader2,
  Pencil,
  Trash2,
  MoreVertical,
  ArrowUpDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";

type ViewType = "grid" | "list";
type FilterType = "all" | "movies" | "tv";
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
  const [sortBy, setSortBy] = useState<SortType | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [watchedItems, setWatchedItems] = useState<WatchLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  useEffect(() => {
    fetchLibrary();
  }, []);

  async function handleDelete(id: string) {
    setWatchedItems((prev) => prev.filter((item) => item.id !== id));
    setDeletingId(null);
    try {
      const supabase = createClient();
      await supabase.from("watch_logs").delete().eq("id", id);
    } catch {
      fetchLibrary();
    }
  }

  const filteredItems = watchedItems
    .filter((item) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "movies" && item.media_type === "movie") ||
        (filter === "tv" && item.media_type === "tv");

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
          <div className="border-2 border-border p-4 hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
            <div className="text-2xl font-bold text-primary">{stats.total}</div>
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
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1 border-2 border-border p-1">
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2 text-sm font-medium transition-all ${
              filter === "all"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter("movies")}
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
            onClick={() => setFilter("tv")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all ${
              filter === "tv"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Tv className="w-4 h-4" />
            TV Shows
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

          {/* View Toggle */}
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
              className="group border-2 border-border overflow-hidden hover:border-primary hover:-translate-y-1 hover:shadow-xl transition-all duration-300 cursor-pointer"
              onClick={() => item.tmdb_id && router.push(`/protected/media/${item.media_type}/${item.tmdb_id}`)}
            >
              {/* Poster */}
              <div className="aspect-[2/3] bg-gradient-to-br from-primary/30 via-accent/20 to-secondary/30 flex items-center justify-center relative overflow-hidden">
                {item.poster_url ? (
                  <img
                    src={upscalePoster(item.poster_url)!}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
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
                {/* Edit/Delete Overlay */}
                <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); router.push(`/protected/log?edit=${item.id}`); }}
                    className="p-1.5 bg-black/60 backdrop-blur-sm rounded-full hover:bg-black/80 transition-colors"
                    title="Edit"
                  >
                    <Pencil className="w-3.5 h-3.5 text-white" />
                  </button>
                  {deletingId === item.id ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                      className="px-2 py-1 bg-destructive backdrop-blur-sm rounded-full text-xs font-medium text-white"
                    >
                      Confirm?
                    </button>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeletingId(item.id); }}
                      className="p-1.5 bg-black/60 backdrop-blur-sm rounded-full hover:bg-destructive transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-white" />
                    </button>
                  )}
                </div>
                {/* Hover Overlay */}
                {item.review && (
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4 pointer-events-none">
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
              className="group flex items-start gap-4 p-4 border-2 border-border hover:border-primary hover:translate-x-1 transition-all duration-300 cursor-pointer"
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
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 bg-primary/10 px-3 py-1.5 rounded-full">
                      <Star className="w-4 h-4 text-accent fill-accent" />
                      <span className="font-semibold">{Number(item.rating)}</span>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <MoreVertical className="w-4 h-4" />
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
