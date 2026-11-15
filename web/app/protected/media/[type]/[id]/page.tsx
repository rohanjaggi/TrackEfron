"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookmarkMinus,
  BookmarkPlus,
  Check,
  Disc3,
  Film,
  ListPlus,
  Music2,
  Pencil,
  Plus,
  RotateCw,
  Tv,
} from "lucide-react";
import {
  buildFilmInfo,
  buildLogView,
  buildMusicInfo,
  buildWhereToWatch,
  formatDate,
  type MediaDetail,
  type MusicDetail,
  type WatchProviders,
} from "@/components/media/media-info";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/loading";
import { EmptyState, LeaderRow, Notice, SectionHeader } from "@/components/ui/page";
import { Stars } from "@/components/ui/stars";
import { useMediaUserData } from "@/hooks/use-media-user-data";
import { isMusicType } from "@/lib/media";
import { useSyncMode } from "@/lib/mode-context";
import { cn } from "@/lib/utils";

function SpotifyMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
  );
}

/** Goes back when there is history to go back to; otherwise it is a plain link to Discover. */
function BackLink() {
  const router = useRouter();
  return (
    <Button asChild variant="ghost" size="sm" className="-ml-3 mb-6">
      <Link
        href="/protected/discover"
        onClick={(e) => {
          if (window.history.length > 1) {
            e.preventDefault();
            router.back();
          }
        }}
      >
        <ArrowLeft aria-hidden="true" /> Back
      </Link>
    </Button>
  );
}

/** Placeholder in the shape of the page: artwork beside a title block. */
function DetailSkeleton({ square }: { square: boolean }) {
  return (
    <div role="status" aria-label="Loading details">
      <Skeleton className="mb-6 h-8 w-40" />
      <div className="grid gap-8 md:grid-cols-[auto,minmax(0,1fr)] md:gap-12">
        <Skeleton className={square ? "aspect-square w-56 md:w-72" : "aspect-[2/3] w-44 md:w-64"} />
        <div className="min-w-0">
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="mt-4 h-4 w-1/2" />
          <Skeleton className="mt-5 h-3 w-1/3" />
          <div className="mt-5 flex gap-2">
            <Skeleton className="h-5 w-14" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-16" />
          </div>
          <div className="mt-8 flex flex-wrap gap-2.5">
            <Skeleton className="h-9 w-36" />
            <Skeleton className="h-9 w-44" />
          </div>
          <div className="mt-8 flex max-w-md flex-col gap-3">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      </div>
      <Skeleton className="mt-16 h-6 w-32" />
      <Skeleton className="mt-6 h-3 w-full max-w-2xl" />
      <Skeleton className="mt-3 h-3 w-full max-w-2xl" />
      <Skeleton className="mt-3 h-3 w-2/3 max-w-xl" />
    </div>
  );
}

export default function MediaDetailPage() {
  return (
    <Suspense>
      <MediaDetailContent />
    </Suspense>
  );
}

