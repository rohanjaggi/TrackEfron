"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Star,
  Clock,
  Calendar,
  Tv,
  Film,
  Loader2,
  Users,
  BookmarkPlus,
  Play,
  Pencil,
  Check,
  Trash2,
  ListPlus,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Genre = { id: number; name: string };

type MediaDetail = {
  id: number;
  overview: string;
  poster_url: string | null;
  backdrop_url: string | null;
  genres: Genre[];
  vote_average: number;
  vote_count: number;
  tagline?: string;
  status: string;
  credits?: {
    cast: {
      id: number;
      name: string;
      character: string;
      profile_path: string | null;
    }[];
  };
  // Movie fields
  title?: string;
  release_date?: string;
  runtime?: number;
  // TV fields
  name?: string;
  first_air_date?: string;
  last_air_date?: string;
  number_of_seasons?: number;
  number_of_episodes?: number;
  episode_run_time?: number[];
  created_by?: { id: number; name: string }[];
  networks?: { id: number; name: string; logo_path: string | null }[];
};

type UserWatchLog = {
  id: string;
  rating: number;
  review: string | null;
  watched_date: string | null;
  plot_rating: number | null;
  cinematography_rating: number | null;
  acting_rating: number | null;
  soundtrack_rating: number | null;
  pacing_rating: number | null;
  casting_rating: number | null;
};

type UserListInfo = {
  id: string;
  name: string;
  emoji: string | null;
  hasItem: boolean;
};

type WatchProvider = {
  logo_path: string;
  provider_id: number;
  provider_name: string;
};

type WatchProviders = {
  flatrate?: WatchProvider[];
  rent?: WatchProvider[];
  buy?: WatchProvider[];
  link?: string;
};

export default function MediaDetailPage() {
  return (
    <Suspense>
      <MediaDetailContent />
    </Suspense>
  );
}

