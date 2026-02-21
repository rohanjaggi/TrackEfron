"use client";

import {
  BarChart3,
  TrendingUp,
  Star,
  Film,
  Tv,
  Calendar,
  Clock,
  Feather,
} from "lucide-react";

export default function AnalyticsPage() {
  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">Analytics</h1>
        <p className="text-muted-foreground">
          Insights into your watching habits and taste profile
        </p>
      </div>

      {/* Overview Stats Skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Film, label: "Total Watched" },
          { icon: Clock, label: "Hours Watched" },
          { icon: Star, label: "Avg Rating" },
          { icon: Calendar, label: "This Month" },
        ].map(({ icon: Icon, label }) => (
          <div key={label} className="border-2 border-border p-5 text-center">
            <Icon className="w-5 h-5 text-primary mx-auto mb-3" />
            <div className="h-8 w-16 mx-auto bg-muted/50 animate-pulse rounded mb-2" />
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Rating Distribution */}
        <div className="border-2 border-border p-6">
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 className="w-5 h-5 text-primary" />
            <h2 className="font-display text-xl font-bold">Rating Distribution</h2>
          </div>
          <div className="space-y-3">
            {[
              { rating: 5, w: "70%" },
              { rating: 4, w: "55%" },
              { rating: 3, w: "40%" },
              { rating: 2, w: "30%" },
              { rating: 1, w: "20%" },
            ].map(({ rating, w }) => (
              <div key={rating} className="flex items-center gap-3">
                <span className="text-sm font-medium w-4">{rating}</span>
                <Star className="w-3.5 h-3.5 text-accent fill-accent" />
                <div className="flex-1 h-6 bg-muted/30 rounded overflow-hidden">
                  <div className="h-full bg-muted/50 animate-pulse rounded" style={{ width: w }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Genre Breakdown */}
        <div className="border-2 border-border p-6">
          <div className="flex items-center gap-2 mb-6">
            <Film className="w-5 h-5 text-accent" />
            <h2 className="font-display text-xl font-bold">Top Genres</h2>
          </div>
          <div className="space-y-3">
            {["Action", "Drama", "Comedy", "Thriller", "Sci-Fi"].map((genre) => (
              <div key={genre} className="flex items-center justify-between">
                <span className="text-sm">{genre}</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 h-4 bg-muted/50 animate-pulse rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Movies vs TV */}
        <div className="border-2 border-border p-6">
          <div className="flex items-center gap-2 mb-6">
            <Tv className="w-5 h-5 text-secondary" />
            <h2 className="font-display text-xl font-bold">Movies vs TV Shows</h2>
          </div>
          <div className="flex items-center justify-center py-8">
            <div className="w-40 h-40 rounded-full border-[12px] border-muted/30 animate-pulse" />
          </div>
        </div>

        {/* Watching Trends */}
        <div className="border-2 border-border p-6">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5 text-primary" />
            <h2 className="font-display text-xl font-bold">Monthly Activity</h2>
          </div>
          <div className="flex items-end gap-2 h-40 pt-4">
            {[
              { m: "J", h: "45%" }, { m: "F", h: "60%" }, { m: "M", h: "35%" },
              { m: "A", h: "80%" }, { m: "M", h: "50%" }, { m: "J", h: "70%" },
              { m: "J", h: "90%" }, { m: "A", h: "40%" }, { m: "S", h: "55%" },
              { m: "O", h: "65%" }, { m: "N", h: "75%" }, { m: "D", h: "30%" },
            ].map(({ m, h }, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-muted/50 animate-pulse rounded-t"
                  style={{ height: h }}
                />
                <span className="text-[10px] text-muted-foreground">{m}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Category Ratings Breakdown */}
      <div className="border-2 border-border p-6">
        <div className="flex items-center gap-2 mb-6">
          <Star className="w-5 h-5 text-accent" />
          <h2 className="font-display text-xl font-bold">Category Averages</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {["Plot", "Cinematography", "Acting", "Soundtrack", "Pacing", "Casting"].map((cat) => (
            <div key={cat} className="text-center p-4 border border-border">
              <div className="h-7 w-12 mx-auto bg-muted/50 animate-pulse rounded mb-2" />
              <p className="text-xs text-muted-foreground">{cat}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Coming Soon Notice */}
      <div className="border-2 border-dashed border-border p-8 text-center">
        <Feather className="w-6 h-6 text-muted-foreground mx-auto mb-3" />
        <h3 className="font-display text-lg font-semibold mb-1">Coming Soon</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Full analytics with interactive charts, taste profiles, and personalised insights are on the way.
        </p>
      </div>
    </div>
  );
}
