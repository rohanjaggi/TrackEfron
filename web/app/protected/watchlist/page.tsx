"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Check,
  Clock,
  Disc3,
  Film,
  LayoutGrid,
  List,
  ListChecks,
  ListMusic,
  Music2,
  Plus,
  Search,
  Tv,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Input } from "@/components/ui/input";
import {
  LoadingLine,
  MediaGridSkeleton,
  PageLoading,
  RowListSkeleton,
} from "@/components/ui/loading";
import { MediaCard, MediaGrid } from "@/components/ui/media-card";
import {
  EmptyState,
  Field,
  Notice,
  PageHeader,
  StatBlock,
} from "@/components/ui/page";
import { SegmentedControl, TabBar } from "@/components/ui/segmented-control";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { useMode } from "@/lib/mode-context";
import { TYPE_META, formatDay, isMusicType } from "@/lib/media";
import type { WatchlistItem } from "@/lib/types";
import { resizePoster } from "@/lib/tmdb/poster";
import { useAddDropdown } from "@/hooks/use-add-dropdown";
import { ListsPanel, type UserList } from "@/components/watchlist/lists-panel";
import { saveToQueue, saveToWatchlist } from "@/lib/saved-items";
import { searchSpotify, searchTmdb } from "@/lib/search-client";
import { useDebouncedSearch } from "@/hooks/use-debounced-search";

type ViewType = "grid" | "list";
type ActiveTab = "watchlist" | "lists";
type FilmType = "movie" | "tv";
type MusicType = "album" | "track";
type MediaType = FilmType | MusicType;
type TypeFilter = "all" | MediaType;

/** A row of the `music_queue` table. */
type MusicQueueItem = {
  id: string;
  spotify_id: string | null;
  media_type: string;
  title: string;
  artist: string | null;
  image_url: string | null;
  added_at: string;
};

/** What the page renders: both tables normalised, discriminated on `kind`. */
type EntryBase = {
  id: string;
  /** The table the row lives in, so removal goes to the right place. */
  source: "watchlist" | "music_queue";
  title: string;
  image: string | null;
  addedAt: string;
};
type FilmEntry = EntryBase & { kind: "film"; mediaType: FilmType; tmdbId: number | null };
type MusicEntry = EntryBase & {
  kind: "music";
  mediaType: MusicType;
  spotifyId: string | null;
  artist: string | null;
};
type Entry = FilmEntry | MusicEntry;

type FilmResult = {
  kind: "film";
  tmdbId: number;
  mediaType: FilmType;
  title: string;
  year: string;
  image: string | null;
  voteAverage: number | null;
};
type MusicResult = {
  kind: "music";
  spotifyId: string;
  mediaType: MusicType;
  title: string;
  artist: string | null;
  year: string;
  image: string | null;
};
type SearchResult = FilmResult | MusicResult;

const FILM_EMOJI_OPTIONS = [
  "🎬", "🍿", "🎥", "📺", "🌙", "❤️", "🔥", "⭐",
  "🎭", "👻", "😂", "💀", "🚀", "🧠", "🎄", "🏠",
  "👫", "👨‍👩‍👧‍👦", "🌍", "🏆"
];

const MUSIC_EMOJI_OPTIONS = [
  "🎵", "🎶", "🎧", "🎤", "🎸", "🎹", "🥁", "🎷",
  "❤️", "🔥", "⭐", "🌙", "💿", "📀", "🎼", "🪩",
  "🎻", "🎺", "🌍", "🏆"
];

const LOG_HREF = "/protected/log";

