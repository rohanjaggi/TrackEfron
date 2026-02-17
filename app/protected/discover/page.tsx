"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Sparkles, 
  Search, 
  Star, 
  Film, 
  Tv,
  TrendingUp,
  Zap,
  RefreshCw
} from "lucide-react";

// Mock recommendations - will be replaced with ML model data
const recommendations = [
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

const trendingNow = [
  { id: 1, title: "The Bear", type: "TV Show", trending: "+45%" },
  { id: 2, title: "Barbie", type: "Movie", trending: "+38%" },
  { id: 3, title: "Shogun", type: "TV Show", trending: "+32%" },
];

export default function DiscoverPage() {
  return (
    <div className="flex flex-col gap-10">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 border-2 border-primary text-sm text-primary mb-6">
          <Sparkles className="w-4 h-4" />
          <span>AI-Powered Discovery</span>
        </div>
        <h1 className="font-display text-3xl md:text-4xl font-bold mb-4">
          Discover Your Next{" "}
          <span className="italic text-primary">
            Favourite
          </span>
        </h1>
        <p className="text-muted-foreground text-lg">
          Personalised recommendations based on your watch history and ratings
        </p>
      </div>

      {/* Search Bar */}
      <div className="max-w-xl mx-auto w-full">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Search movies and TV shows..."
            className="pl-12 py-6 text-lg bg-card border-2 border-border"
          />
        </div>
      </div>

      {/* Quick Filters */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button variant="outline" size="sm" className="border-2">
          <Film className="w-4 h-4 mr-2" />
          Movies
        </Button>
        <Button variant="outline" size="sm" className="border-2">
          <Tv className="w-4 h-4 mr-2" />
          TV Shows
        </Button>
        <Button variant="outline" size="sm" className="border-2">
          Action
        </Button>
        <Button variant="outline" size="sm" className="border-2">
          Drama
        </Button>
        <Button variant="outline" size="sm" className="border-2">
          Sci-Fi
        </Button>
        <Button variant="outline" size="sm" className="border-2">
          Comedy
        </Button>
      </div>

      {/* Main Content */}
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Recommendations */}
        <div className="lg:col-span-2 space-y-6">
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

          <div className="grid sm:grid-cols-2 gap-4">
            {recommendations.map((item) => (
              <div
                key={item.id}
                className="group border-2 border-border overflow-hidden hover:border-primary transition-all duration-300 cursor-pointer"
              >
                {/* Poster Area */}
                <div className="aspect-video bg-gradient-to-br from-primary/20 via-accent/10 to-secondary/20 flex items-center justify-center relative">
                  {item.type === "Movie" ? (
                    <Film className="w-12 h-12 text-white/30" />
                  ) : (
                    <Tv className="w-12 h-12 text-white/30" />
                  )}
                  {/* Match Badge */}
                  <div className="absolute top-3 right-3 bg-primary text-primary-foreground text-xs font-bold px-2 py-1 rounded-full">
                    {item.matchScore}% match
                  </div>
                </div>

                {/* Content */}
                <div className="p-4 space-y-3">
                  <div>
                    <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                      {item.title}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                      <span>{item.type}</span>
                      <span>•</span>
                      <span>{item.year}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Star className="w-3 h-3 text-accent fill-accent" />
                        {item.rating}
                      </span>
                    </div>
                  </div>

                  <p className="text-sm text-primary/80 italic">
                    "{item.reason}"
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {item.genres.map((genre) => (
                      <span
                        key={genre}
                        className="text-xs bg-muted/50 text-muted-foreground px-2 py-1 rounded-full"
                      >
                        {genre}
                      </span>
                    ))}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button size="sm" className="flex-1 bg-primary hover:bg-primary/90">
                      Add to Library
                    </Button>
                    <Button variant="outline" size="sm" className="border-border/50">
                      Details
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Trending */}
          <div className="border-2 border-border p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-secondary" />
              <h2 className="font-semibold">Trending Now</h2>
            </div>
            <div className="space-y-3">
              {trendingNow.map((item, index) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-card/80 transition-colors cursor-pointer"
                >
                  <span className="text-2xl font-bold text-muted-foreground/50 w-8">
                    {index + 1}
                  </span>
                  <div className="flex-1">
                    <h3 className="font-medium text-sm">{item.title}</h3>
                    <p className="text-xs text-muted-foreground">{item.type}</p>
                  </div>
                  <span className="text-xs text-green-500 font-medium">
                    {item.trending}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Your Taste Profile */}
          <div className="border-2 border-border p-6 bg-muted/10">
            <h2 className="font-semibold mb-4">Your Taste Profile</h2>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Drama</span>
                  <span className="text-muted-foreground">85%</span>
                </div>
                <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: "85%" }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Thriller</span>
                  <span className="text-muted-foreground">72%</span>
                </div>
                <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                  <div className="h-full bg-accent rounded-full" style={{ width: "72%" }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Sci-Fi</span>
                  <span className="text-muted-foreground">65%</span>
                </div>
                <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                  <div className="h-full bg-secondary rounded-full" style={{ width: "65%" }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Comedy</span>
                  <span className="text-muted-foreground">45%</span>
                </div>
                <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                  <div className="h-full bg-primary/60 rounded-full" style={{ width: "45%" }} />
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Based on your ratings and watch history
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
