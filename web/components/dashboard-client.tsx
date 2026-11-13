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
import { useMode } from "@/lib/mode-context";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type MediaType = "movie" | "tv" | "album" | "track";

type LogEntry = {
  id: string;
  title: string;
  media_type: MediaType;
  rating: number;
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
  return type === "movie" ? Film : type === "tv" ? Tv : Disc3;
}

// ─── The latest entry: the page's one feature object ──────────────
function FeaturedEntry({ item }: { item: LogEntry }) {
  const music = isMusicType(item.media_type);
  const href = mediaHref(item);
  const image = resizePoster(item.poster_url, "w500");
  const Fallback = fallbackIconFor(item.media_type);

  return (
    <div className="light-leak">
      <article className="frame frame-accent frame-raised ticks flex lg:flex-col">
        <div
          className={cn(
            "w-[120px] shrink-0 self-start overflow-hidden border-r border-border bg-surface-2 lg:w-full lg:border-b lg:border-r-0",
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
          <Stars value={Number(item.rating)} size={15} className="mt-2" />
          <p className="t-meta mt-2">
            {TYPE_LABEL[item.media_type]}
            {item.watched_date && ` · ${formatDate(item.watched_date)}`}
          </p>
          {item.review && (
            <p className="t-prose mt-3 line-clamp-3 italic text-muted-foreground">
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
  const rowClass = "row-item -mx-2 flex items-center gap-4 px-2 py-4";

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

      <Stars value={Number(item.rating)} showValue className="shrink-0" />
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

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filmFailed, setFilmFailed] = useState(false);
  const [musicFailed, setMusicFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [recsLoading, setRecsLoading] = useState(true);
  const [recsFailed, setRecsFailed] = useState(false);
  const [watchlistedIds, setWatchlistedIds] = useState<Set<number>>(new Set());
  const [addingId, setAddingId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchLogs() {
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
            .select("id, title, media_type, rating, review, listened_date, image_url, spotify_id, created_at")
            .order("listened_date", { ascending: false, nullsFirst: false })
            .order("created_at", { ascending: false }),
        ]);
        if (cancelled) return;

        const filmMapped: LogEntry[] = (filmRes.data || []).map((f) => ({
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
        }));
        const musicMapped: LogEntry[] = (musicRes.data || []).map((m) => ({
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
        }));

        setLogs([...filmMapped, ...musicMapped]);
        setFilmFailed(Boolean(filmRes.error));
        setMusicFailed(Boolean(musicRes.error));
      } catch {
        if (cancelled) return;
        setFilmFailed(true);
        setMusicFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchLogs();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  useEffect(() => {
    let cancelled = false;

    async function fetchRecs() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const res = await fetch(`/api?action=recommend&user_id=${user.id}`);
        if (!res.ok) throw new Error("Recommendations request failed");
        const data: unknown = await res.json();
        if (!cancelled && Array.isArray(data)) setRecs((data as Recommendation[]).slice(0, 5));
      } catch {
        if (!cancelled) setRecsFailed(true);
      } finally {
        if (!cancelled) setRecsLoading(false);
      }
    }

    fetchRecs();
    return () => {
      cancelled = true;
    };
  }, []);

  function retryLogs() {
    setLoading(true);
    setReloadKey((k) => k + 1);
  }

  async function addToWatchlist(item: Recommendation) {
    const failed = () =>
      toast({
        tone: "error",
        mark: "Not added",
        title: `Couldn't add ${item.title} to your watchlist`,
        description: "Check your connection and try again.",
      });

    setAddingId(item.id);
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
      if (error && error.code !== "23505") {
        failed();
        return;
      }
      setWatchlistedIds((prev) => new Set([...prev, item.id]));
      toast(
        error
          ? { tone: "info", title: `${item.title} is already on your watchlist` }
          : { mark: "Added", title: `${item.title} added to your watchlist` },
      );
    } catch {
      failed();
    } finally {
      setAddingId(null);
    }
  }

  const music = mode === "music";
  const activeLogs = logs.filter((i) => isMusicType(i.media_type) === music);
  const loadFailed = music ? musicFailed : filmFailed;
  const firstRun = !loading && !loadFailed && activeLogs.length === 0;
  const latest = activeLogs[0] ?? null;
  const recentItems = activeLogs.slice(0, 6);

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const isThisMonth = (i: LogEntry) => {
    if (i.watched_date) return i.watched_date.slice(0, 7) === monthKey;
    const created = new Date(i.created_at);
    return created.getFullYear() === now.getFullYear() && created.getMonth() === now.getMonth();
  };

  const stats = {
    count: activeLogs.length,
    reviews: activeLogs.filter((i) => i.review && i.review.trim().length > 0).length,
    avgRating:
      activeLogs.length > 0
        ? (activeLogs.reduce((acc, i) => acc + Number(i.rating), 0) / activeLogs.length).toFixed(1)
        : "0.0",
    thisMonth: activeLogs.filter(isThisMonth).length,
  };

  const showFeature = loading || (!loadFailed && latest !== null);
  const showRecs = !firstRun || recs.length > 0;

  return (
    <div className="flex flex-col gap-16">
      {/* ── Greeting, figures and the latest entry ─────────────── */}
      <section
        className={cn(
          "grid grid-cols-1 items-start gap-10",
          showFeature && "lg:grid-cols-[minmax(0,1fr)_260px]",
        )}
      >
        <div className="min-w-0">
          <PageHeader
            className="mb-8"
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
              <div className="flex flex-wrap gap-x-10 gap-y-6">
                <StatBlock label={music ? "Listened" : "Watched"} value={stats.count} loading={loading} />
                <StatBlock label="Reviews" value={stats.reviews} loading={loading} />
                <StatBlock label="Avg rating" value={stats.avgRating} loading={loading} />
                <StatBlock label="This month" value={stats.thisMonth} loading={loading} />
              </div>

              <div className="mt-8 flex flex-wrap gap-2.5">
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
          <Skeleton className="h-[180px] w-full lg:h-[480px]" />
        ) : (
          !loadFailed && latest && <FeaturedEntry item={latest} />
        )}
      </section>

      {/* ── Recent activity ────────────────────────────────────── */}
      {!firstRun && !loadFailed && (
        <section>
          <SectionHeader
            className="mb-0"
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

      {/* ── Recommendations (film and TV) ──────────────────────── */}
      {showRecs && (
        <section>
          <SectionHeader
            title="Recommended for you"
            meta={music ? "Film and TV" : undefined}
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
            <MediaGridSkeleton count={5} />
          ) : recsFailed ? (
            <Notice tone="error" title="Couldn't load recommendations">
              Reload the page to try again. Everything else on this page is up to date.
            </Notice>
          ) : recs.length === 0 ? (
            <EmptyState
              className="py-10"
              title={`Log more ${music ? "listens" : "watches"} to unlock personalised picks.`}
            />
          ) : (
            <MediaGrid>
              {recs.map((item) => {
                const saved = watchlistedIds.has(item.id);
                const type = item.media_type === "movie" ? "Film" : "TV";
                return (
                  <MediaCard
                    key={`${item.media_type}-${item.id}`}
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
                          disabled={addingId === item.id}
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