function formatDate(iso: string): string {
  if (!iso) return "";
  return formatDay(iso);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function isFilmType(value: unknown): value is FilmType {
  return value === "movie" || value === "tv";
}

function parseFilmResults(raw: unknown): FilmResult[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((r: unknown): FilmResult[] => {
    if (!isRecord(r) || typeof r.id !== "number" || !isFilmType(r.media_type)) return [];
    return [
      {
        kind: "film",
        tmdbId: r.id,
        mediaType: r.media_type,
        title: text(r.title) ?? text(r.name) ?? "Untitled",
        year: (text(r.release_date) ?? text(r.first_air_date) ?? "").slice(0, 4),
        image: text(r.poster_url),
        voteAverage: typeof r.vote_average === "number" ? r.vote_average : null,
      },
    ];
  });
}

function parseMusicResults(raw: unknown): MusicResult[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((r: unknown): MusicResult[] => {
    if (!isRecord(r) || typeof r.id !== "string" || !isMusicType(r.type)) return [];
    return [
      {
        kind: "music",
        spotifyId: r.id,
        mediaType: r.type,
        title: text(r.name) ?? "Untitled",
        artist: text(r.artist),
        year: (text(r.release_date) ?? "").slice(0, 4),
        image: text(r.image_url),
      },
    ];
  });
}

function resultKey(result: SearchResult): string {
  return result.kind === "music"
    ? `${result.mediaType}-${result.spotifyId}`
    : `${result.mediaType}-${result.tmdbId}`;
}

function watchlistEntry(row: WatchlistItem): FilmEntry[] {
  if (!isFilmType(row.media_type)) return [];
  return [
    {
      id: row.id,
      source: "watchlist",
      kind: "film",
      title: row.title,
      addedAt: row.added_at ?? "",
      mediaType: row.media_type,
      tmdbId: row.tmdb_id,
      image: row.poster_url,
    },
  ];
}

function queueEntry(row: MusicQueueItem): MusicEntry[] {
  if (!isMusicType(row.media_type)) return [];
  return [{
    id: row.id,
    source: "music_queue",
    kind: "music",
    title: row.title,
    mediaType: row.media_type,
    spotifyId: row.spotify_id,
    artist: row.artist,
    image: row.image_url,
    addedAt: row.added_at,
  }];
}

function entryHref(entry: Entry): string | undefined {
  if (entry.kind === "film") {
    return entry.tmdbId != null ? `/protected/media/${entry.mediaType}/${entry.tmdbId}` : undefined;
  }
  return entry.spotifyId ? `/protected/media/${entry.mediaType}/${entry.spotifyId}` : undefined;
}

function entrySubtitle(entry: Entry): string {
  const label = TYPE_META[entry.mediaType].shortLabel;
  return entry.kind === "music" && entry.artist ? `${entry.artist} · ${label}` : label;
}

/** Small artwork for rows and search results: 2:3 for film, square for music. */
function Thumb({
  image,
  square,
  icon: Icon,
}: {
  image: string | null;
  square: boolean;
  icon: LucideIcon;
}) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden border border-border bg-surface-2 ${
        square ? "h-12 w-12" : "h-[60px] w-10"
      }`}
    >
      {image ? (
         
        <img src={image} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <Icon className="size-4 text-dim" aria-hidden="true" />
      )}
    </div>
  );
}

function WatchlistPageContent() {
  const searchParams = useSearchParams();
  const { mode } = useMode();
  const toast = useToast();

  const isMusicMode = mode === "music";
  const listNoun = isMusicMode ? "queue" : "watchlist";

  const initialTab = searchParams.get("tab") === "lists" ? "lists" : "watchlist";
  const [activeTab, setActiveTab] = useState<ActiveTab>(initialTab);

  // Watchlist state
  const [viewType, setViewType] = useState<ViewType>("grid");
  const [filter, setFilter] = useState<TypeFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(true);
  const [entriesFailed, setEntriesFailed] = useState(false);
  const modeRef = useRef(mode);
  const entriesRequest = useRef(0);
  const listsRequest = useRef(0);

  // Add search state
  const {
    ref: dropdownRef,
    open: dropdownOpen,
    show: showDropdown,
    hide: hideDropdown,
    onKeyDown: onDropdownKeyDown,
    onQueryChange,
    onFocus: onInputFocus,
  } = useAddDropdown();
  const {
    query: addQuery,
    setQuery: setAddQuery,
    results: addResults,
    loading: isSearching,
    error: searchError,
  } = useDebouncedSearch<SearchResult>(async (q) => {
    const raw = await (mode === "music" ? searchSpotify(q, "album,track") : searchTmdb(q));
    showDropdown();
    return mode === "music" ? parseMusicResults(raw) : parseFilmResults(raw);
  }, [mode]);
  const searchFailed = searchError !== null;
  const [addingKey, setAddingKey] = useState<string | null>(null);

  // Lists state
  const [lists, setLists] = useState<UserList[]>([]);
  const [listsLoading, setListsLoading] = useState(true);
  const [listsFailed, setListsFailed] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListDescription, setNewListDescription] = useState("");
  const defaultEmoji = isMusicMode ? "🎵" : "🎬";
  const emojiOptions = isMusicMode ? MUSIC_EMOJI_OPTIONS : FILM_EMOJI_OPTIONS;
  const [newListEmoji, setNewListEmoji] = useState(defaultEmoji);
  const [creatingList, setCreatingList] = useState(false);

  const loadEntries = useCallback(async (forMode: "film" | "music") => {
    if (modeRef.current !== forMode) return;
    const token = ++entriesRequest.current;
    const current = () => token === entriesRequest.current && modeRef.current === forMode;
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!current()) return;
      if (!user) {
        setEntriesFailed(true);
        setEntries([]);
        setEntriesLoading(false);
        return;
      }
      if (forMode === "music") {
        const { data, error } = await supabase
          .from("music_queue")
          .select("id, spotify_id, media_type, title, artist, image_url, added_at")
          .eq("user_id", user.id)
          .order("added_at", { ascending: false });
        if (!current()) return;
        if (error) {
          setEntriesFailed(true);
        } else {
          setEntriesFailed(false);
          setEntries(((data as MusicQueueItem[] | null) ?? []).flatMap(queueEntry));
        }
      } else {
        const { data, error } = await supabase
          .from("watchlist")
          .select("id, tmdb_id, media_type, title, poster_url, added_at")
          .eq("user_id", user.id)
          .in("media_type", ["movie", "tv"])
          .order("added_at", { ascending: false });
        if (!current()) return;
        if (error) {
          setEntriesFailed(true);
        } else {
          setEntriesFailed(false);
          setEntries(((data as WatchlistItem[] | null) ?? []).flatMap(watchlistEntry));
        }
      }
    } catch {
      if (!current()) return;
      setEntriesFailed(true);
    }
    if (current()) setEntriesLoading(false);
  }, []);

  const fetchLists = useCallback(async (forMode: "film" | "music") => {
    if (modeRef.current !== forMode) return;
    const token = ++listsRequest.current;
    const current = () => token === listsRequest.current && modeRef.current === forMode;
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!current()) return;
      if (!user) {
        setListsFailed(true);
        setListsLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from("lists")
        .select("*, list_items(count)")
        .eq("user_id", user.id)
        .eq("list_type", forMode)
        .order("updated_at", { ascending: false });
      if (!current()) return;
      if (error) {
        setListsFailed(true);
      } else {
        setListsFailed(false);
        setLists((data as UserList[]) || []);
      }
    } catch {
      if (!current()) return;
      setListsFailed(true);
    }
    if (current()) setListsLoading(false);
  }, []);

  // When the mode changes: drop the other mode's transient state and refetch.
  useEffect(() => {
    modeRef.current = mode;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a mode switch resets the page state and starts the new mode's fetches
    setFilter("all");
    setViewType("grid");
    setNewListEmoji(mode === "music" ? "🎵" : "🎬");
    setSearchQuery("");
    setAddQuery("");
    hideDropdown();
    setShowCreateForm(false);
    setEntries([]);
    setEntriesLoading(true);
    setLists([]);
    setListsLoading(true);
    void loadEntries(mode);
    void fetchLists(mode);
  }, [mode, loadEntries, fetchLists, setAddQuery, hideDropdown]);

  async function handleAdd(result: SearchResult) {
    const noun = result.kind === "music" ? "queue" : "watchlist";
    const failed = () =>
      toast({
        mark: "Failed",
        tone: "error",
        title: `Couldn't add ${result.title} to your ${noun}`,
        description: "Check your connection and try again.",
      });

    setAddingKey(resultKey(result));
    try {
      const status =
        result.kind === "music"
          ? await saveToQueue({
              spotify_id: result.spotifyId,
              media_type: result.mediaType,
              title: result.title,
              artist: result.artist,
              image_url: result.image,
            })
          : await saveToWatchlist({
              tmdb_id: result.tmdbId,
              title: result.title,
              media_type: result.mediaType,
              poster_url: result.image,
            });

      if (status === "signed_out") {
        toast({
          mark: "Failed",
          tone: "error",
          title: `Couldn't add ${result.title} to your ${noun}`,
          description: "Your session has ended. Sign in again and retry.",
        });
        return;
      }
      if (status === "failed" || status === "unreachable") {
        failed();
        return;
      }

      if (status === "duplicate") {
        toast({ tone: "info", title: `${result.title} is already in your ${noun}` });
      } else {
        toast({ mark: "Added", title: `${result.title} added to your ${noun}` });
      }

      await loadEntries(mode);

      setAddQuery("");
      hideDropdown();
    } catch {
      failed();
    } finally {
      setAddingKey(null);
    }
  }

  async function handleRemove(entry: Entry) {
    const noun = entry.source === "music_queue" ? "queue" : "watchlist";
    const failed = () =>
      toast({
        mark: "Failed",
        tone: "error",
        title: `Couldn't remove ${entry.title} from your ${noun}`,
        description: "It is still here. Try again in a moment.",
      });

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from(entry.source)
        .delete()
        .eq("id", entry.id)
        .select("id");
      if (error || !data || data.length === 0) {
        failed();
        return;
      }
      setEntries((items) => items.filter((item) => item.id !== entry.id));
      toast({ mark: "Removed", title: `${entry.title} removed from your ${noun}` });
    } catch {
      failed();
    }
  }

  function closeCreateForm() {
    setShowCreateForm(false);
    setNewListName("");
    setNewListDescription("");
    setNewListEmoji(defaultEmoji);
  }

  async function handleCreateList() {
    const name = newListName.trim();
    if (!name) return;

    const failed = (description: string) =>
      toast({ mark: "Failed", tone: "error", title: `Couldn't create ${name}`, description });

    setCreatingList(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        failed("Your session has ended. Sign in again and retry.");
        return;
      }

      const { error } = await supabase.from("lists").insert({
        user_id: user.id,
        name,
        description: newListDescription.trim() || null,
        emoji: newListEmoji || null,
        list_type: mode,
      });

      if (error) {
        failed("Your list is still in the form. Try again in a moment.");
        return;
      }

      toast({
        mark: "Created",
        title: `${name} is ready for its first ${isMusicMode ? "album or track" : "film or show"}`,
      });
      closeCreateForm();
      await fetchLists(mode);
    } catch {
      failed("Your list is still in the form. Try again in a moment.");
    } finally {
      setCreatingList(false);
    }
  }

  async function handleDeleteList(list: UserList) {
    const failed = () =>
      toast({
        mark: "Failed",
        tone: "error",
        title: `Couldn't delete ${list.name}`,
        description: "It is still here. Try again in a moment.",
      });

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("lists")
        .delete()
        .eq("id", list.id)
        .select("id");
      if (error || !data || data.length === 0) {
        failed();
        return;
      }
      setLists((items) => items.filter((l) => l.id !== list.id));
      toast({ mark: "Removed", title: `${list.name} deleted` });
    } catch {
      failed();
    }
  }

  const needle = searchQuery.trim().toLowerCase();
  const filteredItems = entries.filter(
    (entry) =>
      (filter === "all" || entry.mediaType === filter) &&
      entry.title.toLowerCase().includes(needle),
  );
  const isFiltered = filter !== "all" || needle.length > 0;

  const countOf = (type: MediaType) => entries.filter((e) => e.mediaType === type).length;
  const stats = isMusicMode
    ? [
        { label: "In queue", value: entries.length },
        { label: "Albums", value: countOf("album") },
        { label: "Tracks", value: countOf("track") },
      ]
    : [
        { label: "To watch", value: entries.length },
        { label: "Films", value: countOf("movie") },
        { label: "TV shows", value: countOf("tv") },
      ];

  const filterOptions: { value: TypeFilter; label: string; icon?: LucideIcon }[] = isMusicMode
    ? [
        { value: "all", label: "All" },
        { value: "album", label: "Albums", icon: Disc3 },
        { value: "track", label: "Tracks", icon: Music2 },
      ]
    : [
        { value: "all", label: "All" },
        { value: "movie", label: "Films", icon: Film },
        { value: "tv", label: "TV", icon: Tv },
      ];

  const filmKeys = new Set<string>();
  const spotifyIds = new Set<string>();
  for (const entry of entries) {
    if (entry.kind === "film") {
      if (entry.tmdbId != null) filmKeys.add(`${entry.mediaType}:${entry.tmdbId}`);
    } else if (entry.spotifyId) {
      spotifyIds.add(entry.spotifyId);
    }
  }
  const isAlreadyAdded = (result: SearchResult) =>
    result.kind === "music"
      ? spotifyIds.has(result.spotifyId)
      : filmKeys.has(`${result.mediaType}:${result.tmdbId}`);

  const logText = (entry: Entry) => (entry.kind === "music" ? "Log listen" : "Log watch");
  const logAria = (entry: Entry) => `${logText(entry)}: ${entry.title}`;

  return (
    <div>
      <PageHeader
        title={
          <>
            Your <em>{listNoun}</em>
          </>
        }
        description={
          activeTab === "watchlist"
            ? isMusicMode
              ? "Albums and tracks you want to listen to next."
              : "Films and shows you want to watch next."
            : isMusicMode
              ? "Curate collections of albums and tracks."
              : "Curate collections of films and shows."
        }
      />

      <TabBar
        label={`${isMusicMode ? "Queue" : "Watchlist"} sections`}
        idBase="watchlist"
        value={activeTab}
        onChange={setActiveTab}
        tabs={[
          {
            value: "watchlist",
            label: isMusicMode ? "Queue" : "Watchlist",
            icon: Clock,
            count: entriesLoading ? undefined : entries.length,
          },
          {
            value: "lists",
            label: "Lists",
            icon: isMusicMode ? ListMusic : ListChecks,
            count: listsLoading ? undefined : lists.length,
          },
        ]}
      />

      {/* ============ WATCHLIST / QUEUE TAB ============ */}
      {activeTab === "watchlist" && (
        <div
          role="tabpanel"
          id="watchlist-panel-watchlist"
          aria-labelledby="watchlist-tab-watchlist"
          className="mt-8 flex flex-col gap-10"
        >
          {/* Search to add */}
          <div>
            <Field label={`Add to your ${listNoun}`} htmlFor="watchlist-add" className="max-w-xl">
              <div
                ref={dropdownRef}
                className="relative"
                onKeyDown={onDropdownKeyDown}
              >
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id="watchlist-add"
                  type="search"
                  autoComplete="off"
                  placeholder={isMusicMode ? "Search for an album or track" : "Search for a film or TV show"}
                  value={addQuery}
                  onChange={(e) => {
                    setAddQuery(e.target.value);
                    onQueryChange(e.target.value);
                  }}
                  onFocus={() => onInputFocus(addResults.length > 0)}
                  className="pl-9"
                />

                {dropdownOpen && !searchFailed && (
                  <div className="drawer-in absolute inset-x-0 top-full z-50 mt-1 max-h-80 overflow-auto border border-border-strong bg-popover">
                    {addResults.length === 0 ? (
                      <p className="t-meta px-3 py-4">
                        Nothing found for &ldquo;{addQuery.trim()}&rdquo;. Try another title.
                      </p>
                    ) : (
                      <ul>
                        {addResults.slice(0, 8).map((result) => {
                          const key = resultKey(result);
                          const meta = TYPE_META[result.mediaType];
                          const details = [
                            result.kind === "music" ? result.artist : null,
                            meta.shortLabel,
                            result.year || null,
                            result.kind === "film" && result.voteAverage != null && result.voteAverage > 0
                              ? `TMDB ${result.voteAverage.toFixed(1)}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · ");
                          const body = (
                            <>
                              <Thumb image={resizePoster(result.image, "w185")} square={result.kind === "music"} icon={meta.icon} />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-foreground">{result.title}</span>
                                <span className="t-meta block truncate">{details}</span>
                              </span>
                            </>
                          );
                          const rowClass = "flex w-full items-center gap-3 px-3 py-2.5 text-left";
                          return (
                            <li key={key} className="row-item last:border-b-0">
                              {isAlreadyAdded(result) ? (
                                <div className={rowClass}>
                                  {body}
                                  <Badge variant="success" className="shrink-0">
                                    <Check className="size-3" aria-hidden="true" />
                                    In {listNoun}
                                  </Badge>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  disabled={addingKey !== null}
                                  onClick={() => handleAdd(result)}
                                  className={`${rowClass} group/result -outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50`}
                                >
                                  {body}
                                  <span className="t-label flex shrink-0 items-center gap-1 transition-colors duration-cut ease-mech group-hover/result:text-primary group-focus-visible/result:text-primary">
                                    <Plus className="size-3.5" aria-hidden="true" />
                                    {addingKey === key ? "Adding" : "Add"}
                                  </span>
                                </button>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </Field>
            <div className="mt-2 min-h-[18px]">
              {isSearching && <LoadingLine label="Searching" />}
            </div>
            {searchFailed && !isSearching && (
              <Notice tone="error" title="Search didn't go through" className="mt-1 max-w-xl">
                Check your connection, then type the title again.
              </Notice>
            )}
          </div>

          {/* Figures */}
          <div className="flex flex-wrap gap-x-12 gap-y-6">
            {stats.map((stat) => (
              <StatBlock key={stat.label} label={stat.label} value={stat.value} loading={entriesLoading} />
            ))}
          </div>

          <div>
            {/* Filters & view */}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <SegmentedControl
                label="Filter by type"
                value={filter}
                onChange={setFilter}
                options={filterOptions}
              />
              <div className="flex w-full items-center gap-3 sm:w-auto">
                <div className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
                  <label htmlFor="watchlist-filter" className="sr-only">
                    Filter your {listNoun} by title
                  </label>
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    id="watchlist-filter"
                    type="search"
                    placeholder={`Filter ${listNoun}`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-9 pl-9"
                  />
                </div>
                <SegmentedControl
                  label="View"
                  value={viewType}
                  onChange={setViewType}
                  className="shrink-0"
                  options={[
                    { value: "grid", label: "Grid view", icon: LayoutGrid, iconOnly: true },
                    { value: "list", label: "List view", icon: List, iconOnly: true },
                  ]}
                />
              </div>
            </div>

            {/* Content */}
            {entriesLoading ? (
              viewType === "grid" ? (
                <MediaGridSkeleton aspect={isMusicMode ? "square" : "poster"} />
              ) : (
                <RowListSkeleton count={5} />
              )
            ) : entriesFailed ? (
              <Notice tone="error" title={`Couldn't load your ${listNoun}`}>
                Check your connection and reload the page.
              </Notice>
            ) : entries.length === 0 ? (
              <EmptyState
                icon={isMusicMode ? Disc3 : Clock}
                title={isMusicMode ? "Nothing queued up yet." : "Nothing on your watchlist yet."}
                description={
                  isMusicMode
                    ? "Search above for an album or track to listen to next, or see what Discover suggests."
                    : "Search above for a film or show to watch next, or see what Discover suggests."
                }
                action={
                  <Button asChild>
                    <Link href="/protected/discover">Browse Discover</Link>
                  </Button>
                }
              />
            ) : filteredItems.length === 0 ? (
              <EmptyState
                icon={Search}
                title={`Nothing in your ${listNoun} matches.`}
                description="Try a different title, or clear the filters to see everything."
                action={
                  isFiltered ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setFilter("all");
                        setSearchQuery("");
                      }}
                    >
                      Clear filters
                    </Button>
                  ) : undefined
                }
              />
            ) : viewType === "grid" ? (
              <>
                <MediaGrid>
                  {filteredItems.map((entry) => (
                    <MediaCard
                      key={entry.id}
                      title={entry.title}
                      subtitle={entrySubtitle(entry)}
                      image={resizePoster(entry.image, "w342")}
                      aspect={entry.kind === "music" ? "square" : "poster"}
                      href={entryHref(entry)}
                      fallbackIcon={TYPE_META[entry.mediaType].icon}
                      actions={
                        <>
                          <Button
                            asChild
                            size="icon"
                            variant="outline"
                            className="bg-background/90"
                          >
                            <Link
                              href={LOG_HREF}
                              aria-label={logAria(entry)}
                              title={logText(entry)}
                            >
                              <Check aria-hidden="true" />
                            </Link>
                          </Button>
                          <ConfirmButton
                            iconOnly
                            label={`Remove ${entry.title} from your ${listNoun}`}
                            confirmLabel="Remove?"
                            className="bg-background/90"
                            onConfirm={() => handleRemove(entry)}
                          />
                        </>
                      }
                    />
                  ))}
                </MediaGrid>
                <p className="t-meta mt-8">
                  On each cover, the tick opens the log page and the bin removes it from your {listNoun}.
                </p>
              </>
            ) : (
              <ul className="advance border-t border-border">
                {filteredItems.map((entry) => {
                  const href = entryHref(entry);
                  const meta = TYPE_META[entry.mediaType];
                  return (
                    <li key={entry.id} className="row-item relative flex items-center gap-4 px-2 py-3">
                      <Thumb
                        image={resizePoster(entry.image, "w185")}
                        square={entry.kind === "music"}
                        icon={meta.icon}
                      />
                      <div className="min-w-0 flex-1">
                        <h3 className="t-card truncate">
                          {href ? (
                            <Link href={href} className="after:absolute after:inset-0 after:content-['']">
                              {entry.title}
                            </Link>
                          ) : (
                            entry.title
                          )}
                        </h3>
                        <p className="t-meta mt-1 truncate">
                          {entrySubtitle(entry)}
                          {entry.addedAt && ` · Added ${formatDate(entry.addedAt)}`}
                        </p>
                      </div>
                      <div className="relative z-[2] flex shrink-0 items-center gap-1">
                        <Button asChild size="sm" variant="outline">
                          <Link href={LOG_HREF} aria-label={logAria(entry)}>
                            <Check aria-hidden="true" />
                            <span className="hidden sm:inline">{logText(entry)}</span>
                          </Link>
                        </Button>
                        <ConfirmButton
                          iconOnly
                          label={`Remove ${entry.title} from your ${listNoun}`}
                          confirmLabel="Remove?"
                          onConfirm={() => handleRemove(entry)}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* ============ LISTS TAB ============ */}
      {activeTab === "lists" && (
        <ListsPanel
          lists={lists}
          loading={listsLoading}
          failed={listsFailed}
          isMusicMode={isMusicMode}
          showCreateForm={showCreateForm}
          newListName={newListName}
          newListDescription={newListDescription}
          newListEmoji={newListEmoji}
          emojiOptions={emojiOptions}
          creatingList={creatingList}
          onOpenForm={() => setShowCreateForm(true)}
          onCloseForm={closeCreateForm}
          onNameChange={setNewListName}
          onDescriptionChange={setNewListDescription}
          onEmojiChange={setNewListEmoji}
          onCreate={handleCreateList}
          onDelete={handleDeleteList}
        />
      )}
    </div>
  );
}

export default function WatchlistPage() {
  return (
    <Suspense fallback={<PageLoading label="Loading" />}>
      <WatchlistPageContent />
    </Suspense>
  );
}
