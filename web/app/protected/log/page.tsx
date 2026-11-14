"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, Check, Disc3, Film, Music2, Search, Tv } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Disclosure } from "@/components/ui/disclosure";
import { Input, Select, Textarea } from "@/components/ui/input";
import { LoadingLine, PageLoading } from "@/components/ui/loading";
import { Field, Notice, PageHeader } from "@/components/ui/page";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { StarInput, Stars } from "@/components/ui/stars";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { useMode, useSyncMode } from "@/lib/mode-context";
import type { SpotifySearchResult } from "@/lib/spotify/spotify";
import { resizePoster } from "@/lib/tmdb/poster";
import type { MediaSearchResult } from "@/lib/types";
import { cn } from "@/lib/utils";

type MediaType = "movie" | "tv" | "album" | "track";

type OtherType = { type: MediaType; count: number };
type SearchState = {
  key: string;
  type: MediaType;
  results: MediaSearchResult[];
  failed: boolean;
  /** Results of the mode's other type, offered when the chosen type has none. */
  other: OtherType | null;
};
type Prefill = { type: MediaType; id: string; title: string };
type Domain = "film" | "music";
type SaveIntent = "done" | "another";
type FormError = { title?: string; message: string };
type Choice = { value: string; label: string };

const TYPE_META: Record<MediaType, { label: string; plural: string; icon: LucideIcon }> = {
  movie: { label: "Film", plural: "films", icon: Film },
  tv: { label: "TV show", plural: "TV shows", icon: Tv },
  album: { label: "Album", plural: "albums", icon: Disc3 },
  track: { label: "Track", plural: "tracks", icon: Music2 },
};

const FILM_TYPES = [
  { value: "movie", label: TYPE_META.movie.label, icon: Film },
  { value: "tv", label: TYPE_META.tv.label, icon: Tv },
] as const;

const MUSIC_TYPES = [
  { value: "album", label: TYPE_META.album.label, icon: Disc3 },
  { value: "track", label: TYPE_META.track.label, icon: Music2 },
] as const;

const same = (values: string[]): Choice[] => values.map((v) => ({ value: v, label: v }));

const LISTENED_ON = same(["Spotify", "Apple Music", "YouTube Music", "SoundCloud", "Vinyl", "CD", "Other"]);
const LISTENING_CONTEXT = same(["Chill", "Workout", "Study", "Commute", "Party", "Sleep", "Other"]);
const WATCHED_ON = same([
  "Netflix",
  "Disney+",
  "Prime Video",
  "Hulu",
  "HBO Max",
  "Apple TV+",
  "Paramount+",
  "Peacock",
  "Streaming Site",
  "Cinema",
  "Other",
]);
const WATCH_DURATION = same(["One sitting", "A few days", "About a week", "A few weeks", "Over a month"]);
// Stored values are unchanged; only the labels are tidied.
const DISCOVERED_VIA: Choice[] = [
  { value: "Friend/Family", label: "Friend or family" },
  { value: "Social Media", label: "Social media" },
  { value: "Streaming Recommendation", label: "Streaming recommendation" },
  { value: "Trailer", label: "Trailer" },
  { value: "Review/Article", label: "Review or article" },
  { value: "Just Browsing", label: "Just browsing" },
  { value: "Other", label: "Other" },
];
const REWATCHABILITY = same(["Definitely", "Probably", "Maybe", "Unlikely", "No way"]);
const WATCHED_WITH = same(["Solo", "Partner", "Friends", "Family", "Group"]);
const TIMES_WATCHED = same(["1", "2", "3", "4", "5", "6+"]);

const LISTBOX_ID = "log-title-results";
const optionId = (index: number) => `log-title-option-${index}`;

/** Today's date as YYYY-MM-DD in the user's own timezone. */
function today() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const isMusicType = (type: MediaType | null) => type === "album" || type === "track";
const labelOf = (item: MediaSearchResult) => item.title || item.name || "Untitled";
const yearOf = (item: MediaSearchResult) => (item.release_date || item.first_air_date || "").slice(0, 4);

export default function LogWatchPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <LogWatchForm />
    </Suspense>
  );
}

const MEDIA_TYPES: readonly MediaType[] = ["movie", "tv", "album", "track"];
const domainOf = (type: MediaType): Domain => (isMusicType(type) ? "music" : "film");

function parsePrefill(params: URLSearchParams): Prefill | null {
  if (params.get("edit")) return null;
  const type = params.get("type");
  if (!type || !MEDIA_TYPES.includes(type as MediaType)) return null;
  return { type: type as MediaType, id: params.get("id") ?? "", title: (params.get("title") ?? "").trim() };
}

