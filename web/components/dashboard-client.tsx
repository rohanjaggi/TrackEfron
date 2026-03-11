"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Film,
  Tv,
  Star,
  Plus,
  ChevronRight,
  Clock,
  Target,
  Feather,
  Loader2,
  BookOpen,
  BarChart3,
  Bookmark,
  BookmarkCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

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

type Recommendation = {
  id: number;
  media_type: "movie" | "tv";
  title: string;
  poster_url: string | null;
  vote_average: number | null;
  release_date: string | null;
};

interface DashboardClientProps {
  userName: string;
}

function upscalePoster(url: string | null, size = "w185"): string | null {
  if (!url) return null;
  return url.replace(/\/w\d+\//, `/${size}/`);
}

export function DashboardClient({ userName }: DashboardClientProps) {
  const [watchLogs, setWatchLogs] = useState<WatchLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [recsLoading, setRecsLoading] = useState(true);
  const [watchlistedIds, setWatchlistedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      try {
        const { data, error } = await supabase
          .from("watch_logs")
          .select("id, title, media_type, rating, review, watched_date, poster_url, tmdb_id, created_at")
          .order("watched_date", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false });

        if (error) throw error;
        setWatchLogs(data || []);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }

    async function fetchRecs() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const res = await fetch(`/api?action=recommend&user_id=${user.id}`);
        const data = await res.json();
        if (Array.isArray(data)) setRecs(data.slice(0, 5));
      } catch {
        // silently fail — ML backend may not be running
      } finally {
        setRecsLoading(false);
      }
    }

    fetchData();
    fetchRecs();
  }, []);

  async function addToWatchlist(item: Recommendation) {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("watchlist").insert({
        user_id: user.id,
        tmdb_id: item.id,
        title: item.title,
        media_type: item.media_type,
        poster_url: item.poster_url,
      });
      setWatchlistedIds((prev) => new Set([...prev, item.id]));
    } catch {
      // silently fail (e.g. duplicate)
    }
  }

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const stats = {
    watched: watchLogs.length,
    reviews: watchLogs.filter((i) => i.review && i.review.trim().length > 0).length,
    avgRating: watchLogs.length > 0
      ? (watchLogs.reduce((acc, i) => acc + Number(i.rating), 0) / watchLogs.length).toFixed(1)
      : "—",
    thisMonth: watchLogs.filter((i) => {
      const date = i.watched_date || i.created_at;
      return date >= thisMonthStart;
    }).length,
  };

  const recentWatches = watchLogs.slice(0, 5);

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
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="text-center p-6 border-2 border-border hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 border-2 border-primary flex items-center justify-center">
                <Film className="w-6 h-6 text-primary" />
              </div>
            </div>
            <div className="font-display text-4xl font-bold mb-2">{stats.watched}</div>
            <p className="text-sm text-muted-foreground uppercase tracking-wider">Total Watched</p>
          </div>

          <div className="text-center p-6 border-2 border-border hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 border-2 border-secondary flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-secondary" />
              </div>
            </div>
            <div className="font-display text-4xl font-bold mb-2">{stats.reviews}</div>
            <p className="text-sm text-muted-foreground uppercase tracking-wider">{stats.reviews === 1 ? "Review Written" : "Reviews Written"}</p>
          </div>

          <div className="text-center p-6 border-2 border-border hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 border-2 border-accent flex items-center justify-center">
                <Star className="w-6 h-6 text-accent" />
              </div>
            </div>
            <div className="font-display text-4xl font-bold mb-2">{stats.avgRating}</div>
            <p className="text-sm text-muted-foreground uppercase tracking-wider">Average Rating</p>
          </div>

          <div className="text-center p-6 border-2 border-border hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 border-2 border-primary flex items-center justify-center">
                <Clock className="w-6 h-6 text-primary" />
              </div>
            </div>
            <div className="font-display text-4xl font-bold mb-2">{stats.thisMonth}</div>
            <p className="text-sm text-muted-foreground uppercase tracking-wider">This Month</p>
          </div>
        </div>
      )}

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

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : recentWatches.length === 0 ? (
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
                <Link
                  key={item.id}
                  href={item.tmdb_id ? `/protected/media/${item.media_type}/${item.tmdb_id}` : "#"}
                  className="flex items-start gap-4 pb-4 border-b border-border/50 last:border-0 hover:bg-muted/20 hover:translate-x-1 p-2 -mx-2 transition-all duration-200 cursor-pointer"
                >
                  <div className="w-12 h-16 border border-primary/30 flex items-center justify-center flex-shrink-0 bg-primary/5 overflow-hidden">
                    {item.poster_url ? (
                      <img
                        src={upscalePoster(item.poster_url)!}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    ) : item.media_type === "movie" ? (
                      <Film className="w-5 h-5 text-primary" />
                    ) : (
                      <Tv className="w-5 h-5 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold mb-1 truncate">
                      {item.title}
                    </h3>
                    <p className="text-sm text-muted-foreground italic">
                      {item.media_type === "movie" ? "Movie" : "TV Show"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-accent fill-accent" />
                    <span className="font-semibold">{Number(item.rating)}</span>
                  </div>
                </Link>
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
            <span className="text-xs border border-primary text-primary px-2 py-1 uppercase tracking-wider">ML Powered</span>
          </div>

          {recsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-start gap-4 pb-4 border-b border-border/50 last:border-0 p-2 -mx-2">
                  <div className="w-12 h-16 bg-muted/20 animate-pulse shrink-0" />
                  <div className="flex-1 space-y-2 pt-1">
                    <div className="h-3.5 bg-muted/20 animate-pulse rounded w-3/4" />
                    <div className="h-3 bg-muted/20 animate-pulse rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : recs.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 border-2 border-muted flex items-center justify-center mx-auto mb-4">
                <Target className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground italic">
                Log more watches to unlock personalised picks
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {recs.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-4 pb-4 border-b border-border/50 last:border-0 hover:bg-muted/20 p-2 -mx-2 transition-all duration-200 group"
                >
                  <Link
                    href={`/protected/media/${item.media_type}/${item.id}`}
                    className="w-12 h-16 border border-accent/30 flex items-center justify-center flex-shrink-0 bg-accent/5 overflow-hidden"
                  >
                    {item.poster_url ? (
                      <img src={upscalePoster(item.poster_url)!} alt={item.title} className="w-full h-full object-cover" />
                    ) : item.media_type === "movie" ? (
                      <Film className="w-5 h-5 text-accent" />
                    ) : (
                      <Tv className="w-5 h-5 text-accent" />
                    )}
                  </Link>
                  <Link href={`/protected/media/${item.media_type}/${item.id}`} className="flex-1 min-w-0">
                    <h3 className="font-semibold mb-1 truncate group-hover:text-primary transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-sm text-muted-foreground italic">
                      {item.media_type === "movie" ? "Movie" : "TV Show"}
                    </p>
                  </Link>
                  <button
                    onClick={() => addToWatchlist(item)}
                    disabled={watchlistedIds.has(item.id)}
                    className="shrink-0 p-1 text-muted-foreground hover:text-primary transition-colors disabled:text-primary"
                    title={watchlistedIds.has(item.id) ? "On watchlist" : "Add to watchlist"}
                  >
                    {watchlistedIds.has(item.id) ? (
                      <BookmarkCheck className="w-4 h-4" />
                    ) : (
                      <Bookmark className="w-4 h-4" />
                    )}
                  </button>
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
          <Button variant="outline" className="h-auto py-6 flex-col gap-3 border-2 hover:-translate-y-1 hover:shadow-md transition-all duration-200" asChild>
            <Link href="/protected/library">
              <Film className="w-6 h-6" />
              <span className="font-semibold">Library</span>
            </Link>
          </Button>
          <Button variant="outline" className="h-auto py-6 flex-col gap-3 border-2 hover:-translate-y-1 hover:shadow-md transition-all duration-200" asChild>
            <Link href="/protected/watchlist">
              <Clock className="w-6 h-6" />
              <span className="font-semibold">Watchlist</span>
            </Link>
          </Button>
          <Button variant="outline" className="group h-auto py-6 flex-col gap-3 border-2 hover:-translate-y-1 hover:shadow-md transition-all duration-200" asChild>
            <Link href="/protected/log">
              <Plus className="w-6 h-6 transition-transform group-hover:rotate-90" />
              <span className="font-semibold">Log Watch</span>
            </Link>
          </Button>
          <Button variant="outline" className="h-auto py-6 flex-col gap-3 border-2 hover:-translate-y-1 hover:shadow-md transition-all duration-200" asChild>
            <Link href="/protected/discover">
              <Target className="w-6 h-6" />
              <span className="font-semibold">Discover</span>
            </Link>
          </Button>
          <Button variant="outline" className="h-auto py-6 flex-col gap-3 border-2 hover:-translate-y-1 hover:shadow-md transition-all duration-200" asChild>
            <Link href="/protected/analytics">
              <BarChart3 className="w-6 h-6" />
              <span className="font-semibold">Analytics</span>
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
