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
import { Input, Textarea } from "@/components/ui/input";
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
  SectionHeader,
  StatBlock,
} from "@/components/ui/page";
import { SegmentedControl, TabBar } from "@/components/ui/segmented-control";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { useMode } from "@/lib/mode-context";

type ViewType = "grid" | "list";
type ActiveTab = "watchlist" | "lists";
type FilmType = "movie" | "tv";
type MusicType = "album" | "track";
type MediaType = FilmType | MusicType;
type TypeFilter = "all" | MediaType;

/** A row of the `watchlist` table. Older rows may hold music; those are ignored. */
type WatchlistItem = {
  id: string;
  tmdb_id: number | null;
  spotify_id: string | null;
  artist: string | null;
  title: string;
  media_type: string;
  poster_url: string | null;
  added_at: string;
};

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

type UserList = {
  id: string;
  name: string;
  description: string | null;
  emoji: string | null;
  list_type: "film" | "music";
  created_at: string;
  updated_at: string;
  list_items: { count: number }[];
};

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

const TYPE_META: Record<MediaType, { label: string; icon: LucideIcon }> = {
  movie: { label: "Film", icon: Film },
  tv: { label: "TV", icon: Tv },
  album: { label: "Album", icon: Disc3 },
  track: { label: "Track", icon: Music2 },
};

const LOG_HREF = "/protected/log";

function upscalePoster(url: string | null, size = "w500"): string | null {
  if (!url) return null;
  return url.replace(/\/w\d+\//, `/${size}/`);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function countLabel(count: number, music: boolean): string {
  if (music) return count === 1 ? "1 album or track" : `${count} albums and tracks`;
  return count === 1 ? "1 film or show" : `${count} films and shows`;
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

function isMusicType(value: unknown): value is MusicType {
  return value === "album" || value === "track";
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
      addedAt: row.added_at,
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
  const label = TYPE_META[entry.mediaType].label;
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
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <Icon className="size-4 text-dim" aria-hidden="true" />
      )}
    </div>
  );
}