/** Spotify search for one music type. Throws when the server reports an error. */
async function searchMusic(query: string, type: MediaType): Promise<MediaSearchResult[]> {
  const res = await fetch(`/api/spotify?action=search&q=${encodeURIComponent(query)}&type=${type}`);
  if (!res.ok) throw new Error("Search failed");
  const raw: unknown = await res.json();
  if (!Array.isArray(raw)) return [];
  return (raw as SpotifySearchResult[]).map((r, idx) => ({
    id: idx + 1,
    media_type: type as "album" | "track",
    spotify_id: r.id,
    name: r.name,
    artist: r.artist,
    album_name: r.album_name,
    poster_url: r.image_url,
    release_date: r.release_date,
  }));
}

/** Result thumbnail: artwork when it loads, otherwise the type's icon. */
function ResultThumb({ src, music, Icon }: { src?: string | null; music: boolean; Icon: LucideIcon }) {
  const [failed, setFailed] = useState(false);
  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden bg-surface-2",
        music ? "h-8 w-8" : "h-[38px] w-[26px]",
      )}
    >
      {src && !failed ? (
         
        <img
          src={src}
          alt=""
          loading="eager"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <Icon className="size-3.5 text-dim" aria-hidden="true" />
      )}
    </span>
  );
}

function LogWatchForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { mode } = useMode();
  const toast = useToast();
  const editId = searchParams.get("edit");
  const editKind = searchParams.get("kind");
  const isEditMode = !!editId;
  const titleRef = useRef<HTMLInputElement>(null);

  // Links like ?type=tv&id=1399&title=Game+of+Thrones open the form pre-filled (create mode only).
  const [initialPrefill] = useState(() => parsePrefill(searchParams));
  const prefillRef = useRef<Prefill | null>(initialPrefill);
  const chooseRef = useRef<(item: MediaSearchResult) => void>(() => {});

  const [editLoading, setEditLoading] = useState(!!editId);
  const [loadFailed, setLoadFailed] = useState(false);
  const [editDomain, setEditDomain] = useState<Domain | null>(null);
  // Pre-select based on current mode (music → album, film → movie)
  // In edit mode this will be overwritten by loadExisting()
  const [mediaType, setMediaType] = useState<MediaType | null>(
    isEditMode ? null : (initialPrefill?.type ?? (mode === "music" ? "album" : "movie")),
  );
  const [syncedMode, setSyncedMode] = useState(mode);
  const [title, setTitle] = useState(initialPrefill?.title ?? "");
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");
  const [watchedDate, setWatchedDate] = useState(today);
  const [savingIntent, setSavingIntent] = useState<SaveIntent | null>(null);
  const [error, setError] = useState<FormError | null>(null);
  const [search, setSearch] = useState<SearchState | null>(null);
  const [searchOpen, setSearchOpen] = useState(!!initialPrefill?.title);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [selectedMovie, setSelectedMovie] = useState<MediaSearchResult | null>(null);
  const [showCategories, setShowCategories] = useState(false);
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [watchedOn, setWatchedOn] = useState("");
  const [watchDuration, setWatchDuration] = useState("");
  const [discoveredVia, setDiscoveredVia] = useState("");
  const [rewatchability, setRewatchability] = useState("");
  const [watchedWith, setWatchedWith] = useState("");
  const [timesWatched, setTimesWatched] = useState("");
  const [plotRating, setPlotRating] = useState(0);
  const [cinematographyRating, setCinematographyRating] = useState(0);
  const [actingRating, setActingRating] = useState(0);
  const [soundtrackRating, setSoundtrackRating] = useState(0);
  const [pacingRating, setPacingRating] = useState(0);
  const [castingRating, setCastingRating] = useState(0);
  // Music-specific state
  const [spotifyId, setSpotifyId] = useState<string | null>(null);
  const [artist, setArtist] = useState("");
  const [albumName, setAlbumName] = useState("");
  const [lyricsRating, setLyricsRating] = useState(0);
  const [productionRating, setProductionRating] = useState(0);
  const [vocalsRating, setVocalsRating] = useState(0);
  const [melodyRating, setMelodyRating] = useState(0);
  const [replayRating, setReplayRating] = useState(0);
  const [energyRating, setEnergyRating] = useState(0);
  const [listenedOn, setListenedOn] = useState("");
  const [listeningContext, setListeningContext] = useState("");

  const clearSelection = () => {
    setSelectedMovie(null);
    setSpotifyId(null);
    setArtist("");
    setAlbumName("");
  };

  // A single item's page follows the item: an edited log or a pre-filled link moves the app to its mode.
  useSyncMode(isEditMode ? editDomain : initialPrefill ? domainOf(initialPrefill.type) : null);

  // If the app's mode flips while logging something new, follow it: the type
  // choice only offers the current mode's two types. The typed title is kept;
  // the chosen item and the open results belong to the old mode and are dropped.
  if (syncedMode !== mode) {
    setSyncedMode(mode);
    if (!isEditMode && isMusicType(mediaType) !== (mode === "music")) {
      setMediaType(mode === "music" ? "album" : "movie");
      clearSelection();
      setSearchOpen(false);
      setActiveIndex(-1);
    }
  }

  const isSelectedMusic = isMusicType(mediaType);
  const query = title.trim();
  const searchKey = `${mediaType}:${query}`;
  const selectedLabel = selectedMovie ? labelOf(selectedMovie) : null;
  // No lookup right after choosing a match (or while an edited log still has its own title).
  const canSearch = !!mediaType && !!query && selectedLabel !== title;
  const searchPending = canSearch && search?.key !== searchKey;
  const searchFailed = canSearch && !searchPending && !!search?.failed;
  const otherType = !searchPending && search?.type === mediaType ? search.other : null;
  const visibleResults = canSearch && search && search.type === mediaType ? search.results.slice(0, 8) : [];
  const panelOpen = searchOpen && canSearch;
  const activeOption = panelOpen && activeIndex >= 0 && activeIndex < visibleResults.length ? activeIndex : -1;

  useEffect(() => {
    if (!canSearch || !mediaType) return;
    let cancelled = false;
    const type = mediaType;

    const t = setTimeout(async () => {
      try {
        let data: MediaSearchResult[];
        let other: OtherType | null = null;
        if (isMusicType(type)) {
          data = await searchMusic(query, type);
          if (data.length === 0) {
            // The Spotify search is per type: look for the sibling type to offer it.
            const sibling: MediaType = type === "album" ? "track" : "album";
            try {
              const found = await searchMusic(query, sibling);
              if (found.length > 0) other = { type: sibling, count: found.length };
            } catch {
              // The hint is optional.
            }
          }
        } else {
          const res = await fetch(`/api?action=search&q=${encodeURIComponent(query)}`);
          if (!res.ok) throw new Error("Search failed");
          const raw: unknown = await res.json();
          const all = Array.isArray(raw) ? (raw as MediaSearchResult[]) : [];
          // The film search returns films and shows together: keep the chosen type.
          data = all.filter((r) => !r.media_type || r.media_type === type);
          const sibling: MediaType = type === "movie" ? "tv" : "movie";
          const siblingCount = all.filter((r) => r.media_type === sibling).length;
          if (data.length === 0 && siblingCount > 0) other = { type: sibling, count: siblingCount };
        }
        if (!cancelled) {
          setSearch({ key: searchKey, type, results: data, failed: false, other });
          setActiveIndex(-1);
          // A pre-filled link selects its item when the first result is that item.
          const pf = prefillRef.current;
          if (pf && pf.type === type && pf.title === query) {
            prefillRef.current = null;
            const first = data[0];
            if (first && pf.id && (isMusicType(type) ? first.spotify_id === pf.id : String(first.id) === pf.id)) {
              chooseRef.current(first);
            }
          }
        }
      } catch {
        if (!cancelled) {
          setSearch({ key: searchKey, type, results: [], failed: true, other: null });
          setActiveIndex(-1);
        }
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [canSearch, mediaType, query, searchKey]);

  // Keep the keyboard-highlighted result in view.
  useEffect(() => {
    if (activeOption < 0) return;
    document.getElementById(optionId(activeOption))?.scrollIntoView({ block: "nearest" });
  }, [activeOption]);

  // Load existing log for edit mode (watch_logs for film, listen_logs for music)
  useEffect(() => {
    if (!editId) return;
    let cancelled = false;
    async function loadExisting() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (!cancelled) setLoadFailed(true);
          return;
        }
        // ?kind=film or ?kind=music names the table; with no kind, watch_logs then listen_logs.
        let filmData = null;
        if (editKind !== "music") {
          const res = await supabase
            .from("watch_logs")
            .select("*")
            .eq("id", editId)
            .eq("user_id", user.id)
            .maybeSingle();
          // No row is expected here (PGRST116) when the entry is a music one.
          if (res.error && res.error.code !== "PGRST116") throw res.error;
          filmData = res.data;
        }
        if (cancelled) return;

        if (filmData) {
          setEditDomain("film");
          setMediaType(filmData.media_type);
          setTitle(filmData.title);
          setRating(filmData.rating);
          setReview(filmData.review || "");
          setWatchedDate(filmData.watched_date || today());
          setWatchedOn(filmData.watched_on || "");
          setWatchDuration(filmData.watch_duration || "");
          setDiscoveredVia(filmData.discovered_via || "");
          setRewatchability(filmData.rewatchability || "");
          setWatchedWith(filmData.watched_with || "");
          setTimesWatched(filmData.times_watched || "");
          setPlotRating(filmData.plot_rating || 0);
          setCinematographyRating(filmData.cinematography_rating || 0);
          setActingRating(filmData.acting_rating || 0);
          setSoundtrackRating(filmData.soundtrack_rating || 0);
          setPacingRating(filmData.pacing_rating || 0);
          setCastingRating(filmData.casting_rating || 0);
          if (filmData.tmdb_id) {
            setSelectedMovie({
              id: filmData.tmdb_id,
              media_type: filmData.media_type,
              title: filmData.title,
              poster_url: filmData.poster_url,
            });
          }
          if (filmData.plot_rating || filmData.cinematography_rating || filmData.acting_rating ||
              filmData.soundtrack_rating || filmData.pacing_rating || filmData.casting_rating) {
            setShowCategories(true);
          }
          if (filmData.watched_on || filmData.watch_duration || filmData.discovered_via ||
              filmData.rewatchability || filmData.watched_with || filmData.times_watched) {
            setShowMoreDetails(true);
          }
        } else {
          let musicData = null;
          if (editKind !== "film") {
            const res = await supabase
              .from("listen_logs")
              .select("*")
              .eq("id", editId)
              .eq("user_id", user.id)
              .maybeSingle();
            if (res.error) throw res.error;
            musicData = res.data;
          }
          if (cancelled) return;
          if (musicData) {
            setEditDomain("music");
            setMediaType(musicData.media_type);
            setTitle(musicData.title);
            setRating(musicData.rating);
            setReview(musicData.review || "");
            setWatchedDate(musicData.listened_date || today());
            setSpotifyId(musicData.spotify_id || null);
            setArtist(musicData.artist || "");
            setAlbumName(musicData.album_name || "");
            setListenedOn(musicData.listened_on || "");
            setListeningContext(musicData.listening_context || "");
            setLyricsRating(musicData.lyrics_rating || 0);
            setProductionRating(musicData.production_rating || 0);
            setVocalsRating(musicData.vocals_rating || 0);
            setMelodyRating(musicData.melody_rating || 0);
            setReplayRating(musicData.replay_rating || 0);
            setEnergyRating(musicData.energy_rating || 0);
            if (musicData.spotify_id) {
              setSelectedMovie({
                id: 0,
                media_type: musicData.media_type,
                spotify_id: musicData.spotify_id,
                name: musicData.title,
                artist: musicData.artist,
                poster_url: musicData.image_url,
                release_date: musicData.release_date,
              });
            }
            if (musicData.lyrics_rating || musicData.production_rating || musicData.vocals_rating ||
                musicData.melody_rating || musicData.replay_rating || musicData.energy_rating) {
              setShowCategories(true);
            }
            if (musicData.listened_on || musicData.listening_context) {
              setShowMoreDetails(true);
            }
          } else {
            setLoadFailed(true);
          }
        }
      } catch {
        if (!cancelled) setLoadFailed(true);
      } finally {
        if (!cancelled) setEditLoading(false);
      }
    }
    loadExisting();
    return () => {
      cancelled = true;
    };
  }, [editId, editKind]);

  const resetForm = () => {
    setTitle("");
    setRating(0);
    setReview("");
    // The date and type stay: logging a backlog means the same day, often the same kind.
    clearSelection();
    setSearch(null);
    setSearchOpen(false);
    setActiveIndex(-1);
    setShowCategories(false);
    setShowMoreDetails(false);
    setWatchedOn("");
    setWatchDuration("");
    setDiscoveredVia("");
    setRewatchability("");
    setWatchedWith("");
    setTimesWatched("");
    setPlotRating(0);
    setCinematographyRating(0);
    setActingRating(0);
    setSoundtrackRating(0);
    setPacingRating(0);
    setCastingRating(0);
    setLyricsRating(0);
    setProductionRating(0);
    setVocalsRating(0);
    setMelodyRating(0);
    setReplayRating(0);
    setEnergyRating(0);
    setListenedOn("");
    setListeningContext("");
  };

  /** Writes the log. "ok" only when Supabase reports no error. */
  const persist = async (): Promise<"ok" | "signed-out" | "failed" | "missing"> => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return "signed-out";

    if (isMusicType(mediaType)) {
      const musicData = {
        spotify_id: spotifyId || null,
        media_type: mediaType,
        title,
        artist: artist || null,
        album_name: albumName || null,
        image_url: selectedMovie?.poster_url || null,
        release_date: selectedMovie?.release_date || null,
        rating,
        review: review || null,
        listened_date: watchedDate || null,
        listened_on: listenedOn || null,
        listening_context: listeningContext || null,
        lyrics_rating: lyricsRating || null,
        production_rating: productionRating || null,
        vocals_rating: vocalsRating || null,
        melody_rating: melodyRating || null,
        replay_rating: replayRating || null,
        energy_rating: energyRating || null,
      };
      const { data: saved, error: saveError } =
        isEditMode && editId
          ? await supabase.from("listen_logs").update(musicData).eq("id", editId).eq("user_id", user.id).select("id")
          : await supabase.from("listen_logs").insert({ user_id: user.id, ...musicData }).select("id");
      if (saveError) return "failed";
      if (!saved || saved.length === 0) return isEditMode ? "missing" : "failed";
      return "ok";
    }

    const logData = {
      tmdb_id: selectedMovie?.id || null,
      title,
      media_type: mediaType,
      poster_url: selectedMovie?.poster_url || null,
      rating,
      review: review || null,
      watched_date: watchedDate || null,
      watched_on: watchedOn || null,
      watch_duration: watchDuration || null,
      discovered_via: discoveredVia || null,
      rewatchability: rewatchability || null,
      watched_with: watchedWith || null,
      times_watched: timesWatched || null,
      plot_rating: plotRating || null,
      cinematography_rating: cinematographyRating || null,
      acting_rating: actingRating || null,
      soundtrack_rating: soundtrackRating || null,
      pacing_rating: pacingRating || null,
      casting_rating: castingRating || null,
    };
    const { data: saved, error: saveError } =
      isEditMode && editId
        ? await supabase.from("watch_logs").update(logData).eq("id", editId).eq("user_id", user.id).select("id")
        : await supabase.from("watch_logs").insert({ user_id: user.id, ...logData }).select("id");
    if (saveError) return "failed";
    if (!saved || saved.length === 0) return isEditMode ? "missing" : "failed";
    return "ok";
  };

  const save = async (intent: SaveIntent) => {
    if (savingIntent || !mediaType) return;
    setError(null);

    if (!query) {
      setError({ message: "Add a title before saving." });
      titleRef.current?.focus();
      return;
    }
    if (rating === 0) {
      setError({ message: "Choose an overall rating before saving." });
      return;
    }

    setSavingIntent(intent);
    let outcome: "ok" | "signed-out" | "failed" | "missing";
    try {
      outcome = await persist();
    } catch {
      outcome = "failed";
    }

    if (outcome !== "ok") {
      setError(
        outcome === "signed-out"
          ? {
              title: "You're signed out",
              message: "Sign in again in another tab, then save. Everything you entered is still here.",
            }
          : outcome === "missing"
            ? { message: "That log couldn't be updated. It may have been deleted." }
            : {
                title: "Couldn't save",
                message: "Check your connection and try again. Everything you entered is still here.",
              },
      );
      setSavingIntent(null);
      return;
    }

    toast(
      isEditMode
        ? { mark: "Updated", title: `${query} updated in your library` }
        : { mark: "Logged", title: `${query} added to your library` },
    );

    if (intent === "another") {
      resetForm();
      setSavingIntent(null);
      titleRef.current?.focus();
      return;
    }
    // Stay in the saving state until the library replaces this page.
    router.push("/protected/library");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void save("done");
  };

  const handleTitleChange = (value: string) => {
    setTitle(value);
    setSearchOpen(true);
    setActiveIndex(-1);
    // Retyping away from a chosen match drops its ids and artwork (the text stays).
    // When editing, the log keeps its identity unless a different result is picked.
    if (!isEditMode && selectedMovie && value !== labelOf(selectedMovie)) clearSelection();
  };

  const handleTypeChange = (type: MediaType) => {
    if (type === mediaType) return;
    // Keep what was typed; drop the match only if it belongs to the other type.
    if (selectedMovie && selectedMovie.media_type !== type) clearSelection();
    setMediaType(type);
    setActiveIndex(-1);
  };

  const chooseResult = (item: MediaSearchResult) => {
    setTitle(labelOf(item));
    setSelectedMovie(item);
    setSearchOpen(false);
    setActiveIndex(-1);
    if (isSelectedMusic) {
      setSpotifyId(item.spotify_id || null);
      setArtist(item.artist || "");
      setAlbumName(item.album_name || "");
    }
  };

  useEffect(() => {
    chooseRef.current = chooseResult;
  });

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!canSearch) return;
      e.preventDefault();
      if (!panelOpen) {
        setSearchOpen(true);
        return;
      }
      const count = visibleResults.length;
      if (count === 0) return;
      setActiveIndex(
        e.key === "ArrowDown"
          ? (activeOption + 1) % count
          : activeOption <= 0
            ? count - 1
            : activeOption - 1,
      );
    } else if (e.key === "Enter") {
      // Enter chooses only a highlighted option; otherwise it submits the form as usual.
      if (activeOption < 0) return;
      e.preventDefault();
      chooseResult(visibleResults[activeOption]);
    } else if (e.key === "Escape") {
      if (!panelOpen) return;
      e.preventDefault();
      setSearchOpen(false);
      setActiveIndex(-1);
    }
  };

  if (editLoading) {
    return <PageLoading label="Loading your log" />;
  }

  if (loadFailed || !mediaType) {
    return (
      <div>
        <PageHeader title={<>Edit your <em>log</em></>} />
        <Notice tone="error" title="Couldn't open that log" className="max-w-[640px]">
          It may have been removed, or the connection dropped. Go back to your library and try again.
        </Notice>
        <Button asChild variant="outline" className="mt-6">
          <Link href="/protected/library">
            <ArrowLeft aria-hidden="true" /> Back to library
          </Link>
        </Button>
      </div>
    );
  }

  const meta = TYPE_META[mediaType];
  const ArtIcon = meta.icon;
  const goBack = () => {
    if (window.history.length > 1) router.back();
    else router.push("/protected");
  };
  const isSaving = savingIntent !== null;

  const categories: { key: string; label: string; value: number; setter: (v: number) => void }[] = isSelectedMusic
    ? [
        { key: "lyrics", label: "Lyrics", value: lyricsRating, setter: setLyricsRating },
        { key: "production", label: "Production", value: productionRating, setter: setProductionRating },
        { key: "vocals", label: "Vocals", value: vocalsRating, setter: setVocalsRating },
        { key: "melody", label: "Melody", value: melodyRating, setter: setMelodyRating },
        { key: "replay", label: "Replay value", value: replayRating, setter: setReplayRating },
        { key: "energy", label: "Energy", value: energyRating, setter: setEnergyRating },
      ]
    : [
        { key: "plot", label: "Plot", value: plotRating, setter: setPlotRating },
        { key: "cinematography", label: "Cinematography", value: cinematographyRating, setter: setCinematographyRating },
        { key: "acting", label: "Acting", value: actingRating, setter: setActingRating },
        { key: "soundtrack", label: "Soundtrack", value: soundtrackRating, setter: setSoundtrackRating },
        { key: "pacing", label: "Pacing", value: pacingRating, setter: setPacingRating },
        { key: "casting", label: "Casting", value: castingRating, setter: setCastingRating },
      ];

  const details: { key: string; label: string; value: string; setter: (v: string) => void; options: Choice[] }[] =
    isSelectedMusic
      ? [
          { key: "listened-on", label: "Where did you listen?", value: listenedOn, setter: setListenedOn, options: LISTENED_ON },
          { key: "context", label: "What was the context?", value: listeningContext, setter: setListeningContext, options: LISTENING_CONTEXT },
        ]
      : [
          { key: "watched-on", label: "Where did you watch?", value: watchedOn, setter: setWatchedOn, options: WATCHED_ON },
          { key: "duration", label: "How long did it take to finish?", value: watchDuration, setter: setWatchDuration, options: WATCH_DURATION },
          { key: "discovered", label: "How did you discover this?", value: discoveredVia, setter: setDiscoveredVia, options: DISCOVERED_VIA },
          { key: "rewatch", label: "Would you rewatch?", value: rewatchability, setter: setRewatchability, options: REWATCHABILITY },
          { key: "with", label: "Who did you watch with?", value: watchedWith, setter: setWatchedWith, options: WATCHED_WITH },
          { key: "times", label: "How many times have you watched this?", value: timesWatched, setter: setTimesWatched, options: TIMES_WATCHED },
        ];

  const ratedCount = categories.filter((c) => c.value > 0).length;
  const detailCount = details.filter((d) => d.value !== "").length;

  const typeLabel = isEditMode ? "Type" : isSelectedMusic ? "What did you listen to?" : "What did you watch?";

  return (
    <div>
      <PageHeader
        className="lg:max-w-[984px]"
        title={
          isEditMode ? (
            <>Edit your <em>log</em></>
          ) : isSelectedMusic ? (
            <>Log a <em>listen</em></>
          ) : (
            <>Log a <em>watch</em></>
          )
        }
        actions={
          <Button variant="ghost" onClick={goBack}>
            <ArrowLeft aria-hidden="true" />
            Back
          </Button>
        }
      />

      <div className="grid grid-cols-1 items-start gap-x-16 gap-y-12 lg:grid-cols-[minmax(0,640px)_280px]">
        <form onSubmit={handleSubmit} className="flex min-w-0 flex-col gap-7">
          {/* Type: two choices per domain; when editing, only the row's own domain */}
          <div className="flex flex-col items-start gap-2">
            <span className="t-label">{typeLabel}</span>
            <SegmentedControl<MediaType>
              label={typeLabel}
              options={isSelectedMusic ? MUSIC_TYPES : FILM_TYPES}
              value={mediaType}
              onChange={handleTypeChange}
            />
          </div>

          {/* Title search */}
          <Field
            label="Title"
            htmlFor="log-title"
            hint="Choose a match to attach its artwork, or keep the title as you typed it."
          >
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                ref={titleRef}
                id="log-title"
                type="text"
                role="combobox"
                aria-expanded={panelOpen}
                aria-controls={LISTBOX_ID}
                aria-autocomplete="list"
                aria-activedescendant={activeOption >= 0 ? optionId(activeOption) : undefined}
                aria-describedby="log-title-hint"
                autoComplete="off"
                placeholder={`Search ${meta.plural}`}
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                onKeyDown={handleTitleKeyDown}
                onFocus={() => setSearchOpen(true)}
                onBlur={() => {
                  setSearchOpen(false);
                  setActiveIndex(-1);
                }}
                className="pl-9"
                required
              />
            </div>

            {panelOpen && (
              <div
                className="drawer-in max-h-[min(360px,50vh)] overflow-y-auto border border-border-strong bg-popover"
                // Keep focus in the field so a click or scroll here doesn't close the list first.
                onMouseDown={(e) => e.preventDefault()}
              >
                {searchPending && <LoadingLine label="Searching" className="px-3.5 py-3" />}
                <ul id={LISTBOX_ID} role="listbox" aria-label={`Matching ${meta.plural}`}>
                  {visibleResults.map((r, idx) => {
                    const lbl = labelOf(r);
                    const yr = yearOf(r);
                    return (
                      <li
                        key={r.spotify_id || r.id || idx}
                        id={optionId(idx)}
                        role="option"
                        aria-selected={idx === activeOption}
                        onClick={() => chooseResult(r)}
                        className="flex cursor-pointer items-center gap-3 border-b border-border px-3.5 py-2.5 transition-colors duration-cut ease-mech last:border-b-0 hover:bg-primary/10 aria-selected:bg-primary/10"
                      >
                        <ResultThumb src={r.poster_url} music={isSelectedMusic} Icon={ArtIcon} />
                        <span className="min-w-0 flex-1">
                          <span className="t-card block truncate">{lbl}</span>
                          {isSelectedMusic && r.artist && (
                            <span className="block truncate text-[12px] text-primary">{r.artist}</span>
                          )}
                          {yr && <span className="block text-[12px] text-muted-foreground">{yr}</span>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {!searchPending && searchFailed && (
                  <p className="px-3.5 py-3 text-[13px] text-muted-foreground">
                    Search isn&apos;t responding. You can still save with the title you typed.
                  </p>
                )}
                {!searchPending && !searchFailed && visibleResults.length === 0 && (
                  <div className="px-3.5 py-3 text-[13px] text-muted-foreground">
                    <p>No matches</p>
                    {otherType && (
                      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span>
                          Found {otherType.count}{" "}
                          {otherType.count === 1 ? TYPE_META[otherType.type].label : TYPE_META[otherType.type].plural}{" "}
                          with that title.
                        </span>
                        <Button variant="outline" size="sm" onClick={() => handleTypeChange(otherType.type)}>
                          Switch to {TYPE_META[otherType.type].label}
                        </Button>
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Compact confirmation of the match; the artwork is in the preview */}
            {selectedMovie && (
              <div className="flex items-center gap-3 border border-primary/50 bg-primary/10 px-3 py-2.5">
                <Check className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <span className="t-card block truncate">{labelOf(selectedMovie)}</span>
                  {selectedMovie.artist && (
                    <span className="block truncate text-[12px] text-primary">{selectedMovie.artist}</span>
                  )}
                </div>
                {yearOf(selectedMovie) && (
                  <span className="shrink-0 text-[12px] text-muted-foreground">{yearOf(selectedMovie)}</span>
                )}
              </div>
            )}
          </Field>

          {/* Overall rating */}
          <div className="flex flex-col items-start gap-2">
            <span className="t-label">Your rating</span>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <StarInput label="Your rating" value={rating} onChange={setRating} />
              <span className="t-meta" aria-hidden="true">
                {rating > 0 ? `${rating} out of 5` : "Not rated yet"}
              </span>
            </div>
          </div>

          <Field label={isSelectedMusic ? "Date listened" : "Date watched"} htmlFor="log-date" className="max-w-[240px]">
            <Input
              id="log-date"
              type="date"
              value={watchedDate}
              onChange={(e) => setWatchedDate(e.target.value)}
              max={today()}
            />
          </Field>

          <Field label="Review (optional)" htmlFor="log-review" hint={`${review.length} characters`}>
            <Textarea
              id="log-review"
              aria-describedby="log-review-hint"
              placeholder="What did you think?"
              value={review}
              onChange={(e) => setReview(e.target.value)}
            />
          </Field>

          {/* Optional extras, closed until wanted */}
          <div>
            <Disclosure
              id="log-categories"
              title="Rate by category"
              summary={ratedCount > 0 ? `${ratedCount} of ${categories.length} rated` : "Optional"}
              open={showCategories}
              onOpenChange={setShowCategories}
            >
              <div className="grid grid-cols-1 gap-x-10 gap-y-3 sm:grid-cols-2">
                {categories.map(({ key, label, value, setter }) => (
                  <div key={key} className="flex items-center justify-between gap-3">
                    <span className="text-[13px] text-muted-foreground">{label}</span>
                    <StarInput label={`${label} rating`} value={value} onChange={setter} step={1} size={18} />
                  </div>
                ))}
              </div>
            </Disclosure>

            <Disclosure
              id="log-details"
              title="More details"
              summary={detailCount > 0 ? `${detailCount} ${detailCount === 1 ? "detail" : "details"} added` : "Optional"}
              open={showMoreDetails}
              onOpenChange={setShowMoreDetails}
            >
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {details.map(({ key, label, value, setter, options }) => (
                  <Field key={key} label={label} htmlFor={`log-${key}`}>
                    <Select id={`log-${key}`} value={value} onChange={(e) => setter(e.target.value)}>
                      <option value="">Not set</option>
                      {options.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ))}
              </div>
            </Disclosure>
          </div>

          {error && (
            <Notice tone="error" title={error.title}>
              {error.message}
            </Notice>
          )}

          <div className="flex flex-wrap gap-2.5">
            <Button type="submit" size="lg" disabled={isSaving}>
              <Check aria-hidden="true" />
              {savingIntent === "done" ? "Saving…" : isEditMode ? "Save changes" : "Save to library"}
            </Button>
            {!isEditMode && (
              <Button variant="outline" size="lg" disabled={isSaving} onClick={() => void save("another")}>
                {savingIntent === "another" ? "Saving…" : "Save and log another"}
              </Button>
            )}
            <Button
              variant="ghost"
              size="lg"
              disabled={isSaving}
              onClick={() => (isEditMode ? router.back() : router.push("/protected"))}
            >
              Cancel
            </Button>
          </div>
        </form>

        {/* Preview: the page's one feature object. Sticky beside the form on wide
            screens; below it, and only once something is chosen, on small ones. */}
        <aside
          aria-label="Preview"
          className={cn(
            "w-full lg:sticky lg:top-20",
            isSelectedMusic ? "max-w-[260px]" : "max-w-[240px]",
            !selectedMovie && "hidden lg:block",
          )}
        >
          <div className="frame frame-accent frame-raised ticks">
            {selectedMovie ? (
              <>
                <div
                  className={cn(
                    "relative overflow-hidden bg-surface-2",
                    isSelectedMusic ? "aspect-square" : "aspect-[2/3]",
                  )}
                >
                  {selectedMovie.poster_url ? (
                     
                    <img
                      src={resizePoster(selectedMovie.poster_url, "w780") ?? selectedMovie.poster_url}
                      alt=""
                      className="artwork-live h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <ArtIcon className="size-12 text-dim" aria-hidden="true" />
                    </div>
                  )}
                </div>

                <div className="p-4">
                  <h2 className="t-card line-clamp-3">{labelOf(selectedMovie)}</h2>
                  {selectedMovie.artist && (
                    <p className="mt-1 truncate text-[13px] text-primary">{selectedMovie.artist}</p>
                  )}
                  <p className="t-label mt-2">
                    {[yearOf(selectedMovie), meta.label].filter(Boolean).join(" · ")}
                  </p>
                  {selectedMovie.overview && (
                    <p className="t-meta mt-3 line-clamp-5">{selectedMovie.overview}</p>
                  )}
                </div>

                {rating > 0 && (
                  <div className="border-t border-border p-4">
                    <p className="t-label mb-2">Your rating</p>
                    <Stars value={rating} size={16} showValue />
                  </div>
                )}
              </>
            ) : (
              <div className="flex min-h-[280px] flex-col items-center justify-center p-8 text-center">
                <div className="well mb-4 flex h-14 w-14 items-center justify-center">
                  <ArtIcon className="size-6 text-dim" aria-hidden="true" />
                </div>
                <p className="t-label mb-1">Preview</p>
                <p className="text-[13px] text-muted-foreground">Choose a title to see its artwork here.</p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
