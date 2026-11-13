"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Disc3,
  Film,
  LayoutGrid,
  List,
  Music2,
  Pencil,
  Plus,
  Search,
  Tv,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Input, Select } from "@/components/ui/input";
import { MediaGridSkeleton, RowListSkeleton } from "@/components/ui/loading";
import { MediaCard, MediaGrid } from "@/components/ui/media-card";
import { EmptyState, Notice, PageHeader, StatBlock } from "@/components/ui/page";
import { SegmentedControl, type SegmentOption } from "@/components/ui/segmented-control";
import { Stars } from "@/components/ui/stars";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { useMode } from "@/lib/mode-context";

type ViewType = "grid" | "list";
// "film" = movies+tv, "music" = albums+tracks
type FilterType = "all" | "film" | "movies" | "tv" | "music" | "albums" | "tracks";
type SortType = "date_watched_desc" | "date_watched_asc" | "rating_desc" | "rating_asc" | "title_asc" | "title_desc" | "date_added_desc" | "date_added_asc";

// `dated` options are prefixed with "Date watched" or "Date listened" by mode.
const SORT_OPTIONS: { value: SortType; label: string; dated?: boolean }[] = [
  { value: "date_watched_desc", label: "newest first", dated: true },
  { value: "date_watched_asc", label: "oldest first", dated: true },
  { value: "rating_desc", label: "Rating, highest first" },
  { value: "rating_asc", label: "Rating, lowest first" },
  { value: "title_asc", label: "Title, A to Z" },
  { value: "title_desc", label: "Title, Z to A" },
  { value: "date_added_desc", label: "Date added, newest first" },
  { value: "date_added_asc", label: "Date added, oldest first" },
];

const VIEW_OPTIONS: SegmentOption<ViewType>[] = [
  { value: "grid", label: "Grid view", icon: LayoutGrid, iconOnly: true },
  { value: "list", label: "List view", icon: List, iconOnly: true },
];

const MIXED_VIEW_HINT =
  "All mixes posters and square covers, so it is shown as a list. Pick a type to use the grid.";

type WatchLog = {
  id: string;
  title: string;
  media_type: "movie" | "tv" | "album" | "track";
  rating: number;
  review: string | null;
  watched_date: string | null;
  poster_url: string | null;
  tmdb_id: number | null;
  spotify_id?: string | null;
  created_at: string;
  artist?: string | null;
};

const TYPE_LABEL: Record<WatchLog["media_type"], string> = {
  movie: "Film",
  tv: "TV show",
  album: "Album",
  track: "Track",
};

const TYPE_ICON: Record<WatchLog["media_type"], LucideIcon> = {
  movie: Film,
  tv: Tv,
  album: Disc3,
  track: Disc3,
};

