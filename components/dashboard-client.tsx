"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { 
  Film, 
  Star, 
  BookOpen, 
  Plus, 
  ChevronRight,
  Tv,
  Clock,
  Target,
  Feather
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
    <div className="flex flex-col gap-12">
      {/* Welcome Header */}
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-center gap-3 text-muted-foreground">
          <div className="w-16 h-[1px] bg-border"></div>
          <Feather className="w-4 h-4" />
          <div className="w-16 h-[1px] bg-border"></div>
        </div>
        
        <div className="text-center">
          <h1 className="font-display text-4xl md:text-5xl font-bold">
            Welcome back,{" "}
            <span className="italic text-primary">
              {userName}
            </span>
          </h1>
        </div>

        <div className="flex justify-center">
          <Button 
            size="lg"
            className="group font-semibold text-base px-8 py-6 h-auto border-2" 
            asChild
          >
            <Link href="/protected/log">
              <Plus className="w-5 h-5 mr-2 transition-transform group-hover:rotate-90" />
              Log a Watch
            </Link>
          </Button>
        </div>

        <div className="ornamental-line"></div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <div className="text-center p-6 border-2 border-border">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 border-2 border-primary flex items-center justify-center">
              <Film className="w-6 h-6 text-primary" />
            </div>
          </div>
          <div className="font-display text-4xl font-bold mb-2">{stats.watched}</div>
          <p className="text-sm text-muted-foreground uppercase tracking-wider">Total Watched</p>
        </div>

        <div className="text-center p-6 border-2 border-border">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 border-2 border-secondary flex items-center justify-center">
              <Star className="w-6 h-6 text-secondary" />
            </div>
          </div>
          <div className="font-display text-4xl font-bold mb-2">{stats.reviews}</div>
          <p className="text-sm text-muted-foreground uppercase tracking-wider">Reviews Written</p>
        </div>

        <div className="text-center p-6 border-2 border-border">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 border-2 border-accent flex items-center justify-center">
              <Star className="w-6 h-6 text-accent" />
            </div>
          </div>
          <div className="font-display text-4xl font-bold mb-2">{stats.avgRating}</div>
          <p className="text-sm text-muted-foreground uppercase tracking-wider">Average Rating</p>
        </div>

        <div className="text-center p-6 border-2 border-border">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 border-2 border-primary flex items-center justify-center">
              <Clock className="w-6 h-6 text-primary" />
            </div>
          </div>
          <div className="font-display text-4xl font-bold mb-2">{stats.thisMonth}</div>
          <p className="text-sm text-muted-foreground uppercase tracking-wider">This Month</p>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid md:grid-cols-2 gap-8">
        {/* Recent Watches */}
        <div className="border-2 border-border p-8">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
            <h2 className="font-display text-2xl font-bold">Recent Watches</h2>
            <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-primary">
              <Link href="/protected/library" className="flex items-center gap-1">
                View All <ChevronRight className="w-4 h-4" />
              </Link>
            </Button>
          </div>

          {recentWatches.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 border-2 border-muted flex items-center justify-center mx-auto mb-4">
                <Film className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground mb-4 italic">No watches yet</p>
              <Button size="sm" asChild>
                <Link href="/protected/log">Log Your First Watch</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {recentWatches.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-4 pb-4 border-b border-border/50 last:border-0 hover:bg-muted/20 p-2 -mx-2 transition-colors cursor-pointer"
                >
                  <div className="w-12 h-16 border border-primary/30 flex items-center justify-center flex-shrink-0 bg-primary/5">
                    {item.type === "Movie" ? (
                      <Film className="w-5 h-5 text-primary" />
                    ) : (
                      <Tv className="w-5 h-5 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold mb-1 truncate">
                      {item.title}
                    </h3>
                    <p className="text-sm text-muted-foreground italic">{item.type}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-accent" />
                    <span className="font-semibold">{item.rating}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recommendations */}
        <div className="border-2 border-border p-8 bg-muted/10">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              <h2 className="font-display text-2xl font-bold">Recommended</h2>
            </div>
            <span className="text-xs border border-primary text-primary px-2 py-1 uppercase tracking-wider">Personalised</span>
          </div>

          {recommendations.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 border-2 border-muted flex items-center justify-center mx-auto mb-4">
                <Target className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground italic">
                Watch more to get recommendations
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {recommendations.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-4 pb-4 border-b border-border/50 last:border-0 hover:bg-muted/20 p-2 -mx-2 transition-colors cursor-pointer"
                >
                  <div className="w-12 h-16 border border-accent/30 flex items-center justify-center flex-shrink-0 bg-accent/5">
                    {item.type === "Movie" ? (
                      <Film className="w-5 h-5 text-accent" />
                    ) : (
                      <Tv className="w-5 h-5 text-accent" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold mb-1 truncate">
                      {item.title}
                    </h3>
                    <p className="text-sm text-muted-foreground italic">{item.type}</p>
                  </div>
                  <div className="text-sm font-semibold text-primary">{item.match}%</div>
                </div>
              ))}
              <Button variant="outline" className="w-full mt-4" asChild>
                <Link href="/protected/discover">View More</Link>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="border-t-2 border-border pt-8">
        <h3 className="font-display text-xl font-bold text-center mb-6">Quick Navigation</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Button variant="outline" className="h-auto py-6 flex-col gap-3 border-2" asChild>
            <Link href="/protected/library">
              <Film className="w-6 h-6" />
              <span className="font-semibold">Library</span>
            </Link>
          </Button>
          <Button variant="outline" className="h-auto py-6 flex-col gap-3 border-2" asChild>
            <Link href="/protected/watchlist">
              <Clock className="w-6 h-6" />
              <span className="font-semibold">Watchlist</span>
            </Link>
          </Button>
          <Button variant="outline" className="group h-auto py-6 flex-col gap-3 border-2" asChild>
            <Link href="/protected/log">
              <Plus className="w-6 h-6 transition-transform group-hover:rotate-90" />
              <span className="font-semibold">Add Movie</span>
            </Link>
          </Button>
          <Button variant="outline" className="h-auto py-6 flex-col gap-3 border-2" asChild>
            <Link href="/protected/log">
              <Tv className="w-6 h-6" />
              <span className="font-semibold">Add Series</span>
            </Link>
          </Button>
          <Button variant="outline" className="h-auto py-6 flex-col gap-3 border-2" asChild>
            <Link href="/protected/discover">
              <Target className="w-6 h-6" />
              <span className="font-semibold">Discover</span>
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
