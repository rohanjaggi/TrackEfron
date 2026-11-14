"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bookmark, Disc3, Film, Library, Music2, Plus, Tv } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MediaGridSkeleton, RowListSkeleton, Skeleton } from "@/components/ui/loading";
import { MediaCard, MediaGrid } from "@/components/ui/media-card";
import { EmptyState, Notice, PageHeader, SectionHeader, StatBlock } from "@/components/ui/page";
import { Stars } from "@/components/ui/stars";
import { useToast } from "@/components/ui/toast";
import { useMode, type AppMode } from "@/lib/mode-context";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type MediaType = "movie" | "tv" | "album" | "track";

type LogEntry = {
  id: string;
  title: string;
  media_type: MediaType;
  rating: number | null;
  review: string | null;
  /** Watched date for film and TV, listened date for music. */
  watched_date: string | null;
  poster_url: string | null;
  tmdb_id: number | null;
  spotify_id: string | null;
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

type MusicRecommendation = {
  title: string;
  artist: string;
  type: "album" | "track";
  explanation?: string;
  spotify_id?: string;
  image_url?: string | null;
};

type RecsState = {
  mode: AppMode;
  status: "ok" | "failed" | "nokey";
  film: Recommendation[];
  music: MusicRecommendation[];
};

type LogsState = {
  mode: AppMode;
  key: number;
  rows: LogEntry[];
  failed: boolean;
};

/** Postgres unique-violation: the row is already there. */
const DUPLICATE_ROW = "23505";

interface DashboardClientProps {
  userName: string;
}

const TYPE_LABEL: Record<MediaType, string> = {
  movie: "Film",
  tv: "TV",
  album: "Album",
  track: "Track",
};

const isMusicType = (type: MediaType) => type === "album" || type === "track";

function resizePoster(url: string | null, size: string): string | null {
  if (!url) return null;
  return url.replace(/\/w\d+\//, `/${size}/`);
}

/** "2026-11-01" is a calendar day, not a moment: format it without shifting time zone. */
function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(value.length === 10 ? { timeZone: "UTC" } : {}),
  });
}

function mediaHref(item: LogEntry): string | null {
  const id = isMusicType(item.media_type) ? item.spotify_id : item.tmdb_id;
  return id ? `/protected/media/${item.media_type}/${id}` : null;
}

function fallbackIconFor(type: MediaType) {
  return type === "movie" ? Film : type === "tv" ? Tv : type === "album" ? Disc3 : Music2;
}

/** Unrated (null or 0) has no rating: no stars, and it is left out of the average. */
function ratingOf(item: LogEntry): number | null {
  const value = Number(item.rating);
  return item.rating != null && value > 0 ? value : null;
}

// ─── The latest entry: the page's one feature object ──────────────
function FeaturedEntry({ item }: { item: LogEntry }) {
  const music = isMusicType(item.media_type);
  const href = mediaHref(item);
  const image = resizePoster(item.poster_url, "w500");
  const Fallback = fallbackIconFor(item.media_type);
  const rating = ratingOf(item);

  return (
    <div className="light-leak h-full">
      <article className="frame frame-accent frame-raised ticks flex h-full">
        <div
          className={cn(
            "w-[120px] shrink-0 self-start overflow-hidden border-r border-border bg-surface-2 lg:w-[180px]",
            music ? "aspect-square" : "aspect-[2/3]",
          )}
        >
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" className="artwork h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Fallback className="size-8 text-dim" aria-hidden="true" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 p-4">
          <Badge>{music ? "Last listened" : "Last watched"}</Badge>
          <h2 className="t-card mt-3 line-clamp-2">
            {href ? (
              <Link
                href={href}
                className="transition-colors duration-cut ease-mech hover:text-primary"
              >
                {item.title}
              </Link>
            ) : (
              item.title
            )}
          </h2>
          {rating != null && <Stars value={rating} size={15} className="mt-2" />}
          <p className="t-meta mt-2">
            {TYPE_LABEL[item.media_type]}
            {item.watched_date && ` · ${formatDate(item.watched_date)}`}
          </p>
          {item.review && (
            <p className="t-prose mt-3 line-clamp-4 italic text-muted-foreground">
              &ldquo;{item.review}&rdquo;
            </p>
          )}
        </div>
      </article>
    </div>
  );
}

