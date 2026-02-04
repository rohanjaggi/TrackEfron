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
  Calendar,
  Film,
  Tv
} from "lucide-react";

type ViewType = "grid" | "list";
type FilterType = "all" | "movies" | "tv";

// Mock data - will be replaced with Supabase data
const mockWatchedItems = [
  {
    id: 1,
    title: "Breaking Bad",
    type: "TV Show",
    year: 2008,
    rating: 9.5,
    userRating: 10,
    review: "One of the greatest shows ever made. The character development is unparalleled.",
    watchedDate: "2024-01-15",
    posterUrl: null,
  },
  {
    id: 2,
    title: "Inception",
    type: "Movie",
    year: 2010,
    rating: 8.8,
    userRating: 9,
    review: "Mind-bending thriller that keeps you thinking long after it ends.",
    watchedDate: "2024-01-20",
    posterUrl: null,
  },
  {
    id: 3,
    title: "The Office",
    type: "TV Show",
    year: 2005,
    rating: 8.9,
    userRating: 8.5,
    review: "Hilarious mockumentary with heart. Michael Scott is iconic.",
    watchedDate: "2024-02-01",
    posterUrl: null,
  },
  {
    id: 4,
    title: "Interstellar",
    type: "Movie",
    year: 2014,
    rating: 8.7,
    userRating: 9.5,
    review: "Visually stunning with an emotional core. Hans Zimmer's score is phenomenal.",
    watchedDate: "2024-02-10",
    posterUrl: null,
  },
  {
    id: 5,
    title: "Stranger Things",
    type: "TV Show",
    year: 2016,
    rating: 8.7,
    userRating: 8,
    review: "Great 80s nostalgia with compelling mystery elements.",
    watchedDate: "2024-02-15",
    posterUrl: null,
  },
];

export default function LibraryPage() {
  const [viewType, setViewType] = useState<ViewType>("grid");
  const [filter, setFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredItems = mockWatchedItems.filter((item) => {
    const matchesFilter =
      filter === "all" ||
      (filter === "movies" && item.type === "Movie") ||
      (filter === "tv" && item.type === "TV Show");
    
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesFilter && matchesSearch;
  });

  const stats = {
    total: mockWatchedItems.length,
    movies: mockWatchedItems.filter((i) => i.type === "Movie").length,
    tvShows: mockWatchedItems.filter((i) => i.type === "TV Show").length,
    avgRating: (
      mockWatchedItems.reduce((acc, i) => acc + i.userRating, 0) / mockWatchedItems.length
    ).toFixed(1),
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">My Library</h1>
            <p className="text-muted-foreground">
              Your watched movies and TV shows, all in one place
            </p>
          </div>
          <Button className="bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-lg shadow-primary/25">
            <Plus className="w-4 h-4 mr-2" />
            Add to Library
          </Button>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card/50 backdrop-blur rounded-xl border border-border/50 p-4">
            <div className="text-2xl font-bold text-primary">{stats.total}</div>
            <p className="text-sm text-muted-foreground">Total Watched</p>
          </div>
          <div className="bg-card/50 backdrop-blur rounded-xl border border-border/50 p-4">
            <div className="text-2xl font-bold text-accent">{stats.movies}</div>
            <p className="text-sm text-muted-foreground">Movies</p>
          </div>
          <div className="bg-card/50 backdrop-blur rounded-xl border border-border/50 p-4">
            <div className="text-2xl font-bold text-secondary">{stats.tvShows}</div>
            <p className="text-sm text-muted-foreground">TV Shows</p>
          </div>
          <div className="bg-card/50 backdrop-blur rounded-xl border border-border/50 p-4">
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
      {filteredItems.length === 0 ? (
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
            <Button className="bg-gradient-to-r from-primary to-accent hover:opacity-90">
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Item
            </Button>
          )}
        </div>
      ) : viewType === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="group bg-card/50 backdrop-blur rounded-xl border border-border/50 overflow-hidden hover:border-primary/50 transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1 cursor-pointer"
            >
              {/* Poster */}
              <div className="aspect-[2/3] bg-gradient-to-br from-primary/30 via-accent/20 to-secondary/30 flex items-center justify-center relative overflow-hidden">
                {item.type === "Movie" ? (
                  <Film className="w-12 h-12 text-white/50" />
                ) : (
                  <Tv className="w-12 h-12 text-white/50" />
                )}
                {/* Rating Badge */}
                <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-full">
                  <Star className="w-3 h-3 text-accent fill-accent" />
                  <span className="text-xs font-medium text-white">{item.userRating}</span>
                </div>
                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                  <p className="text-xs text-white/80 line-clamp-3">{item.review}</p>
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
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="w-3 h-3" />
                  <span>{new Date(item.watchedDate).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="group flex items-start gap-4 p-4 bg-card/50 backdrop-blur rounded-xl border border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-lg cursor-pointer"
            >
              {/* Poster Thumbnail */}
              <div className="w-20 h-28 flex-shrink-0 bg-gradient-to-br from-primary/30 via-accent/20 to-secondary/30 rounded-lg flex items-center justify-center">
                {item.type === "Movie" ? (
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
                        {item.type === "Movie" ? <Film className="w-3 h-3" /> : <Tv className="w-3 h-3" />}
                        {item.type}
                      </span>
                      <span>{item.year}</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(item.watchedDate).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 bg-primary/10 px-3 py-1.5 rounded-full">
                    <Star className="w-4 h-4 text-accent fill-accent" />
                    <span className="font-semibold">{item.userRating}</span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-3 line-clamp-2">{item.review}</p>
              </div>

              {/* Actions */}
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="outline" size="sm">
                  Edit
                </Button>
                <Button variant="ghost" size="sm" className="text-muted-foreground">
                  View
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
