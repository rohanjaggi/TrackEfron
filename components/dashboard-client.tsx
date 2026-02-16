"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { 
  Film, 
  Star, 
  TrendingUp, 
  Plus, 
  ChevronRight,
  Tv,
  Clock,
  Target
} from "lucide-react";

// Mock data - will be replaced with Supabase data
const recentWatches = [
  { id: 1, title: "Breaking Bad", type: "TV Show", rating: 10, watchedDate: "2024-01-15" },
  { id: 2, title: "Inception", type: "Movie", rating: 9, watchedDate: "2024-01-20" },
  { id: 3, title: "The Office", type: "TV Show", rating: 8.5, watchedDate: "2024-02-01" },
];

const recommendations = [
  { id: 1, title: "Better Call Saul", type: "TV Show", match: 98 },
  { id: 2, title: "The Dark Knight", type: "Movie", match: 95 },
  { id: 3, title: "Succession", type: "TV Show", match: 92 },
];

interface DashboardClientProps {
  userName: string;
}

export function DashboardClient({ userName }: DashboardClientProps) {
  const stats = {
    watched: 5,
    reviews: 4,
    avgRating: 9.0,
    thisMonth: 2,
  };

  return (
    <div className="flex flex-col gap-10">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            Welcome back,{" "}
            <span className="bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
              {userName}
            </span>
          </h1>
          <p className="text-muted-foreground text-lg">
            Ready to track your next watch?
          </p>
        </div>
        <Button 
          size="lg"
          className="relative group bg-gradient-to-r from-accent via-secondary to-primary hover:shadow-2xl hover:shadow-primary/40 hover:scale-105 transition-all duration-300 shadow-xl shadow-primary/30 text-white font-semibold text-base px-8 py-6 h-auto overflow-hidden" 
          asChild
        >
          <Link href="/protected/log">
            <div className="absolute inset-0 bg-gradient-to-r from-primary via-accent to-secondary opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <Plus className="w-5 h-5 mr-2 relative z-10 group-hover:rotate-90 transition-transform duration-300" />
            <span className="relative z-10">Log a Watch</span>
          </Link>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="group bg-card/50 backdrop-blur rounded-xl border border-border/50 p-5 hover:border-primary/50 transition-all duration-300">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Film className="w-5 h-5 text-primary" />
            </div>
          </div>
          <div className="text-3xl font-bold">{stats.watched}</div>
          <p className="text-sm text-muted-foreground mt-1">Total Watched</p>
        </div>

        <div className="group bg-card/50 backdrop-blur rounded-xl border border-border/50 p-5 hover:border-accent/50 transition-all duration-300">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Star className="w-5 h-5 text-accent" />
            </div>
          </div>
          <div className="text-3xl font-bold">{stats.reviews}</div>
          <p className="text-sm text-muted-foreground mt-1">Reviews Written</p>
        </div>

        <div className="group bg-card/50 backdrop-blur rounded-xl border border-border/50 p-5 hover:border-secondary/50 transition-all duration-300">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
              <TrendingUp className="w-5 h-5 text-secondary" />
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Star className="w-5 h-5 text-accent fill-accent" />
            <span className="text-3xl font-bold">{stats.avgRating}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Avg Rating</p>
        </div>

        <div className="group bg-card/50 backdrop-blur rounded-xl border border-border/50 p-5 hover:border-primary/50 transition-all duration-300">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Clock className="w-5 h-5 text-primary" />
            </div>
          </div>
          <div className="text-3xl font-bold">{stats.thisMonth}</div>
          <p className="text-sm text-muted-foreground mt-1">This Month</p>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Recent Watches */}
        <div className="bg-card/50 backdrop-blur rounded-2xl border border-border/50 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Recent Watches</h2>
            <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-primary">
              <Link href="/protected/library" className="flex items-center gap-1">
                View All <ChevronRight className="w-4 h-4" />
              </Link>
            </Button>
          </div>

          {recentWatches.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-card flex items-center justify-center mx-auto mb-4">
                <Film className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground mb-4">No watches yet</p>
              <Button size="sm" className="bg-primary hover:bg-primary/90" asChild>
                <Link href="/protected/log">Log Your First Watch</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {recentWatches.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-4 p-3 rounded-xl hover:bg-card/80 transition-colors cursor-pointer group"
                >
                  <div className="w-12 h-16 bg-gradient-to-br from-primary/30 via-accent/20 to-secondary/30 rounded-lg flex items-center justify-center flex-shrink-0">
                    {item.type === "Movie" ? (
                      <Film className="w-5 h-5 text-white/50" />
                    ) : (
                      <Tv className="w-5 h-5 text-white/50" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium group-hover:text-primary transition-colors truncate">
                      {item.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">{item.type}</p>
                  </div>
                  <div className="flex items-center gap-1 bg-primary/10 px-2 py-1 rounded-full">
                    <Star className="w-3 h-3 text-accent fill-accent" />
                    <span className="text-sm font-medium">{item.rating}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AI Recommendations */}
        <div className="bg-gradient-to-br from-primary/5 via-accent/5 to-secondary/5 backdrop-blur rounded-2xl border border-border/50 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">For You</h2>
            </div>
            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">AI Powered</span>
          </div>

          {recommendations.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-card flex items-center justify-center mx-auto mb-4">
                <Target className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground mb-4">
                Watch more to get personalized recommendations
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recommendations.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-4 p-3 rounded-xl hover:bg-card/50 transition-colors cursor-pointer group"
                >
                  <div className="w-12 h-16 bg-gradient-to-br from-accent/30 via-secondary/20 to-primary/30 rounded-lg flex items-center justify-center flex-shrink-0">
                    {item.type === "Movie" ? (
                      <Film className="w-5 h-5 text-white/50" />
                    ) : (
                      <Tv className="w-5 h-5 text-white/50" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium group-hover:text-primary transition-colors truncate">
                      {item.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">{item.type}</p>
                  </div>
                  <div className="text-sm font-medium text-primary">{item.match}% match</div>
                </div>
              ))}
              <Button variant="outline" className="w-full mt-4 border-border/50" asChild>
                <Link href="/protected/discover">View More Recommendations</Link>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Button variant="outline" className="h-auto py-4 flex-col gap-2 border-border/50 hover:border-primary/50 hover:bg-primary/10 hover:text-primary" asChild>
          <Link href="/protected/library">
            <Film className="w-5 h-5" />
            <span>My Library</span>
          </Link>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex-col gap-2 border-border/50 hover:border-primary/50 hover:bg-primary/10 hover:text-primary" asChild>
          <Link href="/protected/watchlist">
            <Clock className="w-5 h-5" />
            <span>Watchlist</span>
          </Link>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex-col gap-2 border-border/50 hover:border-primary/50 hover:bg-primary/10 hover:text-primary" asChild>
          <Link href="/protected/log">
            <Plus className="w-5 h-5" />
            <span>Add Movie</span>
          </Link>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex-col gap-2 border-border/50 hover:border-primary/50 hover:bg-primary/10 hover:text-primary" asChild>
          <Link href="/protected/log">
            <Tv className="w-5 h-5" />
            <span>Add TV Show</span>
          </Link>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex-col gap-2 border-border/50 hover:border-primary/50 hover:bg-primary/10 hover:text-primary" asChild>
          <Link href="/protected/discover">
            <Target className="w-5 h-5" />
            <span>Discover</span>
          </Link>
        </Button>
      </div>
    </div>
  );
}