function MediaDetailContent() {
  const params = useParams();
  const router = useRouter();
  const type = params.type as string;
  const id = params.id as string;

  const [detail, setDetail] = useState<MediaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // User-specific state
  const [watchLog, setWatchLog] = useState<UserWatchLog | null>(null);
  const [isOnWatchlist, setIsOnWatchlist] = useState(false);
  const [watchlistItemId, setWatchlistItemId] = useState<string | null>(null);
  const [userDataLoading, setUserDataLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [watchlistLoading, setWatchlistLoading] = useState(false);

  // Lists state
  const [userLists, setUserLists] = useState<UserListInfo[]>([]);
  const [showListDropdown, setShowListDropdown] = useState(false);
  const [togglingListId, setTogglingListId] = useState<string | null>(null);
  const listDropdownRef = useRef<HTMLDivElement>(null);

  // Watch providers
  const [providers, setProviders] = useState<WatchProviders | null>(null);

  // Fetch TMDB detail
  useEffect(() => {
    if (type !== "movie" && type !== "tv") {
      setError("Invalid media type");
      setLoading(false);
      return;
    }
    async function fetchDetail() {
      try {
        setLoading(true);
        const [detailRes, providersRes] = await Promise.all([
          fetch(`/api?action=detail&type=${type}&id=${id}`),
          fetch(`/api?action=providers&type=${type}&id=${id}`),
        ]);
        if (!detailRes.ok) throw new Error("Failed to fetch details");
        const data = await detailRes.json();
        setDetail(data);

        if (providersRes.ok) {
          const provData = await providersRes.json();
          // Use US providers by default, fallback to GB, AU
          const regionData = provData.US || provData.GB || provData.AU || null;
          setProviders(regionData);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchDetail();
  }, [type, id]);

  // Fetch user's watch log and watchlist status
  useEffect(() => {
    async function fetchUserData() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setUserDataLoading(false); return; }

        const tmdbId = Number(id);

        const [logRes, wlRes, listsRes] = await Promise.all([
          supabase
            .from("watch_logs")
            .select("id, rating, review, watched_date, plot_rating, cinematography_rating, acting_rating, soundtrack_rating, pacing_rating, casting_rating")
            .eq("tmdb_id", tmdbId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("watchlist")
            .select("id")
            .eq("tmdb_id", tmdbId)
            .maybeSingle(),
          supabase
            .from("lists")
            .select("id, name, emoji, list_items!inner(tmdb_id)")
            .order("updated_at", { ascending: false }),
        ]);

        if (logRes.data) setWatchLog(logRes.data);
        if (wlRes.data) {
          setIsOnWatchlist(true);
          setWatchlistItemId(wlRes.data.id);
        }

        // Also fetch all lists (without inner join) to get lists that may be empty
        const { data: allLists } = await supabase
          .from("lists")
          .select("id, name, emoji")
          .order("updated_at", { ascending: false });

        if (allLists) {
          const itemsInLists = new Set<string>();
          if (listsRes.data) {
            for (const l of listsRes.data as any[]) {
              const items = l.list_items || [];
              if (items.some((i: any) => i.tmdb_id === tmdbId)) {
                itemsInLists.add(l.id);
              }
            }
          }
          setUserLists(
            allLists.map((l) => ({
              id: l.id,
              name: l.name,
              emoji: l.emoji,
              hasItem: itemsInLists.has(l.id),
            }))
          );
        }
      } catch {
        // silently fail
      } finally {
        setUserDataLoading(false);
      }
    }
    fetchUserData();
  }, [id]);

  async function handleAddToWatchlist() {
    if (!detail) return;
    setWatchlistLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const displayTitle = detail.title || detail.name || "Unknown";
      const { data, error } = await supabase
        .from("watchlist")
        .insert({
          user_id: user.id,
          tmdb_id: Number(id),
          title: displayTitle,
          media_type: type,
          poster_url: detail.poster_url,
        })
        .select("id")
        .single();
      if (error?.code === "23505") {
        setIsOnWatchlist(true);
      } else if (data) {
        setIsOnWatchlist(true);
        setWatchlistItemId(data.id);
      }
    } catch {
      // silently fail
    } finally {
      setWatchlistLoading(false);
    }
  }

  async function handleRemoveFromWatchlist() {
    if (!watchlistItemId) return;
    setWatchlistLoading(true);
    try {
      const supabase = createClient();
      await supabase.from("watchlist").delete().eq("id", watchlistItemId);
      setIsOnWatchlist(false);
      setWatchlistItemId(null);
    } catch {
      // silently fail
    } finally {
      setWatchlistLoading(false);
    }
  }

  async function handleDeleteLog() {
    if (!watchLog) return;
    try {
      const supabase = createClient();
      await supabase.from("watch_logs").delete().eq("id", watchLog.id);
      setWatchLog(null);
      setConfirmDelete(false);
    } catch {
      // silently fail
    }
  }

  // Close list dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (listDropdownRef.current && !listDropdownRef.current.contains(e.target as Node)) {
        setShowListDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleToggleList(listId: string, currentlyHasItem: boolean) {
    setTogglingListId(listId);
    try {
      const supabase = createClient();
      if (currentlyHasItem) {
        await supabase
          .from("list_items")
          .delete()
          .eq("list_id", listId)
          .eq("tmdb_id", Number(id));
      } else {
        const displayTitle = detail?.title || detail?.name || "Unknown";
        const { error } = await supabase.from("list_items").insert({
          list_id: listId,
          tmdb_id: Number(id),
          title: displayTitle,
          media_type: type,
          poster_url: detail?.poster_url || null,
        });
        if (error && error.code !== "23505") throw error;
      }
      // Update local state
      setUserLists((prev) =>
        prev.map((l) =>
          l.id === listId ? { ...l, hasItem: !currentlyHasItem } : l
        )
      );
    } catch {
      // silently fail
    } finally {
      setTogglingListId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="flex flex-col gap-4 max-w-3xl mx-auto">
        <Link
          href="/protected/discover"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Discover
        </Link>
        <div className="border-2 border-destructive bg-destructive/10 p-6 text-destructive">
          {error || "Media not found"}
        </div>
      </div>
    );
  }

  const displayTitle = detail.title || detail.name || "Unknown";
  const year = (detail.release_date || detail.first_air_date || "").slice(0, 4);
  const isMovie = type === "movie";
  const runtime = isMovie
    ? detail.runtime
      ? `${detail.runtime} min`
      : null
    : detail.episode_run_time?.length
      ? `${detail.episode_run_time[0]} min/ep`
      : null;
  const topCast = detail.credits?.cast?.slice(0, 6) ?? [];

  const categoryRatings = [
    { label: "Plot", value: watchLog?.plot_rating },
    { label: "Cinematography", value: watchLog?.cinematography_rating },
    { label: "Acting", value: watchLog?.acting_rating },
    { label: "Soundtrack", value: watchLog?.soundtrack_rating },
    { label: "Pacing", value: watchLog?.pacing_rating },
    { label: "Casting", value: watchLog?.casting_rating },
  ].filter((c) => c.value && c.value > 0);

  return (
    <div className="flex flex-col gap-0 max-w-5xl mx-auto w-full">
      {/* Back button */}
      <div className="mb-6">
        <Link
          href="/protected/discover"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Discover
        </Link>
      </div>

      {/* Backdrop */}
      {detail.backdrop_url && (
        <div className="relative w-full h-48 md:h-72 overflow-hidden border-2 border-border mb-8">
          <img
            src={detail.backdrop_url}
            alt={displayTitle}
            className="w-full h-full object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        </div>
      )}

      {/* Main content grid */}
      <div className="grid md:grid-cols-[auto,1fr] gap-8">
        {/* Poster column */}
        <div className="flex flex-col gap-4 w-44 md:w-56">
          <div className="border-2 border-border overflow-hidden shrink-0">
            {detail.poster_url ? (
              <img
                src={detail.poster_url}
                alt={displayTitle}
                className="w-full object-cover"
              />
            ) : (
              <div className="aspect-[2/3] bg-muted flex items-center justify-center">
                {isMovie
                  ? <Film className="w-12 h-12 text-muted-foreground" />
                  : <Tv className="w-12 h-12 text-muted-foreground" />}
              </div>
            )}
          </div>

          {/* Action Buttons (not watched) */}
          {!userDataLoading && !watchLog && (
            <div className="flex flex-col gap-2">
              <Button
                className="w-full border-2"
                onClick={() => router.push("/protected/log")}
              >
                <Play className="w-4 h-4 mr-2" /> Log Watch
              </Button>
              {isOnWatchlist ? (
                <Button
                  variant="outline"
                  className="w-full border-2 text-muted-foreground"
                  onClick={handleRemoveFromWatchlist}
                  disabled={watchlistLoading}
                >
                  <Check className="w-4 h-4 mr-2" /> On Watchlist
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="w-full border-2"
                  onClick={handleAddToWatchlist}
                  disabled={watchlistLoading}
                >
                  <BookmarkPlus className="w-4 h-4 mr-2" /> Add to Watchlist
                </Button>
              )}
            </div>
          )}

          {/* Add to List (always available) */}
          {!userDataLoading && userLists.length > 0 && (
            <div className="relative" ref={listDropdownRef}>
              <Button
                variant="outline"
                className="w-full border-2"
                onClick={() => setShowListDropdown(!showListDropdown)}
              >
                <ListPlus className="w-4 h-4 mr-2" /> Add to List
              </Button>
              {showListDropdown && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 border-2 border-border bg-card shadow-lg max-h-60 overflow-auto">
                  {userLists.map((list) => (
                    <button
                      key={list.id}
                      type="button"
                      onClick={() => handleToggleList(list.id, list.hasItem)}
                      disabled={togglingListId === list.id}
                      className="w-full text-left px-4 py-3 hover:bg-muted flex items-center gap-3 transition-colors text-sm"
                    >
                      <span className="text-lg">{list.emoji || "🎬"}</span>
                      <span className="flex-1 truncate">{list.name}</span>
                      {togglingListId === list.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />
                      ) : list.hasItem ? (
                        <Check className="w-4 h-4 text-primary shrink-0" />
                      ) : null}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Where to Watch */}
          {providers && (providers.flatrate || providers.rent || providers.buy) && (() => {
            // Deduplicate providers across categories, prioritising stream > rent > buy
            const seen = new Set<number>();
            const allProviders: (WatchProvider & { category: string })[] = [];
            for (const [cat, list] of [
              ["Stream", providers.flatrate],
              ["Rent", providers.rent],
              ["Buy", providers.buy],
            ] as [string, WatchProvider[] | undefined][]) {
              if (!list) continue;
              for (const p of list) {
                if (!seen.has(p.provider_id)) {
                  seen.add(p.provider_id);
                  allProviders.push({ ...p, category: cat });
                }
              }
            }
            if (allProviders.length === 0) return null;
            return (
              <div className="border-2 border-border p-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider">Where to Watch</h3>
                  <a
                    href={`https://www.justwatch.com/us/${isMovie ? "movie" : "tv-show"}/${displayTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <span className="font-semibold text-[#EEC12F]">JustWatch</span>
                  </a>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {allProviders.map((p) => (
                    <img
                      key={p.provider_id}
                      src={`https://image.tmdb.org/t/p/w154${p.logo_path}`}
                      alt={p.provider_name}
                      title={`${p.provider_name} (${p.category})`}
                      className="w-8 h-8 rounded border border-border object-cover"
                    />
                  ))}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Info column */}
        <div className="flex flex-col gap-6">
          {/* Title block */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-xs border-2">
                {isMovie ? "Movie" : "TV Show"}
              </Badge>
              {detail.status && (
                <Badge variant="secondary" className="text-xs">
                  {detail.status}
                </Badge>
              )}
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-bold mb-1">{displayTitle}</h1>
            {detail.tagline && (
              <p className="text-muted-foreground italic text-lg">&ldquo;{detail.tagline}&rdquo;</p>
            )}
          </div>

          {/* Key metadata row */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            {year && (
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                {year}
              </span>
            )}
            {runtime && (
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                {runtime}
              </span>
            )}
            {detail.vote_average > 0 && (
              <span className="flex items-center gap-1.5">
                <Star className="w-4 h-4 text-accent fill-accent" />
                <span className="font-semibold text-foreground">
                  {detail.vote_average.toFixed(1)}
                </span>
                <span>({detail.vote_count.toLocaleString()} votes)</span>
              </span>
            )}
            {!isMovie && detail.number_of_seasons != null && (
              <span className="flex items-center gap-1.5">
                <Tv className="w-4 h-4" />
                {detail.number_of_seasons} season{detail.number_of_seasons !== 1 ? "s" : ""}
                {detail.number_of_episodes != null &&
                  ` · ${detail.number_of_episodes} episodes`}
              </span>
            )}
          </div>

          {/* Genres */}
          {detail.genres?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {detail.genres.map((g) => (
                <Badge key={g.id} variant="outline" className="border-2">
                  {g.name}
                </Badge>
              ))}
            </div>
          )}

          {/* Overview */}
          {detail.overview && (
            <div className="border-2 border-border p-4 bg-muted/10">
              <h2 className="font-semibold mb-2">Overview</h2>
              <p className="text-muted-foreground leading-relaxed">{detail.overview}</p>
            </div>
          )}

          {/* TV-specific info */}
          {!isMovie && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              {detail.created_by?.length ? (
                <div>
                  <span className="font-semibold block mb-1">Created by</span>
                  <span className="text-muted-foreground">
                    {detail.created_by.map((c) => c.name).join(", ")}
                  </span>
                </div>
              ) : null}
              {detail.networks?.length ? (
                <div>
                  <span className="font-semibold block mb-1">Network</span>
                  <span className="text-muted-foreground">
                    {detail.networks.map((n) => n.name).join(", ")}
                  </span>
                </div>
              ) : null}
              {detail.last_air_date && (
                <div>
                  <span className="font-semibold block mb-1">Last aired</span>
                  <span className="text-muted-foreground">
                    {detail.last_air_date.slice(0, 4)}
                  </span>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Cast — full width */}
      {topCast.length > 0 && (
        <div className="mt-8">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <Users className="w-4 h-4" />
            Top Cast
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {topCast.map((member) => (
              <div
                key={member.id}
                className="border-2 border-border p-3 text-sm"
              >
                <div className="font-medium truncate">{member.name}</div>
                <div className="text-muted-foreground text-xs truncate">
                  {member.character}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Your Review — full width */}
      {!userDataLoading && watchLog && (
        <div className="border-2 border-primary/30 bg-primary/5 p-6 md:p-8 mt-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-primary">Your Review</h3>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="border-2"
                onClick={() => router.push(`/protected/log?edit=${watchLog.id}`)}
              >
                <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
              </Button>
              {confirmDelete ? (
                <>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleDeleteLog}
                  >
                    Confirm
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-2"
                    onClick={() => setConfirmDelete(false)}
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete
                </Button>
              )}
            </div>
          </div>

          <div className="grid md:grid-cols-[1fr,auto] gap-6 md:gap-10">
            {/* Left: rating, date, review text */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <Star className="w-5 h-5 text-accent fill-accent" />
                  <span className="font-bold text-xl">{watchLog.rating}</span>
                  <span className="text-muted-foreground text-sm">/5</span>
                </div>
                {watchLog.watched_date && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Calendar className="w-3.5 h-3.5" />
                    Watched {new Date(watchLog.watched_date).toLocaleDateString()}
                  </div>
                )}
              </div>
              {watchLog.review && (
                <p className="text-muted-foreground leading-relaxed">{watchLog.review}</p>
              )}
            </div>

            {/* Right: category ratings */}
            {categoryRatings.length > 0 && (
              <div className="space-y-2 md:border-l md:border-border md:pl-8 min-w-[200px]">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Category Ratings</h4>
                {categoryRatings.map((c) => (
                  <div key={c.label} className="flex items-center justify-between gap-4 text-sm">
                    <span className="text-muted-foreground">{c.label}</span>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`w-3.5 h-3.5 ${
                            s <= c.value!
                              ? "text-accent fill-accent"
                              : "text-muted-foreground/20"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