// ─── One row of recent activity ───────────────────────────────────
function RecentRow({ item }: { item: LogEntry }) {
  const music = isMusicType(item.media_type);
  const href = mediaHref(item);
  const image = resizePoster(item.poster_url, "w185");
  const Fallback = fallbackIconFor(item.media_type);
  const rating = ratingOf(item);
  const rowClass = "row-item flex items-center gap-4 py-4";

  const body = (
    <>
      <div
        className={cn(
          "flex shrink-0 items-center justify-center overflow-hidden border border-border bg-surface-2",
          music ? "h-12 w-12" : "h-[66px] w-11",
        )}
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <Fallback className="size-5 text-dim" aria-hidden="true" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="t-card truncate">{item.title}</h3>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <Badge variant="outline">{TYPE_LABEL[item.media_type]}</Badge>
          {item.watched_date && <span className="t-meta">{formatDate(item.watched_date)}</span>}
        </div>
      </div>

      {rating != null && <Stars value={rating} showValue className="shrink-0" />}
    </>
  );

  return href ? (
    <Link href={href} className={rowClass}>
      {body}
    </Link>
  ) : (
    <div className={rowClass}>{body}</div>
  );
}

export function DashboardClient({ userName }: DashboardClientProps) {
  const { mode } = useMode();
  const toast = useToast();

  const [logsState, setLogsState] = useState<LogsState | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [recsState, setRecsState] = useState<RecsState | null>(null);
  const [watchlistKeys, setWatchlistKeys] = useState<Set<string>>(new Set());
  const [queuedIds, setQueuedIds] = useState<Set<string>>(new Set());
  const [addingKey, setAddingKey] = useState<string | null>(null);

  // Only the current mode's logs; a response for another mode never lands.
  useEffect(() => {
    let cancelled = false;
    const requestMode = mode;

    async function fetchLogs() {
      const done = (rows: LogEntry[], failed: boolean) => {
        if (!cancelled) setLogsState({ mode: requestMode, key: reloadKey, rows, failed });
      };
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          done([], false);
          return;
        }

        if (requestMode === "music") {
          const res = await supabase
            .from("listen_logs")
            .select("id, title, media_type, rating, review, listened_date, image_url, spotify_id, created_at")
            .eq("user_id", user.id)
            .in("media_type", ["album", "track"])
            .order("listened_date", { ascending: false, nullsFirst: false })
            .order("created_at", { ascending: false });
          done(
            (res.data || []).map((m) => ({
              id: m.id,
              title: m.title,
              media_type: m.media_type as "album" | "track",
              rating: m.rating,
              review: m.review,
              watched_date: m.listened_date,
              poster_url: m.image_url,
              tmdb_id: null,
              spotify_id: m.spotify_id,
              created_at: m.created_at,
            })),
            Boolean(res.error),
          );
        } else {
          const res = await supabase
            .from("watch_logs")
            .select("id, title, media_type, rating, review, watched_date, poster_url, tmdb_id, created_at")
            .eq("user_id", user.id)
            .in("media_type", ["movie", "tv"])
            .order("watched_date", { ascending: false, nullsFirst: false })
            .order("created_at", { ascending: false });
          done(
            (res.data || []).map((f) => ({
              id: f.id,
              title: f.title,
              media_type: f.media_type as "movie" | "tv",
              rating: f.rating,
              review: f.review,
              watched_date: f.watched_date,
              poster_url: f.poster_url,
              tmdb_id: f.tmdb_id,
              spotify_id: null,
              created_at: f.created_at,
            })),
            Boolean(res.error),
          );
        }
      } catch {
        done([], true);
      }
    }

    fetchLogs();
    return () => {
      cancelled = true;
    };
  }, [mode, reloadKey]);

  // Recommendations follow the mode: film and TV from the recommendation service, music from the AI route.
  useEffect(() => {
    let cancelled = false;
    const requestMode = mode;

    async function fetchRecs() {
      const done = (
        status: RecsState["status"],
        film: Recommendation[] = [],
        music: MusicRecommendation[] = [],
      ) => {
        if (!cancelled) setRecsState({ mode: requestMode, status, film, music });
      };
      try {
        if (requestMode === "music") {
          const res = await fetch("/api/ai/recommend?mode=music");
          const data: unknown = await res.json();
          if (Array.isArray(data)) {
            const picks = (data as MusicRecommendation[]).filter((r) => r.spotify_id).slice(0, 5);
            done("ok", [], picks);
          } else if ((data as { code?: string } | null)?.code === "NO_API_KEY") {
            done("nokey");
          } else {
            done("failed");
          }
          return;
        }

        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          done("ok");
          return;
        }
        const res = await fetch(`/api?action=recommend&user_id=${user.id}`);
        if (!res.ok) throw new Error("Recommendations request failed");
        const data: unknown = await res.json();
        done("ok", Array.isArray(data) ? (data as Recommendation[]).slice(0, 5) : []);
      } catch {
        done("failed");
      }
    }

    fetchRecs();
    return () => {
      cancelled = true;
    };
  }, [mode]);

  // What is already saved, so a pick shows its state from the start.
  useEffect(() => {
    let cancelled = false;
    const requestMode = mode;

    async function fetchSaved() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) return;
        if (requestMode === "music") {
          const { data } = await supabase.from("music_queue").select("spotify_id").eq("user_id", user.id);
          if (!cancelled && data) {
            const ids = data
              .map((r: { spotify_id: string | null }) => r.spotify_id)
              .filter((id): id is string => Boolean(id));
            setQueuedIds(new Set(ids));
          }
        } else {
          const { data } = await supabase
            .from("watchlist")
            .select("tmdb_id, media_type")
            .eq("user_id", user.id);
          if (!cancelled && data) {
            setWatchlistKeys(
              new Set(data.map((r: { tmdb_id: number; media_type: string }) => `${r.media_type}:${r.tmdb_id}`)),
            );
          }
        }
      } catch {
        // Buttons fall back to "add"; a duplicate is handled on save.
      }
    }

    fetchSaved();
    return () => {
      cancelled = true;
    };
  }, [mode]);

  function retryLogs() {
    setReloadKey((k) => k + 1);
  }

  async function addToWatchlist(item: Recommendation) {
    const key = `${item.media_type}:${item.id}`;
    const failed = () =>
      toast({
        tone: "error",
        mark: "Not added",
        title: `Couldn't add ${item.title} to your watchlist`,
        description: "Check your connection and try again.",
      });

    setAddingKey(key);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          tone: "error",
          title: "Your session has ended",
          description: "Sign in again to add to your watchlist.",
        });
        return;
      }
      const { error } = await supabase.from("watchlist").insert({
        user_id: user.id,
        tmdb_id: item.id,
        title: item.title,
        media_type: item.media_type,
        poster_url: item.poster_url,
      });
      // 23505: unique violation, i.e. it was already on the watchlist.
      if (error && error.code !== DUPLICATE_ROW) {
        failed();
        return;
      }
      setWatchlistKeys((prev) => new Set([...prev, key]));
      toast(
        error
          ? { tone: "info", title: `${item.title} is already on your watchlist` }
          : { mark: "Added", title: `${item.title} added to your watchlist` },
      );
    } catch {
      failed();
    } finally {
      setAddingKey(null);
    }
  }

  async function addToQueue(item: MusicRecommendation) {
    const spotifyId = item.spotify_id;
    if (!spotifyId) return;
    const failed = () =>
      toast({
        tone: "error",
        mark: "Not added",
        title: `Couldn't add ${item.title} to your queue`,
        description: "Check your connection and try again.",
      });

    setAddingKey(spotifyId);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          tone: "error",
          title: "Your session has ended",
          description: "Sign in again to add to your queue.",
        });
        return;
      }
      const { error } = await supabase.from("music_queue").insert({
        user_id: user.id,
        spotify_id: spotifyId,
        media_type: item.type,
        title: item.title,
        artist: item.artist,
        image_url: item.image_url ?? null,
      });
      if (error && error.code !== DUPLICATE_ROW) {
        failed();
        return;
      }
      setQueuedIds((prev) => new Set([...prev, spotifyId]));
      toast(
        error
          ? { tone: "info", title: `${item.title} is already in your queue` }
          : { mark: "Added", title: `${item.title} added to your queue` },
      );
    } catch {
      failed();
    } finally {
      setAddingKey(null);
    }
  }

  const music = mode === "music";
  const loading = !logsState || logsState.mode !== mode || logsState.key !== reloadKey;
  const activeLogs = !loading && logsState ? logsState.rows : [];
  const loadFailed = !loading && Boolean(logsState?.failed);
  const firstRun = !loading && !loadFailed && activeLogs.length === 0;
  const latest = activeLogs[0] ?? null;
  const recentItems = activeLogs.slice(0, 6);

  const recsLoading = !recsState || recsState.mode !== mode;
  const filmRecs = !recsLoading && recsState ? recsState.film : [];
  const musicRecs = !recsLoading && recsState ? recsState.music : [];
  const recsStatus = recsLoading ? undefined : recsState?.status;
  const recCount = music ? musicRecs.length : filmRecs.length;

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const isThisMonth = (i: LogEntry) => {
    if (i.watched_date) return i.watched_date.slice(0, 7) === monthKey;
    const created = new Date(i.created_at);
    return created.getFullYear() === now.getFullYear() && created.getMonth() === now.getMonth();
  };

  const ratings = activeLogs.map(ratingOf).filter((r): r is number => r != null);
  const stats = {
    count: activeLogs.length,
    reviews: activeLogs.filter((i) => i.review && i.review.trim().length > 0).length,
    avgRating:
      ratings.length > 0 ? (ratings.reduce((acc, r) => acc + r, 0) / ratings.length).toFixed(1) : "–",
    thisMonth: activeLogs.filter(isThisMonth).length,
  };

  const showFeature = loading || (!loadFailed && latest !== null);
  const showRecs = !firstRun || recCount > 0;

  return (
    <div className="flex flex-col gap-16">
      {/* ── Greeting, figures and the latest entry ─────────────── */}
      <section
        className={cn(
          "grid grid-cols-1 items-stretch gap-10",
          showFeature && "lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)]",
        )}
      >
        <div className="flex min-w-0 flex-col justify-between gap-8">
          <PageHeader
            className="mb-0"
            title={
              <>
                Welcome, <strong>{userName}</strong>
                <br />
                <em>{music ? "what are you listening to?" : "what are you watching?"}</em>
              </>
            }
          />

          {loadFailed ? (
            <Notice tone="error" title={music ? "Couldn't load your listens" : "Couldn't load your watches"}>
              <p>Check your connection and try again.</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={retryLogs}>
                Try again
              </Button>
            </Notice>
          ) : firstRun ? (
            <EmptyState
              className="border-y border-border py-14"
              icon={music ? Music2 : Film}
              title="Your story starts here."
              description={
                music
                  ? "Log an album or a track and it will appear here, with your rating and what you made of it."
                  : "Log a film or a show and it will appear here, with your rating and what you made of it."
              }
              action={
                <Button asChild>
                  <Link href="/protected/log">
                    <Plus aria-hidden="true" />
                    {music ? "Log your first listen" : "Log your first watch"}
                  </Link>
                </Button>
              }
            />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-x-8 gap-y-6 sm:flex sm:gap-12">
                <StatBlock label={music ? "Listened" : "Watched"} value={stats.count} loading={loading} />
                <StatBlock label="Reviews" value={stats.reviews} loading={loading} />
                <StatBlock label="Avg rating" value={stats.avgRating} loading={loading} />
                <StatBlock label="This month" value={stats.thisMonth} loading={loading} />
              </div>

              <div className="flex flex-wrap gap-2.5">
                <Button asChild>
                  <Link href="/protected/log">
                    <Plus aria-hidden="true" />
                    {music ? "Log a listen" : "Log a watch"}
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/protected/library">
                    <Library aria-hidden="true" />
                    View library
                  </Link>
                </Button>
              </div>
            </>
          )}
        </div>

        {loading ? (
          <Skeleton className="h-[180px] w-full lg:h-full lg:min-h-[300px]" />
        ) : (
          !loadFailed && latest && <FeaturedEntry item={latest} />
        )}
      </section>

      {/* ── Recent activity ────────────────────────────────────── */}
      {!firstRun && !loadFailed && (
        <section>
          <SectionHeader
            flush
            title={music ? "Recent listens" : "Recent watches"}
            action={
              <Button asChild variant="link">
                <Link href="/protected/library">
                  View all
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            }
          />
          {loading ? (
            <RowListSkeleton count={4} />
          ) : (
            <div className="advance">
              {recentItems.map((item) => (
                <RecentRow key={item.id} item={item} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Recommendations: films and TV in film mode, music in music mode ── */}
      {showRecs && (
        <section>
          <SectionHeader
            title="Recommended for you"
            action={
              <Button asChild variant="link">
                <Link href="/protected/discover">
                  More
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            }
          />

          {recsLoading ? (
            <MediaGridSkeleton count={5} aspect={music ? "square" : "poster"} />
          ) : recsStatus === "failed" ? (
            <Notice tone="error" title="Couldn't load recommendations">
              Reload the page to try again. Everything else on this page is up to date.
            </Notice>
          ) : recsStatus === "nokey" ? (
            <EmptyState
              className="py-10"
              title="Music picks need an AI key."
              description="They are written using your own AI key, and none is saved yet."
              action={
                <Button asChild variant="outline" size="sm">
                  <Link href="/protected/profile">Add a key in your profile</Link>
                </Button>
              }
            />
          ) : recCount === 0 ? (
            <EmptyState
              className="py-10"
              title={`Log more ${music ? "listens" : "watches"} to unlock personalised picks.`}
            />
          ) : music ? (
            <MediaGrid>
              {musicRecs.map((item) => {
                const id = item.spotify_id ?? "";
                const queued = queuedIds.has(id);
                return (
                  <MediaCard
                    key={`${item.type}-${id}`}
                    title={item.title}
                    subtitle={`${item.type === "album" ? "Album" : "Track"} · ${item.artist}`}
                    image={item.image_url}
                    aspect="square"
                    href={`/protected/media/${item.type}/${id}`}
                    fallbackIcon={item.type === "album" ? Disc3 : Music2}
                    badge={queued ? <Badge variant="solid">In queue</Badge> : undefined}
                    actions={
                      queued ? undefined : (
                        <Button
                          variant="secondary"
                          size="icon"
                          aria-label={`Add ${item.title} to queue`}
                          disabled={addingKey === id}
                          onClick={() => addToQueue(item)}
                        >
                          <Plus aria-hidden="true" />
                        </Button>
                      )
                    }
                  />
                );
              })}
            </MediaGrid>
          ) : (
            <MediaGrid>
              {filmRecs.map((item) => {
                const key = `${item.media_type}:${item.id}`;
                const saved = watchlistKeys.has(key);
                const type = item.media_type === "movie" ? "Film" : "TV";
                return (
                  <MediaCard
                    key={key}
                    title={item.title}
                    subtitle={
                      item.vote_average != null && item.vote_average > 0
                        ? `${type} · ${item.vote_average.toFixed(1)} TMDB`
                        : type
                    }
                    image={item.poster_url}
                    href={`/protected/media/${item.media_type}/${item.id}`}
                    fallbackIcon={item.media_type === "movie" ? Film : Tv}
                    badge={saved ? <Badge variant="solid">On watchlist</Badge> : undefined}
                    actions={
                      saved ? undefined : (
                        <Button
                          variant="secondary"
                          size="icon"
                          aria-label={`Add ${item.title} to watchlist`}
                          disabled={addingKey === key}
                          onClick={() => addToWatchlist(item)}
                        >
                          <Bookmark aria-hidden="true" />
                        </Button>
                      )
                    }
                  />
                );
              })}
            </MediaGrid>
          )}
        </section>
      )}
    </div>
  );
}