function upscalePoster(url: string | null, size = "w342"): string | null {
  if (!url) return null;
  return url.replace(/\/w\d+\//, `/${size}/`);
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function isMusicItem(item: WatchLog): boolean {
  return item.media_type === "album" || item.media_type === "track";
}

/** The media page for an entry, when it has an id to link to. */
function mediaHref(item: WatchLog): string | undefined {
  if (isMusicItem(item) && item.spotify_id) return `/protected/media/${item.media_type}/${item.spotify_id}`;
  if (item.tmdb_id) return `/protected/media/${item.media_type}/${item.tmdb_id}`;
  return undefined;
}

function metaLine(item: WatchLog): string {
  const label = TYPE_LABEL[item.media_type];
  return item.watched_date ? `${label} · ${formatDate(item.watched_date)}` : label;
}

function averageRating(items: WatchLog[]): string {
  if (items.length === 0) return "—";
  return (items.reduce((acc, i) => acc + Number(i.rating), 0) / items.length).toFixed(1);
}

export default function LibraryPage() {
  const { mode } = useMode();
  const toast = useToast();
  const isMusicMode = mode === "music";

  // Default filter and view depend on mode:
  // film mode → show film content by default (grid)
  // music mode → show music content by default (grid)
  // user picks "all" → list view (mixed aspect ratios don't work in grid)
  const defaultFilter: FilterType = isMusicMode ? "music" : "film";
  const [viewType, setViewType] = useState<ViewType>("grid");
  const [filter, setFilter] = useState<FilterType>(defaultFilter);
  const [sortBy, setSortBy] = useState<SortType | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [watchedItems, setWatchedItems] = useState<WatchLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  // When mode changes externally, reset to the new default filter
  useEffect(() => {
    setFilter(mode === "music" ? "music" : "film");
    setViewType("grid");
  }, [mode]);

  async function fetchLibrary() {
    try {
      const supabase = createClient();
      const [filmRes, musicRes] = await Promise.all([
        supabase
          .from("watch_logs")
          .select("id, title, media_type, rating, review, watched_date, poster_url, tmdb_id, created_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("listen_logs")
          .select("id, title, media_type, rating, review, listened_date, image_url, created_at, artist, spotify_id")
          .order("created_at", { ascending: false }),
      ]);

      const filmItems: WatchLog[] = (filmRes.data || []);
      const musicItems: WatchLog[] = (musicRes.data || []).map((m) => ({
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
        artist: m.artist,
      }));

      const combined = [...filmItems, ...musicItems].sort((a, b) =>
        b.created_at.localeCompare(a.created_at)
      );
      setWatchedItems(combined);
      setLoadFailed(Boolean(filmRes.error || musicRes.error));
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLibrary();
  }, []);

  function retryLoad() {
    setLoading(true);
    setLoadFailed(false);
    fetchLibrary();
  }

  async function handleDelete(item: WatchLog) {
    let failed = false;
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from(isMusicItem(item) ? "listen_logs" : "watch_logs")
        .delete()
        .eq("id", item.id);
      failed = Boolean(error);
    } catch {
      failed = true;
    }

    if (failed) {
      toast({
        mark: "Failed",
        tone: "error",
        title: `Couldn't remove ${item.title}`,
        description: "It is still in your library. Check your connection and try again.",
      });
      return;
    }

    setWatchedItems((prev) => prev.filter((i) => i.id !== item.id));
    toast({ mark: "Removed", title: `${item.title} removed from your library`, tone: "info" });
  }

  function handleFilterChange(next: FilterType) {
    setFilter(next);
    if (next !== "all") setViewType("grid");
  }

  function clearFilters() {
    setSearchQuery("");
    setFilter(defaultFilter);
  }

  const filteredItems = watchedItems
    .filter((item) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "film" && (item.media_type === "movie" || item.media_type === "tv")) ||
        (filter === "movies" && item.media_type === "movie") ||
        (filter === "tv" && item.media_type === "tv") ||
        (filter === "music" && (item.media_type === "album" || item.media_type === "track")) ||
        (filter === "albums" && item.media_type === "album") ||
        (filter === "tracks" && item.media_type === "track");

      const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesFilter && matchesSearch;
    })
    .sort((a, b) => {
      if (!sortBy) return 0;
      switch (sortBy) {
        case "date_watched_desc":
          return (b.watched_date || b.created_at).localeCompare(a.watched_date || a.created_at);
        case "date_watched_asc":
          return (a.watched_date || a.created_at).localeCompare(b.watched_date || b.created_at);
        case "rating_desc":
          return Number(b.rating) - Number(a.rating);
        case "rating_asc":
          return Number(a.rating) - Number(b.rating);
        case "title_asc":
          return a.title.localeCompare(b.title);
        case "title_desc":
          return b.title.localeCompare(a.title);
        case "date_added_desc":
          return b.created_at.localeCompare(a.created_at);
        case "date_added_asc":
          return a.created_at.localeCompare(b.created_at);
        default:
          return 0;
      }
    });

  const filmItems = watchedItems.filter((i) => !isMusicItem(i));
  const musicItems = watchedItems.filter(isMusicItem);

  const counts = {
    total: watchedItems.length,
    movies: watchedItems.filter((i) => i.media_type === "movie").length,
    tvShows: watchedItems.filter((i) => i.media_type === "tv").length,
    albums: watchedItems.filter((i) => i.media_type === "album").length,
    tracks: watchedItems.filter((i) => i.media_type === "track").length,
  };

  const stats = isMusicMode
    ? [
        { label: "Total logged", value: musicItems.length },
        { label: counts.albums === 1 ? "Album" : "Albums", value: counts.albums },
        { label: counts.tracks === 1 ? "Track" : "Tracks", value: counts.tracks },
        { label: "Avg rating", value: averageRating(musicItems) },
      ]
    : [
        { label: "Total watched", value: filmItems.length },
        { label: counts.movies === 1 ? "Film" : "Films", value: counts.movies },
        { label: counts.tvShows === 1 ? "TV show" : "TV shows", value: counts.tvShows },
        { label: "Avg rating", value: averageRating(filmItems) },
      ];

  const filterOptions: SegmentOption<FilterType>[] = isMusicMode
    ? [
        { value: "music", label: "Music", icon: Music2, count: musicItems.length },
        { value: "albums", label: "Albums", icon: Disc3, count: counts.albums },
        { value: "tracks", label: "Tracks", icon: Music2, count: counts.tracks },
        { value: "all", label: "All", count: counts.total },
      ]
    : [
        { value: "film", label: "Film & TV", icon: Film, count: filmItems.length },
        { value: "movies", label: "Films", icon: Film, count: counts.movies },
        { value: "tv", label: "TV", icon: Tv, count: counts.tvShows },
        { value: "all", label: "All", count: counts.total },
      ];

  // Whether the current filter shows music content (square art) or film content (portrait art)
  const isMusicFilter = filter === "music" || filter === "albums" || filter === "tracks";
  // "All" mixes 2:3 posters with 1:1 covers, so it is always a list.
  const gridUnavailable = filter === "all";
  const effectiveViewType: ViewType = gridUnavailable ? "list" : viewType;

  const hasQuery = searchQuery.trim() !== "";
  // Nothing to show and nothing narrowing the view: the library itself is empty.
  const nothingLogged = !hasQuery && (filter === defaultFilter || watchedItems.length === 0);
  const logLabel = isMusicMode ? "Log a listen" : "Log a watch";
  const dateSortPrefix = isMusicMode ? "Date listened" : "Date watched";

  function renderActions(item: WatchLog) {
    return (
      <>
        <Button asChild size="icon" variant="secondary">
          <Link href={`/protected/log?edit=${item.id}`} aria-label={`Edit ${item.title}`} title="Edit">
            <Pencil aria-hidden="true" />
          </Link>
        </Button>
        <ConfirmButton
          iconOnly
          label={`Delete ${item.title}`}
          confirmLabel="Confirm"
          className="bg-surface-2"
          onConfirm={() => handleDelete(item)}
        />
      </>
    );
  }

  return (
    <div>
      <PageHeader
        title={
          <>
            Your <em>library</em>
          </>
        }
        description={
          isMusicMode
            ? "Your albums and tracks, all in one place"
            : "Your watched films and TV shows, all in one place"
        }
        actions={
          <Button asChild>
            <Link href="/protected/log">
              <Plus aria-hidden="true" /> {logLabel}
            </Link>
          </Button>
        }
      />

      {/* Figures: adapt to the current mode */}
      <div className="flex flex-wrap gap-x-12 gap-y-6">
        {stats.map((stat) => (
          <StatBlock key={stat.label} label={stat.label} value={stat.value} loading={loading} />
        ))}
      </div>

      {/* Toolbar: what to show on the left; find, order and lay out on the right */}
      <div className="mt-12 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <SegmentedControl
          label="Filter by type"
          value={filter}
          onChange={handleFilterChange}
          options={filterOptions}
        />

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3 sm:flex-none">
          <div className="relative min-w-[160px] flex-1 sm:w-56 sm:flex-none">
            <label htmlFor="library-search" className="sr-only">
              Search your library by title
            </label>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="library-search"
              type="search"
              placeholder="Search your library"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="min-w-[160px] flex-1 sm:w-56 sm:flex-none">
            <label htmlFor="library-sort" className="sr-only">
              Sort by
            </label>
            <Select
              id="library-sort"
              value={sortBy ?? ""}
              onChange={(e) => setSortBy(e.target.value === "" ? null : (e.target.value as SortType))}
            >
              <option value="">Sort: recently added</option>
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.dated ? `${dateSortPrefix}, ${option.label}` : option.label}
                </option>
              ))}
            </Select>
          </div>

          {gridUnavailable ? (
            <fieldset
              disabled
              title={MIXED_VIEW_HINT}
              aria-describedby="library-view-hint"
              className="min-w-0 [&_.seg[data-active=false]]:text-dim [&_button]:cursor-not-allowed"
            >
              <SegmentedControl label="View" value="list" onChange={setViewType} options={VIEW_OPTIONS} />
              <span id="library-view-hint" className="sr-only">
                {MIXED_VIEW_HINT}
              </span>
            </fieldset>
          ) : (
            <SegmentedControl label="View" value={viewType} onChange={setViewType} options={VIEW_OPTIONS} />
          )}
        </div>
      </div>

      <div className="mt-8">
        {loadFailed && (
          <Notice tone="error" title="Couldn't load your library" className="mb-6">
            <p>Some of your entries may be missing. Check your connection and try again.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={retryLoad}>
              Try again
            </Button>
          </Notice>
        )}

        {loading ? (
          effectiveViewType === "grid" ? (
            <MediaGridSkeleton aspect={isMusicFilter ? "square" : "poster"} />
          ) : (
            <RowListSkeleton count={6} />
          )
        ) : filteredItems.length === 0 ? (
          loadFailed && watchedItems.length === 0 ? null : nothingLogged ? (
            <EmptyState
              icon={isMusicMode ? Disc3 : Film}
              title={isMusicMode ? "No listens logged yet" : "Nothing watched yet"}
              description={
                isMusicMode
                  ? "Start logging albums and tracks to your library to see them here."
                  : "Start logging films and TV shows to your library to see them here."
              }
              action={
                <Button asChild variant="outline">
                  <Link href="/protected/log">
                    <Plus aria-hidden="true" /> {isMusicMode ? "Log your first listen" : "Log your first watch"}
                  </Link>
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Search}
              title={hasQuery ? <>Nothing matches &ldquo;{searchQuery.trim()}&rdquo;</> : "Nothing under this filter"}
              description={
                hasQuery
                  ? "Try different keywords, or clear the filters to see everything in this mode."
                  : "You have not logged anything of this type yet."
              }
              action={
                <Button variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          )
        ) : effectiveViewType === "grid" ? (
          <MediaGrid>
            {filteredItems.map((item) => (
              <MediaCard
                key={item.id}
                title={item.title}
                subtitle={isMusicItem(item) && item.artist ? item.artist : undefined}
                image={upscalePoster(item.poster_url)}
                aspect={isMusicItem(item) ? "square" : "poster"}
                href={mediaHref(item)}
                rating={Number(item.rating)}
                footer={metaLine(item)}
                fallbackIcon={TYPE_ICON[item.media_type]}
                caption={
                  item.review ? (
                    <p className="line-clamp-4 italic">&ldquo;{item.review}&rdquo;</p>
                  ) : undefined
                }
                actions={renderActions(item)}
              />
            ))}
          </MediaGrid>
        ) : (
          <ul className="advance border-t border-border">
            {filteredItems.map((item) => {
              const music = isMusicItem(item);
              const href = mediaHref(item);
              const poster = upscalePoster(item.poster_url);
              const FallbackIcon = TYPE_ICON[item.media_type];
              return (
                <li key={item.id} className="row-item group relative flex items-start gap-4 px-2 py-4">
                  {/* Film thumbnails are portrait, music thumbnails square */}
                  <div
                    className={`relative flex shrink-0 items-center justify-center overflow-hidden border border-border bg-surface-2 ${
                      music ? "h-12 w-12" : "h-[60px] w-10"
                    }`}
                  >
                    <FallbackIcon className="size-4 text-dim" aria-hidden="true" />
                    {poster && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={poster}
                        alt=""
                        loading="lazy"
                        className="absolute inset-0 h-full w-full object-cover"
                        onError={(e) => e.currentTarget.classList.add("hidden")}
                      />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="t-card truncate">
                      {href ? (
                        <Link href={href} className="after:absolute after:inset-0 after:content-['']">
                          {item.title}
                        </Link>
                      ) : (
                        item.title
                      )}
                    </h3>
                    {music && item.artist && <p className="mt-0.5 truncate text-[12px] text-primary">{item.artist}</p>}
                    <p className="t-meta mt-1">{metaLine(item)}</p>
                    <Stars value={Number(item.rating)} showValue className="mt-1.5" />
                    {item.review && (
                      <p className="t-meta mt-2 line-clamp-2 italic">&ldquo;{item.review}&rdquo;</p>
                    )}
                  </div>

                  <div className="relative z-[1] flex shrink-0 items-center gap-1 opacity-0 transition-opacity duration-cut ease-mech group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
                    {renderActions(item)}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
