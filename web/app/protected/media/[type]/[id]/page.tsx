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
  Disc3,
  Music2,
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
  title?: string;
  release_date?: string;
  runtime?: number;
  name?: string;
  first_air_date?: string;
  last_air_date?: string;
  number_of_seasons?: number;
  number_of_episodes?: number;
  episode_run_time?: number[];
  created_by?: { id: number; name: string }[];
  networks?: { id: number; name: string; logo_path: string | null }[];
};

type MusicDetail = {
  id: string;
  name: string;
  artist: string;
  album_name: string;
  image_url: string | null;
  release_date: string;
  type: "album" | "track";
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

type UserListenLog = {
  id: string;
  rating: number;
  review: string | null;
  listened_date: string | null;
  lyrics_rating: number | null;
  production_rating: number | null;
  vocals_rating: number | null;
  melody_rating: number | null;
  replay_rating: number | null;
  energy_rating: number | null;
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

  const isMusic = type === "album" || type === "track";
  const isFilm = type === "movie" || type === "tv";

  const [detail, setDetail] = useState<MediaDetail | null>(null);
  const [musicDetail, setMusicDetail] = useState<MusicDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // User-specific state (film)
  const [watchLog, setWatchLog] = useState<UserWatchLog | null>(null);
  const [isOnWatchlist, setIsOnWatchlist] = useState(false);
  const [watchlistItemId, setWatchlistItemId] = useState<string | null>(null);
  const [userDataLoading, setUserDataLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [watchlistLoading, setWatchlistLoading] = useState(false);

  // User-specific state (music)
  const [listenLog, setListenLog] = useState<UserListenLog | null>(null);
  const [isInQueue, setIsInQueue] = useState(false);
  const [queueItemId, setQueueItemId] = useState<string | null>(null);

  // Lists state
  const [userLists, setUserLists] = useState<UserListInfo[]>([]);
  const [showListDropdown, setShowListDropdown] = useState(false);
  const [togglingListId, setTogglingListId] = useState<string | null>(null);
  const listDropdownRef = useRef<HTMLDivElement>(null);

  // Watch providers (film only)
  const [providers, setProviders] = useState<WatchProviders | null>(null);

  // Fetch detail
  useEffect(() => {
    if (!isFilm && !isMusic) {
      setError("Invalid media type");
      setLoading(false);
      return;
    }

    async function fetchDetail() {
      try {
        setLoading(true);
        if (isMusic) {
          const res = await fetch(`/api/spotify?action=detail&id=${id}&type=${type}`);
          if (!res.ok) throw new Error("Failed to fetch details");
          const data = await res.json();
          setMusicDetail(data);
        } else {
          const [detailRes, providersRes] = await Promise.all([
            fetch(`/api?action=detail&type=${type}&id=${id}`),
            fetch(`/api?action=providers&type=${type}&id=${id}`),
          ]);
          if (!detailRes.ok) throw new Error("Failed to fetch details");
          const data = await detailRes.json();
          setDetail(data);

          if (providersRes.ok) {
            const provData = await providersRes.json();
            const regionData = provData.US || provData.GB || provData.AU || null;
            setProviders(regionData);
          }
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchDetail();
  }, [type, id, isFilm, isMusic]);

  // Fetch user data
  useEffect(() => {
    async function fetchUserData() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setUserDataLoading(false); return; }

        const listMode = isMusic ? "music" : "film";

        if (isMusic) {
          const [logRes, queueRes] = await Promise.all([
            supabase
              .from("listen_logs")
              .select("id, rating, review, listened_date, lyrics_rating, production_rating, vocals_rating, melody_rating, replay_rating, energy_rating")
              .eq("spotify_id", id)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle(),
            supabase
              .from("music_queue")
              .select("id")
              .eq("spotify_id", id)
              .maybeSingle(),
          ]);

          if (logRes.data) setListenLog(logRes.data);
          if (queueRes.data) {
            setIsInQueue(true);
            setQueueItemId(queueRes.data.id);
          }
        } else {
          const tmdbId = Number(id);
          const [logRes, wlRes] = await Promise.all([
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
          ]);

          if (logRes.data) setWatchLog(logRes.data);
          if (wlRes.data) {
            setIsOnWatchlist(true);
            setWatchlistItemId(wlRes.data.id);
          }
        }

        // Fetch lists filtered by mode
        const { data: allLists } = await supabase
          .from("lists")
          .select("id, name, emoji")
          .eq("list_type", listMode)
          .order("updated_at", { ascending: false });

        if (allLists) {
          // Check which lists already contain this item
          const matchCol = isMusic ? "spotify_id" : "tmdb_id";
          const matchVal = isMusic ? id : Number(id);
          const { data: listItemsData } = await supabase
            .from("list_items")
            .select("list_id")
            .eq(matchCol, matchVal);

          const listsWithItem = new Set((listItemsData || []).map((li: any) => li.list_id));

          setUserLists(
            allLists.map((l) => ({
              id: l.id,
              name: l.name,
              emoji: l.emoji,
              hasItem: listsWithItem.has(l.id),
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
  }, [id, isMusic]);

  // Film: add/remove watchlist
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

  // Music: add/remove queue
  async function handleAddToQueue() {
    if (!musicDetail) return;
    setWatchlistLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from("music_queue")
        .insert({
          user_id: user.id,
          spotify_id: id,
          media_type: type,
          title: musicDetail.name,
          artist: musicDetail.artist,
          image_url: musicDetail.image_url,
        })
        .select("id")
        .single();
      if (error?.code === "23505") {
        setIsInQueue(true);
      } else if (data) {
        setIsInQueue(true);
        setQueueItemId(data.id);
      }
    } catch {
      // silently fail
    } finally {
      setWatchlistLoading(false);
    }
  }

  async function handleRemoveFromQueue() {
    if (!queueItemId) return;
    setWatchlistLoading(true);
    try {
      const supabase = createClient();
      await supabase.from("music_queue").delete().eq("id", queueItemId);
      setIsInQueue(false);
      setQueueItemId(null);
    } catch {
      // silently fail
    } finally {
      setWatchlistLoading(false);
    }
  }

  // Delete log
  async function handleDeleteLog() {
    if (isMusic && listenLog) {
      try {
        const supabase = createClient();
        await supabase.from("listen_logs").delete().eq("id", listenLog.id);
        setListenLog(null);
        setConfirmDelete(false);
      } catch { /* silently fail */ }
    } else if (watchLog) {
      try {
        const supabase = createClient();
        await supabase.from("watch_logs").delete().eq("id", watchLog.id);
        setWatchLog(null);
        setConfirmDelete(false);
      } catch { /* silently fail */ }
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
        if (isMusic) {
          await supabase
            .from("list_items")
            .delete()
            .eq("list_id", listId)
            .eq("spotify_id", id);
        } else {
          await supabase
            .from("list_items")
            .delete()
            .eq("list_id", listId)
            .eq("tmdb_id", Number(id));
        }
      } else {
        if (isMusic) {
          const { error } = await supabase.from("list_items").insert({
            list_id: listId,
            spotify_id: id,
            title: musicDetail?.name || "Unknown",
            artist: musicDetail?.artist || null,
            media_type: type,
            image_url: musicDetail?.image_url || null,
          });
          if (error && error.code !== "23505") throw error;
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
      }
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

  if (error || (!detail && !musicDetail)) {
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

  if (isMusic && musicDetail) {
    return <MusicDetailView
      musicDetail={musicDetail}
      type={type as "album" | "track"}
      id={id}
      listenLog={listenLog}
      isInQueue={isInQueue}
      userDataLoading={userDataLoading}
      watchlistLoading={watchlistLoading}
      confirmDelete={confirmDelete}
      setConfirmDelete={setConfirmDelete}
      userLists={userLists}
      showListDropdown={showListDropdown}
      setShowListDropdown={setShowListDropdown}
      togglingListId={togglingListId}
      listDropdownRef={listDropdownRef}
      router={router}
      onAddToQueue={handleAddToQueue}
      onRemoveFromQueue={handleRemoveFromQueue}
      onDeleteLog={handleDeleteLog}
      onToggleList={handleToggleList}
    />;
  }

  // ─── Film Detail View ───
  const displayTitle = detail!.title || detail!.name || "Unknown";
  const year = (detail!.release_date || detail!.first_air_date || "").slice(0, 4);
  const isMovie = type === "movie";
  const runtime = isMovie
    ? detail!.runtime
      ? `${detail!.runtime} min`
      : null
    : detail!.episode_run_time?.length
      ? `${detail!.episode_run_time[0]} min/ep`
      : null;
  const topCast = detail!.credits?.cast?.slice(0, 6) ?? [];

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
      {detail!.backdrop_url && (
        <div className="relative w-full h-48 md:h-72 overflow-hidden border-2 border-border mb-8">
          <img
            src={detail!.backdrop_url}
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
            {detail!.poster_url ? (
              <img
                src={detail!.poster_url}
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

          {/* Add to List */}
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
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-xs border-2">
                {isMovie ? "Movie" : "TV Show"}
              </Badge>
              {detail!.status && (
                <Badge variant="secondary" className="text-xs">
                  {detail!.status}
                </Badge>
              )}
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-bold mb-1">{displayTitle}</h1>
            {detail!.tagline && (
              <p className="text-muted-foreground italic text-lg">&ldquo;{detail!.tagline}&rdquo;</p>
            )}
          </div>

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
            {detail!.vote_average > 0 && (
              <span className="flex items-center gap-1.5">
                <Star className="w-4 h-4 text-accent fill-accent" />
                <span className="font-semibold text-foreground">
                  {detail!.vote_average.toFixed(1)}
                </span>
                <span>({detail!.vote_count.toLocaleString()} votes)</span>
              </span>
            )}
            {!isMovie && detail!.number_of_seasons != null && (
              <span className="flex items-center gap-1.5">
                <Tv className="w-4 h-4" />
                {detail!.number_of_seasons} season{detail!.number_of_seasons !== 1 ? "s" : ""}
                {detail!.number_of_episodes != null &&
                  ` · ${detail!.number_of_episodes} episodes`}
              </span>
            )}
          </div>

          {detail!.genres?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {detail!.genres.map((g) => (
                <Badge key={g.id} variant="outline" className="border-2">
                  {g.name}
                </Badge>
              ))}
            </div>
          )}

          {detail!.overview && (
            <div className="border-2 border-border p-4 bg-muted/10">
              <h2 className="font-semibold mb-2">Overview</h2>
              <p className="text-muted-foreground leading-relaxed">{detail!.overview}</p>
            </div>
          )}

          {!isMovie && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              {detail!.created_by?.length ? (
                <div>
                  <span className="font-semibold block mb-1">Created by</span>
                  <span className="text-muted-foreground">
                    {detail!.created_by.map((c) => c.name).join(", ")}
                  </span>
                </div>
              ) : null}
              {detail!.networks?.length ? (
                <div>
                  <span className="font-semibold block mb-1">Network</span>
                  <span className="text-muted-foreground">
                    {detail!.networks.map((n) => n.name).join(", ")}
                  </span>
                </div>
              ) : null}
              {detail!.last_air_date && (
                <div>
                  <span className="font-semibold block mb-1">Last aired</span>
                  <span className="text-muted-foreground">
                    {detail!.last_air_date.slice(0, 4)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Cast */}
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

      {/* Your Review */}
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
                  <Button size="sm" variant="destructive" onClick={handleDeleteLog}>Confirm</Button>
                  <Button size="sm" variant="outline" className="border-2" onClick={() => setConfirmDelete(false)}>Cancel</Button>
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

// ─── Music Detail View ──────────────────────────────────────────────────────────

function MusicDetailView({
  musicDetail,
  type,
  id,
  listenLog,
  isInQueue,
  userDataLoading,
  watchlistLoading,
  confirmDelete,
  setConfirmDelete,
  userLists,
  showListDropdown,
  setShowListDropdown,
  togglingListId,
  listDropdownRef,
  router,
  onAddToQueue,
  onRemoveFromQueue,
  onDeleteLog,
  onToggleList,
}: {
  musicDetail: MusicDetail;
  type: "album" | "track";
  id: string;
  listenLog: UserListenLog | null;
  isInQueue: boolean;
  userDataLoading: boolean;
  watchlistLoading: boolean;
  confirmDelete: boolean;
  setConfirmDelete: (v: boolean) => void;
  userLists: UserListInfo[];
  showListDropdown: boolean;
  setShowListDropdown: (v: boolean) => void;
  togglingListId: string | null;
  listDropdownRef: React.RefObject<HTMLDivElement | null>;
  router: ReturnType<typeof useRouter>;
  onAddToQueue: () => void;
  onRemoveFromQueue: () => void;
  onDeleteLog: () => void;
  onToggleList: (listId: string, hasItem: boolean) => void;
}) {
  const year = (musicDetail.release_date || "").slice(0, 4);
  const isAlbum = type === "album";

  const categoryRatings = [
    { label: "Lyrics", value: listenLog?.lyrics_rating },
    { label: "Production", value: listenLog?.production_rating },
    { label: "Vocals", value: listenLog?.vocals_rating },
    { label: "Melody", value: listenLog?.melody_rating },
    { label: "Replay Value", value: listenLog?.replay_rating },
    { label: "Energy", value: listenLog?.energy_rating },
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

      {/* Main content grid */}
      <div className="grid md:grid-cols-[auto,1fr] gap-8">
        {/* Art column */}
        <div className="flex flex-col gap-4 w-56 md:w-64">
          <div className="border-2 border-border overflow-hidden shrink-0">
            {musicDetail.image_url ? (
              <img
                src={musicDetail.image_url}
                alt={musicDetail.name}
                className="w-full aspect-square object-cover"
              />
            ) : (
              <div className="aspect-square bg-muted flex items-center justify-center">
                <Disc3 className="w-16 h-16 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Action Buttons */}
          {!userDataLoading && !listenLog && (
            <div className="flex flex-col gap-2">
              <Button
                className="w-full border-2"
                onClick={() => router.push("/protected/log")}
              >
                <Play className="w-4 h-4 mr-2" /> Log Listen
              </Button>
              {isInQueue ? (
                <Button
                  variant="outline"
                  className="w-full border-2 text-muted-foreground"
                  onClick={onRemoveFromQueue}
                  disabled={watchlistLoading}
                >
                  <Check className="w-4 h-4 mr-2" /> In Queue
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="w-full border-2"
                  onClick={onAddToQueue}
                  disabled={watchlistLoading}
                >
                  <BookmarkPlus className="w-4 h-4 mr-2" /> Add to Queue
                </Button>
              )}
            </div>
          )}

          {/* Add to List */}
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
                      onClick={() => onToggleList(list.id, list.hasItem)}
                      disabled={togglingListId === list.id}
                      className="w-full text-left px-4 py-3 hover:bg-muted flex items-center gap-3 transition-colors text-sm"
                    >
                      <span className="text-lg">{list.emoji || "🎵"}</span>
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
        </div>

        {/* Info column */}
        <div className="flex flex-col gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-xs border-2">
                {isAlbum ? "Album" : "Track"}
              </Badge>
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-bold mb-1">{musicDetail.name}</h1>
            <p className="text-xl text-muted-foreground">{musicDetail.artist}</p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            {year && (
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                {year}
              </span>
            )}
            {isAlbum && musicDetail.album_name && musicDetail.album_name !== musicDetail.name && (
              <span className="flex items-center gap-1.5">
                <Disc3 className="w-4 h-4" />
                {musicDetail.album_name}
              </span>
            )}
            {!isAlbum && musicDetail.album_name && (
              <span className="flex items-center gap-1.5">
                <Disc3 className="w-4 h-4" />
                from {musicDetail.album_name}
              </span>
            )}
          </div>

          {/* Spotify link */}
          <div className="border-2 border-border p-4 bg-muted/10">
            <h2 className="font-semibold mb-2">Listen On</h2>
            <a
              href={`https://open.spotify.com/${type}/${id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-[#1DB954] hover:underline"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
              </svg>
              Open in Spotify
            </a>
          </div>
        </div>
      </div>

      {/* Your Review */}
      {!userDataLoading && listenLog && (
        <div className="border-2 border-primary/30 bg-primary/5 p-6 md:p-8 mt-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-primary">Your Review</h3>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="border-2"
                onClick={() => router.push(`/protected/log?edit=${listenLog.id}`)}
              >
                <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
              </Button>
              {confirmDelete ? (
                <>
                  <Button size="sm" variant="destructive" onClick={onDeleteLog}>Confirm</Button>
                  <Button size="sm" variant="outline" className="border-2" onClick={() => setConfirmDelete(false)}>Cancel</Button>
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
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <Star className="w-5 h-5 text-accent fill-accent" />
                  <span className="font-bold text-xl">{listenLog.rating}</span>
                  <span className="text-muted-foreground text-sm">/5</span>
                </div>
                {listenLog.listened_date && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Calendar className="w-3.5 h-3.5" />
                    Listened {new Date(listenLog.listened_date).toLocaleDateString()}
                  </div>
                )}
              </div>
              {listenLog.review && (
                <p className="text-muted-foreground leading-relaxed">{listenLog.review}</p>
              )}
            </div>

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