function MediaDetailContent() {
  const params = useParams();
  const type = params.type as string;
  const id = params.id as string;

  const isMusic = isMusicType(type);
  const isFilm = type === "movie" || type === "tv";
  const invalidType = !isFilm && !isMusic;

  // The page follows the item: its domain decides the app mode.
  useSyncMode(isFilm ? "film" : isMusic ? "music" : null);

  const [detail, setDetail] = useState<MediaDetail | null>(null);
  const [musicDetail, setMusicDetail] = useState<MusicDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Watch providers (film only)
  const [providers, setProviders] = useState<WatchProviders | null>(null);

  // Fetch detail
  useEffect(() => {
    if (!isFilm && !isMusic) return;

    async function fetchDetail() {
      try {
        setLoading(true);
        setLoadFailed(false);
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
      } catch {
        setLoadFailed(true);
      } finally {
        setLoading(false);
      }
    }
    fetchDetail();
  }, [type, id, isFilm, isMusic, reloadKey]);

  const displayTitle = isMusic
    ? musicDetail?.name || "Unknown"
    : detail?.title || detail?.name || "Unknown";

  const {
    watchLog,
    listenLog,
    userDataLoading,
    userDataFailed,
    isSaved,
    savedPlace,
    saveBusy,
    userLists,
    togglingListId,
    handleSave,
    handleUnsave,
    handleDeleteLog,
    handleToggleList,
  } = useMediaUserData({ type, id, isMusic, displayTitle, detail, musicDetail });

  if (invalidType) {
    return (
      <EmptyState
        icon={Film}
        title="There's nothing at this address."
        description="This link doesn't point to a film, a show, an album or a track."
        action={
          <Button asChild>
            <Link href="/protected/discover">
              <ArrowLeft aria-hidden="true" /> Back to Discover
            </Link>
          </Button>
        }
      />
    );
  }

  if (loading) {
    return <DetailSkeleton square={isMusic} />;
  }

  if (loadFailed || (isMusic ? !musicDetail : !detail)) {
    return (
      <EmptyState
        icon={isMusic ? Disc3 : Film}
        title={loadFailed ? "We couldn't load this one." : "We couldn't find this one."}
        description={
          loadFailed
            ? "The details didn't come through. Check your connection and try again, or head back to Discover."
            : "It may have been removed. Head back to Discover to find something else."
        }
        action={
          <>
            <Button onClick={() => setReloadKey((k) => k + 1)}>
              <RotateCw aria-hidden="true" /> Try again
            </Button>
            <Button asChild variant="outline">
              <Link href="/protected/discover">
                <ArrowLeft aria-hidden="true" /> Back to Discover
              </Link>
            </Button>
          </>
        }
      />
    );
  }

  // ─── What this page shows, worked out once for either kind of work ───
  const isMovie = type === "movie";
  const isAlbum = type === "album";
  const FallbackIcon = isMusic ? (isAlbum ? Disc3 : Music2) : isMovie ? Film : Tv;
  const image = isMusic ? musicDetail!.image_url : detail!.poster_url;
  const lead = isMusic ? musicDetail!.artist : detail!.tagline;
  const overview = isMusic ? "" : detail!.overview;
  const genres = isMusic ? [] : detail!.genres ?? [];
  const topCast = isMusic ? [] : detail!.credits?.cast?.slice(0, 6) ?? [];
  const typeLabel = isMusic ? (isAlbum ? "Album" : "Track") : isMovie ? "Film" : "TV";

  const { meta, facts } = isMusic ? buildMusicInfo(musicDetail!, isAlbum) : buildFilmInfo(detail!, isMovie);
  const whereToWatch = !isMusic && providers ? buildWhereToWatch(providers) : [];

  const logRow = isMusic ? listenLog : watchLog;
  const log = logRow && buildLogView(logRow, isMusic);
  const categoryRatings = (log?.categories ?? []).filter((c) => c.value && c.value > 0);

  return (
    <div className="flex flex-col gap-16">
      <div>
        <BackLink />

        {/* Backdrop: a quiet strip of its own. No text ever sits on it. */}
        {!isMusic && detail!.backdrop_url && (
          <div className="mb-10 h-32 overflow-hidden border border-border sm:h-44 md:h-56">
            { }
            <img
              src={detail!.backdrop_url}
              alt=""
              className="artwork h-full w-full object-cover opacity-60"
            />
          </div>
        )}

        <div className="grid gap-8 md:grid-cols-[auto,minmax(0,1fr)] md:gap-12">
          {/* Artwork: the page's one feature object */}
          <div className={cn("light-leak", isMusic ? "w-56 md:w-72" : "w-44 md:w-64")}>
            <div className="frame frame-accent frame-raised ticks">
              {image ? (
                 
                <img
                  src={image}
                  alt=""
                  className={cn(
                    "artwork-live block w-full object-cover",
                    isMusic ? "aspect-square" : "aspect-[2/3]",
                  )}
                />
              ) : (
                <div
                  className={cn(
                    "flex items-center justify-center bg-surface-2",
                    isMusic ? "aspect-square" : "aspect-[2/3]",
                  )}
                >
                  <FallbackIcon className="size-12 text-dim" aria-hidden="true" />
                </div>
              )}
            </div>
          </div>

          {/* Title block */}
          <div className="min-w-0">
            <h1 className="t-display break-words">{displayTitle}</h1>
            {lead && (
              <p className={cn("t-prose mt-3 text-muted-foreground", !isMusic && "italic")}>
                {lead}
              </p>
            )}
            {meta.length > 0 && <p className="t-meta mt-4">{meta.join(" · ")}</p>}

            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant="outline">{typeLabel}</Badge>
              {!isMusic && detail!.status && <Badge variant="secondary">{detail!.status}</Badge>}
              {genres.map((g) => (
                <Badge key={g.id} variant="outline">
                  {g.name}
                </Badge>
              ))}
              {!userDataLoading && !log && isSaved && (
                <Badge>
                  <Check className="size-3" aria-hidden="true" />
                  {isMusic ? "In your queue" : "On your watchlist"}
                </Badge>
              )}
            </div>

            {userDataFailed && (
              <Notice tone="error" title="Couldn't load your activity for this title" className="mt-6 max-w-md">
                Whether you&apos;ve logged it or saved it isn&apos;t shown. Reload the page to try again.
              </Notice>
            )}

            {/* Actions: one solid, the rest outline */}
            <div className="mt-8 flex flex-wrap items-center gap-2.5">
              {userDataLoading ? (
                <>
                  <Skeleton className="h-9 w-36" />
                  <Skeleton className="h-9 w-44" />
                </>
              ) : (
                <>
                  {log ? (
                    <Button asChild>
                      <Link href={`/protected/log?edit=${log.id}&kind=${isMusic ? "music" : "film"}`}>
                        <Pencil aria-hidden="true" /> Edit your log
                      </Link>
                    </Button>
                  ) : (
                    <Button asChild>
                      <Link
                        href={`/protected/log?type=${type}&id=${encodeURIComponent(id)}&title=${encodeURIComponent(displayTitle)}`}
                      >
                        <Plus aria-hidden="true" /> {isMusic ? "Log a listen" : "Log a watch"}
                      </Link>
                    </Button>
                  )}

                  {!log && !userDataFailed &&
                    (isSaved ? (
                      <ConfirmButton
                        size="default"
                        icon={BookmarkMinus}
                        label={`Remove from ${savedPlace}`}
                        confirmLabel="Confirm remove"
                        onConfirm={handleUnsave}
                      />
                    ) : (
                      <Button variant="outline" onClick={handleSave} disabled={saveBusy}>
                        <BookmarkPlus aria-hidden="true" /> Add to {savedPlace}
                      </Button>
                    ))}

                  {!userDataFailed && userLists.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline">
                          <ListPlus aria-hidden="true" /> Add to list
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-64 max-w-[calc(100vw-2rem)]">
                        {userLists.map((list) => (
                          <DropdownMenuCheckboxItem
                            key={list.id}
                            checked={list.hasItem}
                            disabled={togglingListId === list.id}
                            onSelect={(e) => e.preventDefault()}
                            onCheckedChange={() => handleToggleList(list)}
                          >
                            {list.emoji && (
                              <span className="mr-2 shrink-0" aria-hidden="true">
                                {list.emoji}
                              </span>
                            )}
                            <span className="truncate">{list.name}</span>
                          </DropdownMenuCheckboxItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}

                  {isMusic && (
                    <Button asChild variant="outline">
                      <a
                        href={`https://open.spotify.com/${type}/${id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <SpotifyMark className="text-[#1DB954]" /> Open in Spotify
                      </a>
                    </Button>
                  )}
                </>
              )}
            </div>

            {facts.length > 0 && (
              <div className="mt-8 max-w-md">
                {facts.map((f) => (
                  <LeaderRow key={f.label} label={f.label} value={f.value} />
                ))}
              </div>
            )}

            {whereToWatch.length > 0 && (
              <div className="mt-8 max-w-md">
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h2 className="t-label">Where to watch</h2>
                  {providers?.link && (
                    <a
                      href={providers.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="t-meta underline underline-offset-4 transition-colors duration-cut ease-mech hover:text-primary"
                    >
                      See all options
                    </a>
                  )}
                </div>
                <ul className="flex flex-wrap gap-2">
                  {whereToWatch.map((p) => (
                    <li key={p.provider_id}>
                      { }
                      <img
                        src={`https://image.tmdb.org/t/p/w154${p.logo_path}`}
                        alt={`${p.provider_name} (${p.category})`}
                        title={`${p.provider_name} (${p.category})`}
                        className="h-9 w-9 border border-border object-cover"
                      />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {overview && (
        <section>
          <SectionHeader title="Overview" />
          <p className="t-prose">{overview}</p>
        </section>
      )}

      {!userDataLoading && log && (
        <section>
          <SectionHeader
            title="Your log"
            action={
              <ConfirmButton
                label="Delete log"
                confirmLabel="Confirm delete"
                onConfirm={handleDeleteLog}
              />
            }
          />
          <div className="grid gap-10 md:grid-cols-[minmax(0,1fr),280px] md:gap-12">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <Stars value={log.rating} size={20} showValue />
                {log.date && (
                  <span className="t-meta">
                    {isMusic ? "Listened" : "Watched"} {formatDate(log.date)}
                  </span>
                )}
              </div>
              {log.review && <p className="t-prose mt-5">{log.review}</p>}
            </div>

            {categoryRatings.length > 0 && (
              <div>
                <h3 className="t-label mb-2">Category ratings</h3>
                {categoryRatings.map((c) => (
                  <LeaderRow key={c.label} label={c.label} value={<Stars value={c.value} />} />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {topCast.length > 0 && (
        <section>
          <SectionHeader title="Top cast" />
          <div className="grid gap-x-12 md:grid-cols-2">
            {topCast.map((member) => (
              <LeaderRow
                key={member.id}
                label={member.character || "Cast"}
                value={member.name}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
