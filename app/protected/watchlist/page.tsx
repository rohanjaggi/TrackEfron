"use client";

import { useState } from "react";
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
  GripVertical
} from "lucide-react";

type ViewType = "grid" | "list";
type FilterType = "all" | "movies" | "tv";

// Mock data - will be replaced with Supabase data
const mockWatchlist = [
  {
    id: 1,
    title: "Better Call Saul",
    type: "TV Show",
    year: 2015,
    rating: 9.0,
    addedDate: "2024-02-01",
    priority: 1,
    source: "recommendation",
  },
  {
    id: 2,
    title: "The Dark Knight",
    type: "Movie",
    year: 2008,
    rating: 9.0,
    addedDate: "2024-02-05",
    priority: 2,
    source: "manual",
  },
  {
    id: 3,
    title: "Succession",
    type: "TV Show",
    year: 2018,
    rating: 8.9,
    addedDate: "2024-02-10",
    priority: 3,
    source: "recommendation",
  },
  {
    id: 4,
    title: "Dune",
    type: "Movie",
    year: 2021,
    rating: 8.0,
    addedDate: "2024-02-12",
    priority: 4,
    source: "manual",
  },
  {
    id: 5,
    title: "Severance",
    type: "TV Show",
    year: 2022,
    rating: 8.7,
    addedDate: "2024-02-15",
    priority: 5,
    source: "recommendation",
  },
];

export default function WatchlistPage() {
  const [viewType, setViewType] = useState<ViewType>("list");
  const [filter, setFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [watchlist, setWatchlist] = useState(mockWatchlist);

  const filteredItems = watchlist.filter((item) => {
    const matchesFilter =
      filter === "all" ||
      (filter === "movies" && item.type === "Movie") ||
      (filter === "tv" && item.type === "TV Show");
    
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesFilter && matchesSearch;
  });

  const handleRemove = (id: number) => {
    setWatchlist(watchlist.filter((item) => item.id !== id));
  };

  const handleMarkWatched = (id: number) => {
    // TODO: Move to library and remove from watchlist
    setWatchlist(watchlist.filter((item) => item.id !== id));
  };

  const stats = {
    total: watchlist.length,
    movies: watchlist.filter((i) => i.type === "Movie").length,
    tvShows: watchlist.filter((i) => i.type === "TV Show").length,
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">My Watchlist</h1>
            <p className="text-muted-foreground">
              Movies and shows you want to watch next
            </p>
          </div>
          <Button className="bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-lg shadow-primary/25">
            <Plus className="w-4 h-4 mr-2" />
            Add to Watchlist
          </Button>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-card/50 backdrop-blur rounded-xl border border-border/50 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.total}</div>
                <p className="text-sm text-muted-foreground">To Watch</p>
              </div>
            </div>
          </div>
          <div className="bg-card/50 backdrop-blur rounded-xl border border-border/50 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <Film className="w-5 h-5 text-accent" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.movies}</div>
                <p className="text-sm text-muted-foreground">Movies</p>
              </div>
            </div>
          </div>
          <div className="bg-card/50 backdrop-blur rounded-xl border border-border/50 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                <Tv className="w-5 h-5 text-secondary" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.tvShows}</div>
                <p className="text-sm text-muted-foreground">TV Shows</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Filter Tabs */}
          <div className="flex items-center gap-1 bg-card/50 rounded-lg border border-border/50 p-1">
            <button
              onClick={() => setFilter("all")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
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
              placeholder="Search watchlist..."
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
      {filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-card/50 flex items-center justify-center mb-6">
            <Clock className="w-10 h-10 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Your watchlist is empty</h2>
          <p className="text-muted-foreground mb-6 max-w-md">
            {searchQuery
              ? "No results match your search. Try different keywords."
              : "Add movies and TV shows you want to watch to keep track of them."}
          </p>
          {!searchQuery && (
            <Button className="bg-gradient-to-r from-primary to-accent hover:opacity-90">
              <Plus className="w-4 h-4 mr-2" />
              Add to Watchlist
            </Button>
          )}
        </div>
      ) : viewType === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="group bg-card/50 backdrop-blur rounded-xl border border-border/50 overflow-hidden hover:border-primary/50 transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 cursor-pointer relative"
            >
              {/* Poster */}
              <div className="aspect-[2/3] bg-gradient-to-br from-primary/20 via-accent/10 to-secondary/20 flex items-center justify-center relative overflow-hidden">
                {item.type === "Movie" ? (
                  <Film className="w-12 h-12 text-white/50" />
                ) : (
                  <Tv className="w-12 h-12 text-white/50" />
                )}
                {/* Rating Badge */}
                <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-full">
                  <Star className="w-3 h-3 text-accent fill-accent" />
                  <span className="text-xs font-medium text-white">{item.rating}</span>
                </div>
                {/* Priority Badge */}
                <div className="absolute top-2 left-2 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">
                  {item.priority}
                </div>
                {/* Hover Actions */}
                <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button
                    size="sm"
                    className="bg-green-500 hover:bg-green-600"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMarkWatched(item.id);
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
                  <span>{item.type}</span>
                  <span>•</span>
                  <span>{item.year}</span>
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
              className="group flex items-center gap-4 p-4 bg-card/50 backdrop-blur rounded-xl border border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-lg"
            >
              {/* Drag Handle */}
              <div className="text-muted-foreground/50 hover:text-muted-foreground cursor-grab">
                <GripVertical className="w-5 h-5" />
              </div>

              {/* Priority */}
              <div className="w-8 h-8 bg-primary/10 text-primary rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                {item.priority}
              </div>

              {/* Poster Thumbnail */}
              <div className="w-16 h-24 flex-shrink-0 bg-gradient-to-br from-primary/30 via-accent/20 to-secondary/30 rounded-lg flex items-center justify-center">
                {item.type === "Movie" ? (
                  <Film className="w-6 h-6 text-white/50" />
                ) : (
                  <Tv className="w-6 h-6 text-white/50" />
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
                        {item.type === "Movie" ? <Film className="w-3 h-3" /> : <Tv className="w-3 h-3" />}
                        {item.type}
                      </span>
                      <span>{item.year}</span>
                      <span className="flex items-center gap-1">
                        <Star className="w-3 h-3 text-accent fill-accent" />
                        {item.rating}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  {item.source === "recommendation" && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                      From Recommendations
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    Added {new Date(item.addedDate).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  className="bg-green-500 hover:bg-green-600"
                  onClick={() => handleMarkWatched(item.id)}
                  title="Mark as watched"
                >
                  <Check className="w-4 h-4 mr-1" />
                  Watched
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => handleRemove(item.id)}
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
      {filteredItems.length > 0 && (
        <div className="bg-card/30 rounded-xl border border-border/50 p-4 text-center">
          <p className="text-sm text-muted-foreground">
            💡 Tip: Click <Check className="w-4 h-4 inline text-green-500" /> to mark as watched and move to your library, 
            or <Trash2 className="w-4 h-4 inline text-destructive" /> to remove from watchlist.
          </p>
        </div>
      )}
    </div>
  );
}
