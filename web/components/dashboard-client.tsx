"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Film,
  Tv,
  Plus,
  ChevronRight,
  Bookmark,
  BookmarkCheck,
  Music2,
  Disc3,
  Library,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useMode } from "@/lib/mode-context";

type WatchLog = {
  id: string;
  title: string;
  media_type: "movie" | "tv" | "album" | "track";
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

// ─── Featured Latest Entry card ───────────────────────────────
function FeaturedCard({
  item,
  loading,
  accentColor,
  accentDim,
  mode,
}: {
  item: WatchLog | null;
  loading: boolean;
  accentColor: string;
  accentDim: string;
  mode: "film" | "music";
}) {
  const isMusic = item ? (item.media_type === "album" || item.media_type === "track") : mode === "music";
  const posterUrl = item?.poster_url
    ? item.poster_url.replace(/\/w\d+\//, "/w500/")
    : null;

  if (loading) {
    return (
      <div
        className="animate-pulse"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border-raw)",
          minHeight: 300,
        }}
      />
    );
  }

  // No entries yet — show an invitation
  if (!item) {
    return (
      <div
        className="flex flex-col items-center justify-center text-center p-8"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border-raw)",
          minHeight: 280,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Decorative grid lines */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: "linear-gradient(var(--border-hover) 1px, transparent 1px), linear-gradient(90deg, var(--border-hover) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <div
          className="relative z-10 w-16 h-16 flex items-center justify-center mb-4"
          style={{ border: `1px solid ${accentColor}`, background: accentDim }}
        >
          {isMusic
            ? <Music2 className="w-7 h-7" style={{ color: accentColor }} />
            : <Film className="w-7 h-7" style={{ color: accentColor }} />}
        </div>
        <p
          className="font-display italic text-xl mb-2 relative z-10"
          style={{ color: "var(--text)" }}
        >
          Your story starts here.
        </p>
        <p className="label-upper relative z-10">
          {isMusic ? "Log your first listen" : "Log your first watch"}
        </p>
      </div>
    );
  }

  // Has an entry — show it as a featured poster card
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        border: "1px solid var(--border-raw)",
      }}
    >
      {/* Accent top line */}
      <div className="absolute top-0 left-0 right-0 h-px z-10" style={{ background: accentColor }} />

      {/* Label */}
      <div className="absolute top-3 left-3 z-20">
        <span
          className="label-upper px-2 py-1"
          style={{
            background: "rgba(10,10,8,0.85)",
            border: `1px solid ${accentColor}`,
            color: accentColor,
          }}
        >
          Last {mode === "music" ? "listened" : "watched"}
        </span>
      </div>

      {/* Art */}
      {isMusic ? (
        /* Square album art */
        <div
          className="w-full"
          style={{ aspectRatio: "1 / 1", background: "var(--surface-2)", maxHeight: 300, overflow: "hidden" }}
        >
          {posterUrl ? (
            <img src={posterUrl} alt={item.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Disc3 className="w-16 h-16" style={{ color: "var(--text-dim)" }} />
            </div>
          )}
          {/* Gradient overlay */}
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(to top, rgba(10,10,8,0.95) 0%, rgba(10,10,8,0.3) 50%, transparent 100%)" }}
          />
        </div>
      ) : (
        /* Portrait poster — fill width, cap height */
        <div
          className="w-full"
          style={{ aspectRatio: "2 / 3", background: "var(--surface-2)", maxHeight: 400, overflow: "hidden" }}
        >
          {posterUrl ? (
            <img src={posterUrl} alt={item.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Film className="w-16 h-16" style={{ color: "var(--text-dim)" }} />
            </div>
          )}
          {/* Gradient overlay */}
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(to top, rgba(10,10,8,0.95) 0%, rgba(10,10,8,0.1) 55%, transparent 100%)" }}
          />
        </div>
      )}

      {/* Info overlay */}
      <div
        className="absolute bottom-0 left-0 right-0 p-4 z-20"
      >
        <StarDisplay rating={item.rating} />
        <h3
          className="font-display mt-1 mb-1 leading-tight"
          style={{ fontSize: "20px", fontWeight: 700, color: "var(--text)" }}
        >
          {item.title}
        </h3>
        <p className="label-upper" style={{ color: "var(--text-muted)" }}>
          {item.media_type === "movie" ? "Movie"
            : item.media_type === "tv" ? "TV Show"
            : item.media_type === "album" ? "Album" : "Track"}
          {item.watched_date && ` · ${new Date(item.watched_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`}
        </p>
        {item.review && (
          <p
            className="mt-2 text-[11px] line-clamp-2 italic"
            style={{ color: "var(--text-muted)" }}
          >
            "{item.review}"
          </p>
        )}
      </div>
    </div>
  );
}