function WatchlistPageContent() {
  const searchParams = useSearchParams();
  const searchRef = useRef<HTMLDivElement>(null);
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
  const [addQuery, setAddQuery] = useState("");
  const [addResults, setAddResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const [showAddDropdown, setShowAddDropdown] = useState(false);
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
          .select("*")
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
          .select("*")
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
    setFilter("all");
    setViewType("grid");
    setNewListEmoji(mode === "music" ? "🎵" : "🎬");
    setSearchQuery("");
    setAddQuery("");
    setAddResults([]);
    setShowAddDropdown(false);
    setSearchFailed(false);
    setIsSearching(false);
    setShowCreateForm(false);
    setEntries([]);
    setEntriesLoading(true);
    setLists([]);
    setListsLoading(true);
    void loadEntries(mode);
    void fetchLists(mode);
  }, [mode, loadEntries, fetchLists]);

  // Debounced search for adding
  useEffect(() => {
    const q = addQuery.trim();
    if (!q) {
      setAddResults([]);
      setShowAddDropdown(false);
      setSearchFailed(false);
      setIsSearching(false);
      return;
    }

    let cancelled = false;
    const t = setTimeout(async () => {
      setIsSearching(true);
      setSearchFailed(false);
      try {
        const url =
          mode === "music"
            ? `/api/spotify?action=search&q=${encodeURIComponent(q)}&type=album,track`
            : `/api?action=search&q=${encodeURIComponent(q)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Search request failed");
        const raw: unknown = await res.json();
        if (cancelled) return;
        setAddResults(mode === "music" ? parseMusicResults(raw) : parseFilmResults(raw));
        setShowAddDropdown(true);
      } catch {
        if (cancelled) return;
        setAddResults([]);
        setShowAddDropdown(false);
        setSearchFailed(true);
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [addQuery, mode]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && e.target instanceof Node && !searchRef.current.contains(e.target)) {
        setShowAddDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          mark: "Failed",
          tone: "error",
          title: `Couldn't add ${result.title} to your ${noun}`,
          description: "Your session has ended. Sign in again and retry.",
        });
        return;
      }

      const { error } =
        result.kind === "music"
          ? await supabase.from("music_queue").insert({
              user_id: user.id,
              spotify_id: result.spotifyId,
              media_type: result.mediaType,
              title: result.title,
              artist: result.artist,
              image_url: result.image,
            })
          : await supabase.from("watchlist").insert({
              user_id: user.id,
              tmdb_id: result.tmdbId,
              title: result.title,
              media_type: result.mediaType,
              poster_url: result.image,
            });

      // 23505: it is already there, which is what the user wanted.
      const duplicate = error?.code === "23505";
      if (error && !duplicate) {
        failed();
        return;
      }

      if (duplicate) {
        toast({ tone: "info", title: `${result.title} is already in your ${noun}` });
      } else {
        toast({ mark: "Added", title: `${result.title} added to your ${noun}` });
      }

      await loadEntries(mode);

      setAddQuery("");
      setShowAddDropdown(false);
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
                ref={searchRef}
                className="relative"
                onKeyDown={(e) => {
                  if (e.key === "Escape") setShowAddDropdown(false);
                }}
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
                  onChange={(e) => setAddQuery(e.target.value)}
                  onFocus={() => addResults.length > 0 && setShowAddDropdown(true)}
                  className="pl-9"
                />

                {showAddDropdown && (
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
                            meta.label,
                            result.year || null,
                            result.kind === "film" && result.voteAverage != null && result.voteAverage > 0
                              ? `TMDB ${result.voteAverage.toFixed(1)}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · ");
                          const body = (
                            <>
                              <Thumb image={result.image} square={result.kind === "music"} icon={meta.icon} />
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
                                  <span className="label-upper flex shrink-0 items-center gap-1 transition-colors duration-cut ease-mech group-hover/result:text-primary group-focus-visible/result:text-primary">
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
            {searchFailed && (
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
                      image={entry.kind === "film" ? upscalePoster(entry.image) : entry.image}
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
                        image={entry.kind === "film" ? upscalePoster(entry.image, "w185") : entry.image}
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
                          {entrySubtitle(entry)} · Added {formatDate(entry.addedAt)}
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
        <div
          role="tabpanel"
          id="watchlist-panel-lists"
          aria-labelledby="watchlist-tab-lists"
          className="mt-8"
        >
          <SectionHeader
            title="Your lists"
            meta={listsLoading || listsFailed ? undefined : `${lists.length} ${lists.length === 1 ? "list" : "lists"}`}
            action={
              !showCreateForm && lists.length > 0 ? (
                <Button variant="outline" size="sm" onClick={() => setShowCreateForm(true)}>
                  <Plus aria-hidden="true" /> New list
                </Button>
              ) : undefined
            }
          />

          {/* Create list */}
          {showCreateForm && (
            <form
              className="frame frame-accent drawer-in mb-8 flex max-w-2xl flex-col gap-5 p-5"
              onSubmit={(e) => {
                e.preventDefault();
                handleCreateList();
              }}
            >
              <h3 className="t-card">New list</h3>

              <fieldset className="flex flex-col gap-2">
                <legend className="label-upper mb-2">Pick an icon</legend>
                <div className="flex flex-wrap gap-2">
                  {emojiOptions.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      aria-pressed={newListEmoji === emoji}
                      aria-label={`Use ${emoji} as the icon`}
                      onClick={() => setNewListEmoji(emoji)}
                      className={`flex h-10 w-10 items-center justify-center border text-[18px] transition-colors duration-cut ease-mech ${
                        newListEmoji === emoji
                          ? "border-primary bg-primary/10"
                          : "border-border bg-background hover:border-border-strong"
                      }`}
                    >
                      <span aria-hidden="true">{emoji}</span>
                    </button>
                  ))}
                </div>
              </fieldset>

              <Field label="Name" htmlFor="list-name">
                <Input
                  id="list-name"
                  required
                  placeholder={isMusicMode ? "e.g. Chill Vibes Playlist" : "e.g. Movie Night with Friends"}
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                />
              </Field>

              <Field label="Description (optional)" htmlFor="list-description">
                <Textarea
                  id="list-description"
                  placeholder="What's this list about?"
                  value={newListDescription}
                  onChange={(e) => setNewListDescription(e.target.value)}
                  rows={2}
                  className="min-h-[72px]"
                />
              </Field>

              <div className="flex flex-wrap gap-2.5">
                <Button type="submit" disabled={!newListName.trim() || creatingList}>
                  <Plus aria-hidden="true" /> {creatingList ? "Creating" : "Create list"}
                </Button>
                <Button type="button" variant="outline" onClick={closeCreateForm}>
                  Cancel
                </Button>
              </div>
            </form>
          )}

          {/* Lists */}
          {listsLoading ? (
            <RowListSkeleton count={3} />
          ) : listsFailed ? (
            <Notice tone="error" title="Couldn't load your lists">
              Check your connection and reload the page.
            </Notice>
          ) : lists.length === 0 ? (
            !showCreateForm && (
              <EmptyState
                icon={isMusicMode ? ListMusic : ListChecks}
                title="No lists yet."
                description={
                  isMusicMode
                    ? "Create lists to organise albums and tracks by genre, mood, or vibe."
                    : "Create lists to organise films and shows by genre, mood, or occasion."
                }
                action={
                  <Button onClick={() => setShowCreateForm(true)}>
                    <Plus aria-hidden="true" /> Create your first list
                  </Button>
                }
              />
            )
          ) : (
            <ul className="advance">
              {lists.map((list) => {
                const itemCount = list.list_items?.[0]?.count ?? 0;
                return (
                  <li key={list.id} className="row-item relative flex items-center gap-4 px-2 py-4">
                    <span
                      aria-hidden="true"
                      className="flex h-11 w-11 shrink-0 items-center justify-center border border-border bg-surface-2 text-[20px]"
                    >
                      {list.emoji || (list.list_type === "music" ? "🎵" : "🎬")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="t-card truncate">
                        <Link
                          href={`/protected/lists/${list.id}`}
                          className="after:absolute after:inset-0 after:content-['']"
                        >
                          {list.name}
                        </Link>
                      </h3>
                      {list.description && (
                        <p className="t-meta mt-1 line-clamp-2">{list.description}</p>
                      )}
                      <p className="t-meta mt-1">
                        {countLabel(itemCount, isMusicMode)} · Created {formatDate(list.created_at)}
                      </p>
                    </div>
                    <ConfirmButton
                      iconOnly
                      label={`Delete ${list.name}`}
                      confirmLabel="Delete list"
                      className="relative z-[2] shrink-0"
                      onConfirm={() => handleDeleteList(list)}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
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