// ─── 5-star display (half-star support, ratings stored as 0–5) ─
/** Renders a 5-star display supporting half-stars (ratings stored as 0–5). */
function StarDisplay({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const hasHalf = rating % 1 >= 0.5;
  const empty = 5 - full - (hasHalf ? 1 : 0);

  return (
    <span style={{ letterSpacing: "2px", fontSize: "13px", display: "inline-flex", alignItems: "center", gap: 0 }}>
      <span style={{ color: "var(--mode-accent)" }}>{"★".repeat(full)}</span>
      {hasHalf && <span style={{ color: "var(--mode-accent)", opacity: 0.55 }}>★</span>}
      <span style={{ color: "var(--mode-accent)", opacity: 0.2 }}>{"★".repeat(empty)}</span>
    </span>
  );
}

export function DashboardClient({ userName }: DashboardClientProps) {
  const { mode } = useMode();
  const [watchLogs, setWatchLogs] = useState<WatchLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [recsLoading, setRecsLoading] = useState(true);
  const [watchlistedIds, setWatchlistedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      try {
        const [filmRes, musicRes] = await Promise.all([
          supabase
            .from("watch_logs")
            .select("id, title, media_type, rating, review, watched_date, poster_url, tmdb_id, created_at")
            .order("watched_date", { ascending: false, nullsFirst: false })
            .order("created_at", { ascending: false }),
          supabase
            .from("listen_logs")
            .select("id, title, media_type, rating, review, listened_date, image_url, created_at")
            .order("listened_date", { ascending: false, nullsFirst: false })
            .order("created_at", { ascending: false }),
        ]);
        if (filmRes.error) throw filmRes.error;
        const musicMapped: WatchLog[] = (musicRes.data || []).map((m) => ({
          id: m.id,
          title: m.title,
          media_type: m.media_type as "album" | "track",
          rating: m.rating,
          review: m.review,
          watched_date: m.listened_date,
          poster_url: m.image_url,
          tmdb_id: null,
          created_at: m.created_at,
        }));
        setWatchLogs([...(filmRes.data || []), ...musicMapped]);
      } catch {
        /* silently fail */
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
        /* silently fail — ML backend may not be running */
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
      /* silently fail */
    }
  }

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const filmLogs = watchLogs.filter(i => i.media_type === "movie" || i.media_type === "tv");
  const musicLogs = watchLogs.filter(i => i.media_type === "album" || i.media_type === "track");

  const activeLogs = mode === "music" ? musicLogs : filmLogs;
  const stats = {
    total: watchLogs.length,
    filmCount: filmLogs.length,
    musicCount: musicLogs.length,
    reviews: activeLogs.filter(i => i.review && i.review.trim().length > 0).length,
    avgRating: activeLogs.length > 0
      ? (activeLogs.reduce((acc, i) => acc + Number(i.rating), 0) / activeLogs.length).toFixed(1)
      : "—",
    thisMonth: activeLogs.filter(i => {
      const d = i.watched_date || i.created_at;
      return d >= thisMonthStart;
    }).length,
  };

  // Filter recent items by mode
  const recentItems = (
    mode === "music" ? musicLogs : filmLogs
  ).slice(0, 6);

  const accentColor = mode === "music" ? "var(--music)" : "var(--film)";
  const accentDim = mode === "music" ? "var(--music-dim)" : "var(--film-dim)";

  return (
    <div className="flex flex-col gap-16 animate-[fadeInUp_0.3s_ease]">

      {/* ── Hero ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8 items-start">

        {/* Left: greeting + stats + CTAs */}
        <div>
          <p
            className="font-display text-[14px] italic mb-3"
            style={{ color: "var(--text-muted)" }}
          >
            Good to have you back
          </p>

          <h1
            className="font-display mb-8"
            style={{
              fontSize: "clamp(38px, 5vw, 56px)",
              fontWeight: 300,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              color: "var(--text)",
            }}
          >
            Welcome,{" "}
            <strong style={{ fontWeight: 700 }}>{userName}</strong>
            <br />
            <em style={{ fontStyle: "italic", color: accentColor, transition: "color 0.4s" }}>
              {mode === "music" ? "what are you listening to?" : "what are you watching?"}
            </em>
          </h1>

          {/* Stat row */}
          <div className="flex gap-8 mb-8">
            {[
              { value: mode === "music" ? stats.musicCount : stats.filmCount, label: mode === "music" ? "Logged" : "Watched" },
              { value: stats.reviews, label: "Reviews" },
              { value: stats.avgRating, label: "Avg Rating" },
              { value: stats.thisMonth, label: "This Month" },
            ].map(({ value, label }) => (
              <div key={label}>
                <div
                  className="font-display leading-none mb-1"
                  style={{ fontSize: "38px", fontWeight: 600, color: "var(--text)" }}
                >
                  {loading ? "—" : value}
                </div>
                <div className="label-upper">{label}</div>
              </div>
            ))}
          </div>

          {/* CTAs */}
          <div className="flex gap-3 flex-wrap">
            <Link
              href="/protected/log"
              className="flex items-center gap-2 px-5 py-2.5 text-[11px] font-medium tracking-[0.08em] uppercase transition-all duration-200 hover:opacity-85"
              style={{
                background: accentColor,
                color: "var(--bg)",
                border: `1px solid ${accentColor}`,
              }}
            >
              <Plus className="w-4 h-4" />
              {mode === "music" ? "Log a Listen" : "Log a Watch"}
            </Link>

            <Link
              href="/protected/library"
              className="flex items-center gap-2 px-5 py-2.5 text-[11px] font-medium tracking-[0.08em] uppercase transition-all duration-200"
              style={{
                background: "none",
                color: "var(--text-muted)",
                border: "1px solid var(--border-raw)",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.color = "var(--text)";
                (e.currentTarget as HTMLElement).style.borderColor = "var(--border-hover)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
                (e.currentTarget as HTMLElement).style.borderColor = "var(--border-raw)";
              }}
            >
              <Library className="w-4 h-4" />
              View Library
            </Link>
          </div>
        </div>

        {/* Right: featured latest entry */}
        <FeaturedCard
          item={loading ? null : (mode === "music" ? musicLogs[0] : filmLogs[0]) ?? null}
          loading={loading}
          accentColor={accentColor}
          accentDim={accentDim}
          mode={mode}
        />
      </div>

      {/* ── Recent activity ────────────────────────────────────── */}
      <div>
        <div
          className="flex items-baseline justify-between pb-3 mb-0"
          style={{ borderBottom: "1px solid var(--border-raw)" }}
        >
          <h2
            className="font-display"
            style={{ fontSize: "22px", fontWeight: 600, color: "var(--text)" }}
          >
            {mode === "music" ? "Recent Listens" : "Recent Watches"}
          </h2>
          <Link
            href="/protected/library"
            className="text-[11px] tracking-[0.06em] transition-colors duration-150"
            style={{ color: accentColor }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = "0.75"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = "1"}
          >
            View All →
          </Link>
        </div>

        {loading ? (
          <div className="flex flex-col gap-0">
            {[1, 2, 3, 4].map(i => (
              <div
                key={i}
                className="flex items-center gap-4 py-4"
                style={{ borderBottom: "1px solid var(--border-raw)" }}
              >
                <div
                  className="flex-shrink-0 animate-pulse"
                  style={{ width: 40, height: mode === "music" ? 40 : 56, background: "var(--surface-2)" }}
                />
                <div className="flex-1 flex flex-col gap-2">
                  <div className="h-3 animate-pulse rounded" style={{ background: "var(--surface-2)", width: "55%" }} />
                  <div className="h-2.5 animate-pulse rounded" style={{ background: "var(--surface-2)", width: "30%" }} />
                </div>
              </div>
            ))}
          </div>
        ) : recentItems.length === 0 ? (
          <div className="py-16 text-center">
            <div
              className="w-16 h-16 flex items-center justify-center mx-auto mb-4"
              style={{ background: "var(--surface)", border: "1px solid var(--border-raw)" }}
            >
              {mode === "music"
                ? <Music2 className="w-7 h-7" style={{ color: "var(--text-muted)" }} />
                : <Film className="w-7 h-7" style={{ color: "var(--text-muted)" }} />}
            </div>
            <p
              className="font-display italic text-lg mb-5"
              style={{ color: "var(--text-muted)" }}
            >
              {mode === "music" ? "No listens logged yet" : "No watches yet"}
            </p>
            <Link
              href="/protected/log"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-[11px] font-medium tracking-[0.08em] uppercase transition-all hover:opacity-85"
              style={{ background: accentColor, color: "var(--bg)" }}
            >
              <Plus className="w-3.5 h-3.5" />
              {mode === "music" ? "Log Your First Listen" : "Log Your First Watch"}
            </Link>
          </div>
        ) : (
          <div>
            {recentItems.map((item) => {
              const isMusic = item.media_type === "album" || item.media_type === "track";
              const thumbH = isMusic ? 48 : 68;
              const thumbW = isMusic ? 48 : 44;

              return (
                <Link
                  key={item.id}
                  href={item.tmdb_id ? `/protected/media/${item.media_type}/${item.tmdb_id}` : "#"}
                  className="flex items-start gap-4 py-4 cursor-pointer transition-all duration-150 activity-item group"
                  style={{ paddingLeft: "0", paddingRight: "0" }}
                >
                  {/* Thumbnail */}
                  <div
                    className="flex-shrink-0 flex items-center justify-center overflow-hidden"
                    style={{
                      width: thumbW,
                      height: thumbH,
                      background: "var(--surface)",
                      border: "1px solid var(--border-raw)",
                    }}
                  >
                    {item.poster_url ? (
                      <img
                        src={upscalePoster(item.poster_url)!}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    ) : item.media_type === "movie" ? (
                      <Film className="w-5 h-5" style={{ color: "var(--text-muted)" }} />
                    ) : item.media_type === "tv" ? (
                      <Tv className="w-5 h-5" style={{ color: "var(--text-muted)" }} />
                    ) : (
                      <Disc3 className="w-5 h-5" style={{ color: "var(--text-muted)" }} />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3
                      className="font-display text-base font-semibold truncate mb-0.5 transition-colors duration-150"
                      style={{ color: "var(--text)" }}
                    >
                      {item.title}
                    </h3>
                    <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                      {item.media_type === "movie" ? "Movie"
                        : item.media_type === "tv" ? "TV Show"
                        : item.media_type === "album" ? "Album" : "Track"}
                      {item.watched_date && (
                        <span> · {new Date(item.watched_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                      )}
                    </p>
                  </div>

                  {/* Rating */}
                  <div className="flex-shrink-0 text-right">
                    <StarDisplay rating={item.rating} />
                    <p className="text-[10px] mt-1" style={{ color: "var(--text-dim)", letterSpacing: "0.06em" }}>
                      {item.rating}/5
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Recommendations ────────────────────────────────────── */}
      <div>
        <div
          className="flex items-baseline justify-between pb-3 mb-0"
          style={{ borderBottom: "1px solid var(--border-raw)" }}
        >
          <div className="flex items-center gap-3">
            <h2
              className="font-display"
              style={{ fontSize: "22px", fontWeight: 600, color: "var(--text)" }}
            >
              Recommended
            </h2>
            <span
              className="label-upper px-1.5 py-0.5"
              style={{ border: `1px solid ${accentColor}`, color: accentColor }}
            >
              ML
            </span>
          </div>
          <Link
            href="/protected/discover"
            className="text-[11px] tracking-[0.06em] transition-opacity"
            style={{ color: accentColor }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = "0.75"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = "1"}
          >
            More →
          </Link>
        </div>

        {recsLoading ? (
          <div className="flex flex-col gap-0">
            {[1, 2, 3, 4, 5].map(i => (
              <div
                key={i}
                className="flex items-center gap-4 py-4"
                style={{ borderBottom: "1px solid var(--border-raw)" }}
              >
                <div className="w-11 h-16 flex-shrink-0 animate-pulse" style={{ background: "var(--surface-2)" }} />
                <div className="flex-1 flex flex-col gap-2">
                  <div className="h-3 animate-pulse rounded" style={{ background: "var(--surface-2)", width: "60%" }} />
                  <div className="h-2.5 animate-pulse rounded" style={{ background: "var(--surface-2)", width: "35%" }} />
                </div>
              </div>
            ))}
          </div>
        ) : recs.length === 0 ? (
          <div className="py-12 text-center">
            <p className="font-display italic text-lg" style={{ color: "var(--text-muted)" }}>
              Log more {mode === "music" ? "listens" : "watches"} to unlock personalised picks
            </p>
          </div>
        ) : (
          <div>
            {recs.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-4 py-4 activity-item group"
              >
                <Link
                  href={`/protected/media/${item.media_type}/${item.id}`}
                  className="flex-shrink-0 flex items-center justify-center overflow-hidden"
                  style={{
                    width: 44,
                    height: 62,
                    background: "var(--surface)",
                    border: "1px solid var(--border-raw)",
                  }}
                >
                  {item.poster_url ? (
                    <img
                      src={upscalePoster(item.poster_url)!}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                  ) : item.media_type === "movie" ? (
                    <Film className="w-5 h-5" style={{ color: "var(--text-muted)" }} />
                  ) : (
                    <Tv className="w-5 h-5" style={{ color: "var(--text-muted)" }} />
                  )}
                </Link>

                <Link href={`/protected/media/${item.media_type}/${item.id}`} className="flex-1 min-w-0">
                  <h3
                    className="font-display text-base font-semibold truncate mb-0.5 transition-colors duration-150 group-hover:opacity-75"
                    style={{ color: "var(--text)" }}
                  >
                    {item.title}
                  </h3>
                  <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                    {item.media_type === "movie" ? "Movie" : "TV Show"}
                    {item.vote_average && ` · ${item.vote_average.toFixed(1)} TMDB`}
                  </p>
                </Link>

                <button
                  onClick={() => addToWatchlist(item)}
                  disabled={watchlistedIds.has(item.id)}
                  className="flex-shrink-0 p-1.5 transition-colors duration-150"
                  style={{ color: watchlistedIds.has(item.id) ? accentColor : "var(--text-muted)" }}
                  title={watchlistedIds.has(item.id) ? "On watchlist" : "Add to watchlist"}
                >
                  {watchlistedIds.has(item.id)
                    ? <BookmarkCheck className="w-4 h-4" />
                    : <Bookmark className="w-4 h-4" />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
