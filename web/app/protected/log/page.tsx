"use client";

import { useState, useEffect, Suspense } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Film,
  Tv,
  Search,
  Star,
  Calendar,
  FileText,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Disc3,
  Music2,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useMode } from "@/lib/mode-context";

type MediaType = "movie" | "tv" | "album" | "track";

type TmdbResult = {
  id: number;
  spotify_id?: string;
  artist?: string;
  album_name?: string;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string;
  poster_url?: string | null;
  overview?: string;
};

export default function LogWatchPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="w-8 h-8 animate-spin border-2 border-primary border-t-transparent rounded-full" /></div>}>
      <LogWatchForm />
    </Suspense>
  );
}

function LogWatchForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { mode } = useMode();
  const editId = searchParams.get("edit");
  const isEditMode = !!editId;
  const [editLoading, setEditLoading] = useState(!!editId);
  // Pre-select based on current mode (music → album, film → movie)
  // In edit mode this will be overwritten by loadExisting()
  const [mediaType, setMediaType] = useState<MediaType | null>(
    isEditMode ? null : mode === "music" ? "album" : "movie"
  );
  const [title, setTitle] = useState("");
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [review, setReview] = useState("");
  const [watchedDate, setWatchedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<TmdbResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState<TmdbResult | null>(null);
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
  const [hoverCategory, setHoverCategory] = useState<{ [key: string]: number }>({});
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (!title.trim()) {
      setError("Please enter a title");
      setIsLoading(false);
      return;
    }

    if (rating === 0) {
      setError("Please select a rating");
      setIsLoading(false);
      return;
    }

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setError("You must be logged in to save.");
        setIsLoading(false);
        return;
      }

      const isMusic = mediaType === "album" || mediaType === "track";

      if (isMusic) {
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
        if (isEditMode && editId) {
          const { error: updateError } = await supabase
            .from("listen_logs")
            .update(musicData)
            .eq("id", editId);
          if (updateError) throw updateError;
        } else {
          const { error: insertError } = await supabase
            .from("listen_logs")
            .insert({ user_id: user.id, ...musicData });
          if (insertError) throw insertError;
        }
      } else {
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
        if (isEditMode && editId) {
          const { error: updateError } = await supabase
            .from("watch_logs")
            .update(logData)
            .eq("id", editId);
          if (updateError) throw updateError;
        } else {
          const { error: insertError } = await supabase
            .from("watch_logs")
            .insert({ user_id: user.id, ...logData });
          if (insertError) throw insertError;
        }
      }

      // Reset form
      setMediaType(null);
      setTitle("");
      setRating(0);
      setHoverRating(0);
      setReview("");
      setWatchedDate(new Date().toISOString().split('T')[0]);
      setSelectedMovie(null);
      setResults([]);
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
      setSpotifyId(null);
      setArtist("");
      setAlbumName("");
      setLyricsRating(0);
      setProductionRating(0);
      setVocalsRating(0);
      setMelodyRating(0);
      setReplayRating(0);
      setEnergyRating(0);
      setListenedOn("");
      setListeningContext("");

      router.push("/protected/library");
    } catch (err) {
      setError("Failed to save. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isEditMode && selectedMovie) return;
    const q = title.trim();
    if (!q) {
      setResults([]);
      setSelectedMovie(null);
      return;
    }

    const t = setTimeout(async () => {
      try {
        setIsSearching(true);
        const isMusic = mediaType === "album" || mediaType === "track";
        let data: TmdbResult[];
        if (isMusic) {
          const res = await fetch(`/api/spotify?action=search&q=${encodeURIComponent(q)}&type=${mediaType}`);
          const raw = await res.json();
          data = Array.isArray(raw)
            ? raw.map((r: any, idx: number) => ({
                id: idx + 1,
                spotify_id: r.id,
                name: r.name,
                artist: r.artist,
                album_name: r.album_name,
                poster_url: r.image_url,
                release_date: r.release_date,
              }))
            : [];
        } else {
          const res = await fetch(`/api?action=search&q=${encodeURIComponent(q)}`);
          const raw = await res.json();
          data = Array.isArray(raw) ? raw : [];
        }
        setResults(data);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => clearTimeout(t);
  }, [title, mediaType]);

  // Load existing log for edit mode (watch_logs for film, listen_logs for music)
  useEffect(() => {
    if (!editId) return;
    async function loadExisting() {
      try {
        const supabase = createClient();
        // Try watch_logs first
        const { data: filmData } = await supabase
          .from("watch_logs")
          .select("*")
          .eq("id", editId)
          .single();

        if (filmData) {
          setMediaType(filmData.media_type);
          setTitle(filmData.title);
          setRating(filmData.rating);
          setReview(filmData.review || "");
          setWatchedDate(filmData.watched_date || new Date().toISOString().split('T')[0]);
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
            setSelectedMovie({ id: filmData.tmdb_id, title: filmData.title, poster_url: filmData.poster_url } as TmdbResult);
          }
          if (filmData.watched_on || filmData.watch_duration || filmData.discovered_via ||
              filmData.rewatchability || filmData.watched_with || filmData.times_watched) {
            setShowMoreDetails(true);
          }
        } else {
          // Try listen_logs (music)
          const { data: musicData } = await supabase
            .from("listen_logs")
            .select("*")
            .eq("id", editId)
            .single();
          if (musicData) {
            setMediaType(musicData.media_type);
            setTitle(musicData.title);
            setRating(musicData.rating);
            setReview(musicData.review || "");
            setWatchedDate(musicData.listened_date || new Date().toISOString().split('T')[0]);
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
                spotify_id: musicData.spotify_id,
                name: musicData.title,
                artist: musicData.artist,
                poster_url: musicData.image_url,
                release_date: musicData.release_date,
              } as TmdbResult);
            }
            if (musicData.listened_on || musicData.listening_context) {
              setShowMoreDetails(true);
            }
          }
        }
      } catch {
        // silently fail
      } finally {
        setEditLoading(false);
      }
    }
    loadExisting();
  }, [editId]);

  if (editLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 animate-spin border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // Mode-specific type options (2 per mode, not 4)
  const typeOptions: { type: MediaType; icon: typeof Film; label: string }[] =
    mode === "music"
      ? [
          { type: "album", icon: Disc3, label: "Album" },
          { type: "track", icon: Music2, label: "Track" },
        ]
      : [
          { type: "movie", icon: Film, label: "Movie" },
          { type: "tv", icon: Tv, label: "TV Show" },
        ];

  // Determine if we're showing portrait (film) or square (music) art
  const isSelectedMusic = mediaType === "album" || mediaType === "track";

  return (
    <div className="flex flex-col gap-8 max-w-5xl mx-auto w-full">
      {/* ── Header ── */}
      <div>
        <Link
          href={isEditMode ? "/protected/library" : "/protected"}
          className="inline-flex items-center gap-2 mb-5 transition-colors duration-150"
          style={{ color: "var(--text-muted)", fontSize: "12px", letterSpacing: "0.06em", textTransform: "uppercase" }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--text)"}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {isEditMode ? "Back to Library" : "Back to Dashboard"}
        </Link>

        <div className="flex items-baseline gap-4 mb-2">
          <p
            className="label-upper"
            style={{ color: "var(--mode-accent)" }}
          >
            {isEditMode ? "Edit Entry" : mode === "music" ? "Music" : "Film"}
          </p>
        </div>
        <h1
          className="font-display"
          style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 600, lineHeight: 1.1, color: "var(--text)" }}
        >
          {isEditMode ? "Edit Log Entry" : mode === "music" ? "Log a Listen" : "Log a Watch"}
        </h1>
      </div>

      {/* ── Two-column layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-8 items-start">

        {/* ── LEFT: Form ── */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">

          {/* Type selector — 2 options per mode, compact pill row */}
          <div>
            <p className="label-upper mb-3">
              {isEditMode ? "Type" : mode === "music" ? "What did you listen to?" : "What did you watch?"}
            </p>
            {isEditMode ? (
              <div
                className="inline-flex items-center gap-2 px-4 py-2.5"
                style={{ background: "var(--mode-accent-dim)", border: `1px solid var(--mode-accent)`, color: "var(--mode-accent)" }}
              >
                {mediaType === "movie" ? <Film className="w-4 h-4" />
                  : mediaType === "tv" ? <Tv className="w-4 h-4" />
                  : mediaType === "album" ? <Disc3 className="w-4 h-4" />
                  : <Music2 className="w-4 h-4" />}
                <span className="text-[12px] font-medium tracking-wide uppercase">
                  {mediaType === "movie" ? "Movie" : mediaType === "tv" ? "TV Show" : mediaType === "album" ? "Album" : "Track"}
                </span>
              </div>
            ) : (
              <div
                className="inline-flex p-[3px] gap-[3px]"
                style={{ background: "var(--surface)", border: "1px solid var(--border-raw)" }}
              >
                {typeOptions.map(({ type, icon: Icon, label }) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setMediaType(type);
                      setTitle("");
                      setSelectedMovie(null);
                      setResults([]);
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 transition-all duration-200"
                    style={
                      mediaType === type
                        ? { background: "var(--mode-accent-dim)", color: "var(--mode-accent)", border: "1px solid var(--mode-accent)" }
                        : { background: "transparent", color: "var(--text-muted)", border: "1px solid transparent" }
                    }
                    onMouseEnter={e => {
                      if (mediaType !== type) (e.currentTarget as HTMLElement).style.color = "var(--text)";
                    }}
                    onMouseLeave={e => {
                      if (mediaType !== type) (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
                    }}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-[11px] font-medium tracking-[0.08em] uppercase">{label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

        {mediaType && (<>
        {/* ── Search ── */}
        <div className="flex flex-col gap-2">
          <p className="label-upper">
            Title <span style={{ color: "hsl(var(--destructive))" }}>*</span>
          </p>
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
              style={{ color: "var(--text-muted)" }}
            />
            <Input
              id="title"
              type="text"
              placeholder={`Search ${mediaType === "movie" ? "movies" : mediaType === "tv" ? "TV shows" : mediaType === "album" ? "albums" : "tracks"}…`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="pl-10 bg-card border border-border"
              style={{ fontFamily: "var(--font-mono)", fontSize: "13px" }}
              required
            />
            {isSearching && (
              <span
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] tracking-wider"
                style={{ color: "var(--text-muted)" }}
              >
                searching…
              </span>
            )}
          </div>

          {/* Search results dropdown */}
          {results.length > 0 && (
            <div
              className="mt-1 max-h-64 overflow-auto"
              style={{ background: "var(--surface)", border: "1px solid var(--border-raw)" }}
            >
              {results.slice(0, 8).map((r: any, idx: number) => {
                const lbl = r.title || r.name || "Untitled";
                const yr = (r.release_date || r.first_air_date || "").slice(0, 4);
                const isFilmResult = mediaType === "movie" || mediaType === "tv";
                const isMusicResult = !isFilmResult;
                return (
                  <button
                    key={r.spotify_id || r.id || idx}
                    type="button"
                    onClick={() => {
                      setTitle(lbl);
                      setSelectedMovie(r);
                      setResults([]);
                      if (isMusicResult) {
                        setSpotifyId(r.spotify_id || null);
                        setArtist(r.artist || "");
                        setAlbumName(r.album_name || "");
                      }
                    }}
                    className="w-full text-left flex gap-3 items-center transition-colors duration-100"
                    style={{ padding: "10px 14px", borderBottom: "1px solid var(--border-raw)", color: "var(--text)" }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--surface-2)"}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
                  >
                    {r.poster_url && (
                      <div
                        className="flex-shrink-0 overflow-hidden"
                        style={{ width: isFilmResult ? 26 : 32, height: isFilmResult ? 38 : 32, background: "var(--surface-2)", position: "relative" }}
                      >
                        <img
                          src={r.poster_url.replace(/\/w\d+\//, "/w342/")}
                          alt={lbl}
                          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-display text-[14px] font-semibold truncate">{lbl}</div>
                      {isMusicResult && r.artist && (
                        <div className="text-[11px]" style={{ color: "var(--mode-accent)" }}>{r.artist}</div>
                      )}
                      {yr && <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>{yr}</div>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Selected item indicator (compact — full art shown in preview panel) */}
          {selectedMovie && (
            <div
              className="flex items-center gap-3 p-3 mt-1"
              style={{ background: "var(--mode-accent-dim)", border: "1px solid var(--mode-accent)" }}
            >
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: "var(--mode-accent)" }} />
              <div className="flex-1 min-w-0">
                <span className="font-display text-[14px] font-semibold block truncate" style={{ color: "var(--text)" }}>
                  {selectedMovie.title || selectedMovie.name}
                </span>
                {selectedMovie.artist && (
                  <span className="text-[11px] block truncate" style={{ color: "var(--mode-accent)" }}>
                    {selectedMovie.artist}
                  </span>
                )}
              </div>
              {(selectedMovie.release_date || selectedMovie.first_air_date) && (
                <span className="text-[11px] flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                  {(selectedMovie.release_date || selectedMovie.first_air_date || "").slice(0, 4)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Rating */}
        <div className="space-y-3">
          <Label className="text-base">
            Your Rating <span className="text-destructive">*</span>
          </Label>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((value) => {
              const isActive = (hoverRating || rating) >= value;
              const isHalfActive = (hoverRating || rating) >= value - 0.5 && (hoverRating || rating) < value;

              return (
                <div key={value} className="relative flex">
                  {/* Left half (for .5 rating) */}
                  <button
                    type="button"
                    onClick={() => setRating(value - 0.5)}
                    onMouseEnter={() => setHoverRating(value - 0.5)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="relative w-5 h-10 flex items-center justify-start overflow-hidden"
                  >
                    <Star
                      className={`absolute left-0 w-10 h-10 transition-colors duration-200 ${
                        isActive || isHalfActive
                          ? "text-accent fill-accent"
                          : "text-muted-foreground/30"
                      }`}
                      style={isHalfActive ? { clipPath: 'inset(0 50% 0 0)' } : undefined}
                    />
                    {!isActive && !isHalfActive && (
                      <Star
                        className="absolute left-0 w-10 h-10 text-transparent stroke-muted-foreground/30"
                        style={{ clipPath: 'inset(0 50% 0 0)', fill: 'none', strokeWidth: '1.5' }}
                      />
                    )}
                  </button>

                  {/* Right half (for full rating) */}
                  <button
                    type="button"
                    onClick={() => setRating(value)}
                    onMouseEnter={() => setHoverRating(value)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="relative w-5 h-10 flex items-center justify-end overflow-hidden"
                  >
                    <Star
                      className={`absolute right-0 w-10 h-10 transition-colors duration-200 ${
                        isActive
                          ? "text-accent fill-accent"
                          : "text-muted-foreground/30"
                      }`}
                      style={{ clipPath: 'inset(0 0 0 50%)' }}
                    />
                    {!isActive && (
                      <Star
                        className="absolute right-0 w-10 h-10 text-transparent stroke-muted-foreground/30"
                        style={{ clipPath: 'inset(0 0 0 50%)', fill: 'none', strokeWidth: '1.5' }}
                      />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
          {rating > 0 && (
            <p className="text-sm font-semibold text-accent">
              You rate {rating}/5
            </p>
          )}
        </div>

        {/* Date Watched / Listened */}
        <div className="space-y-2">
          <Label htmlFor="watchedDate" className="text-base flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            {isSelectedMusic ? "Date Listened" : "Date Watched"}
          </Label>
          <Input
            id="watchedDate"
            type="date"
            value={watchedDate}
            onChange={(e) => setWatchedDate(e.target.value)}
            className="bg-card border-2 border-border"
            max={new Date().toISOString().split('T')[0]}
          />
        </div>

        {/* Review */}
        <div className="space-y-2">
          <Label htmlFor="review" className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Your Review (Optional)
          </Label>
          <textarea
            id="review"
            placeholder="What did you think? Share your thoughts..."
            value={review}
            onChange={(e) => setReview(e.target.value)}
            className="w-full min-h-32 px-3 py-2 bg-card border-2 border-border resize-none focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <p className="text-xs text-muted-foreground">
            {review.length} characters
          </p>
        </div>

        {/* Category Ratings — mode-aware */}
        <div className="space-y-4">
          <Label className="text-base block">Rate by Category (Optional)</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
            {(isSelectedMusic ? [
              { key: "lyrics", label: "Lyrics", value: lyricsRating, setter: setLyricsRating },
              { key: "production", label: "Production", value: productionRating, setter: setProductionRating },
              { key: "vocals", label: "Vocals", value: vocalsRating, setter: setVocalsRating },
              { key: "melody", label: "Melody", value: melodyRating, setter: setMelodyRating },
              { key: "replay", label: "Replay Value", value: replayRating, setter: setReplayRating },
              { key: "energy", label: "Energy", value: energyRating, setter: setEnergyRating },
            ] : [
              { key: "plot", label: "Plot", value: plotRating, setter: setPlotRating },
              { key: "cinematography", label: "Cinematography", value: cinematographyRating, setter: setCinematographyRating },
              { key: "acting", label: "Acting", value: actingRating, setter: setActingRating },
              { key: "soundtrack", label: "Soundtrack", value: soundtrackRating, setter: setSoundtrackRating },
              { key: "pacing", label: "Pacing", value: pacingRating, setter: setPacingRating },
              { key: "casting", label: "Casting", value: castingRating, setter: setCastingRating },
            ] as { key: string; label: string; value: number; setter: (v: number) => void }[]).map(({ key, label, value, setter }) => (
              <div key={key} className="flex items-center justify-between gap-3">
                <Label className="text-sm text-muted-foreground w-28 shrink-0">{label}</Label>
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const hoverVal = hoverCategory[key] || 0;
                    const isActive = (hoverVal || value) >= star;
                    return (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setter(value === star ? 0 : star)}
                        onMouseEnter={() => setHoverCategory((prev) => ({ ...prev, [key]: star }))}
                        onMouseLeave={() => setHoverCategory((prev) => ({ ...prev, [key]: 0 }))}
                        className="p-0.5"
                      >
                        <Star
                          className={`w-5 h-5 transition-colors duration-150 ${
                            isActive ? "text-accent fill-accent" : "text-muted-foreground/30"
                          }`}
                        />
                      </button>
                    );
                  })}
                  {value > 0 && (
                    <span className="text-xs text-muted-foreground ml-2 w-3">{value}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* More Details (Optional) */}
        <div>
          <button
            type="button"
            onClick={() => setShowMoreDetails(!showMoreDetails)}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {showMoreDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            More Details (Optional)
          </button>

          {showMoreDetails && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {isSelectedMusic ? (<>
                <div className="space-y-2">
                  <Label className="text-sm">Where did you listen?</Label>
                  <select
                    value={listenedOn}
                    onChange={(e) => setListenedOn(e.target.value)}
                    className="w-full px-3 py-2 bg-card border-2 border-border focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Select...</option>
                    <option value="Spotify">Spotify</option>
                    <option value="Apple Music">Apple Music</option>
                    <option value="YouTube Music">YouTube Music</option>
                    <option value="SoundCloud">SoundCloud</option>
                    <option value="Vinyl">Vinyl</option>
                    <option value="CD">CD</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">What was the context?</Label>
                  <select
                    value={listeningContext}
                    onChange={(e) => setListeningContext(e.target.value)}
                    className="w-full px-3 py-2 bg-card border-2 border-border focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Select...</option>
                    <option value="Chill">Chill</option>
                    <option value="Workout">Workout</option>
                    <option value="Study">Study</option>
                    <option value="Commute">Commute</option>
                    <option value="Party">Party</option>
                    <option value="Sleep">Sleep</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </>) : (<>
                <div className="space-y-2">
                  <Label className="text-sm">Where did you watch?</Label>
                  <select
                    value={watchedOn}
                    onChange={(e) => setWatchedOn(e.target.value)}
                    className="w-full px-3 py-2 bg-card border-2 border-border focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Select...</option>
                    <option value="Netflix">Netflix</option>
                    <option value="Disney+">Disney+</option>
                    <option value="Prime Video">Prime Video</option>
                    <option value="Hulu">Hulu</option>
                    <option value="HBO Max">HBO Max</option>
                    <option value="Apple TV+">Apple TV+</option>
                    <option value="Paramount+">Paramount+</option>
                    <option value="Peacock">Peacock</option>
                    <option value="Streaming Site">Streaming Site</option>
                    <option value="Cinema">Cinema</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">How long did it take to finish?</Label>
                  <select
                    value={watchDuration}
                    onChange={(e) => setWatchDuration(e.target.value)}
                    className="w-full px-3 py-2 bg-card border-2 border-border focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Select...</option>
                    <option value="One sitting">One sitting</option>
                    <option value="A few days">A few days</option>
                    <option value="About a week">About a week</option>
                    <option value="A few weeks">A few weeks</option>
                    <option value="Over a month">Over a month</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">How did you discover this?</Label>
                  <select
                    value={discoveredVia}
                    onChange={(e) => setDiscoveredVia(e.target.value)}
                    className="w-full px-3 py-2 bg-card border-2 border-border focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Select...</option>
                    <option value="Friend/Family">Friend/Family</option>
                    <option value="Social Media">Social Media</option>
                    <option value="Streaming Recommendation">Streaming Recommendation</option>
                    <option value="Trailer">Trailer</option>
                    <option value="Review/Article">Review/Article</option>
                    <option value="Just Browsing">TrackEfron</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Would you rewatch?</Label>
                  <select
                    value={rewatchability}
                    onChange={(e) => setRewatchability(e.target.value)}
                    className="w-full px-3 py-2 bg-card border-2 border-border focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Select...</option>
                    <option value="Definitely">Definitely</option>
                    <option value="Probably">Probably</option>
                    <option value="Maybe">Maybe</option>
                    <option value="Unlikely">Unlikely</option>
                    <option value="No way">No way</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Who did you watch with?</Label>
                  <select
                    value={watchedWith}
                    onChange={(e) => setWatchedWith(e.target.value)}
                    className="w-full px-3 py-2 bg-card border-2 border-border focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Select...</option>
                    <option value="Solo">Solo</option>
                    <option value="Partner">Partner</option>
                    <option value="Friends">Friends</option>
                    <option value="Family">Family</option>
                    <option value="Group">Group</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">How many times have you watched this?</Label>
                  <select
                    value={timesWatched}
                    onChange={(e) => setTimesWatched(e.target.value)}
                    className="w-full px-3 py-2 bg-card border-2 border-border focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Select...</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4</option>
                    <option value="5">5</option>
                    <option value="6+">6+</option>
                  </select>
                </div>
              </>)}
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 border-2 border-destructive bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        {/* ── Submit ── */}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={isLoading}
            className="flex items-center justify-center gap-2 flex-1 px-5 py-3 text-[11px] font-medium tracking-[0.08em] uppercase transition-all hover:opacity-85 disabled:opacity-50"
            style={{ background: "var(--mode-accent)", color: "var(--bg)" }}
          >
            <Check className="w-4 h-4" />
            {isLoading ? "Saving…" : isEditMode ? "Save Changes" : "Save to Library"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/protected")}
            disabled={isLoading}
            className="px-5 py-3 text-[11px] font-medium tracking-[0.08em] uppercase transition-all"
            style={{ background: "transparent", border: "1px solid var(--border-raw)", color: "var(--text-muted)" }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.color = "var(--text)";
              (e.currentTarget as HTMLElement).style.borderColor = "var(--border-hover)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
              (e.currentTarget as HTMLElement).style.borderColor = "var(--border-raw)";
            }}
          >
            Cancel
          </button>
        </div>
        </>)}
        </form>

        {/* ── RIGHT: Sticky preview panel ── */}
        <div className="hidden lg:block">
          <div
            className="sticky"
            style={{ top: "80px" }}
          >
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border-raw)",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* Mode-accent top line */}
              <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "var(--mode-accent)" }} />

              {selectedMovie ? (
                <>
                  {/* Poster / cover art */}
                  <div
                    style={{
                      aspectRatio: isSelectedMusic ? "1 / 1" : "2 / 3",
                      background: "var(--surface-2)",
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    {selectedMovie.poster_url ? (
                      <img
                        src={selectedMovie.poster_url.replace(/\/w\d+\//, "/w780/")}
                        alt={selectedMovie.title || selectedMovie.name}
                        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {isSelectedMusic
                          ? <Disc3 className="w-12 h-12" style={{ color: "var(--text-dim)" }} />
                          : <Film className="w-12 h-12" style={{ color: "var(--text-dim)" }} />}
                      </div>
                    )}
                    <div
                      className="absolute inset-0"
                      style={{ background: "linear-gradient(to top, rgba(10,10,8,0.9) 0%, transparent 60%)" }}
                    />
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <h3
                        className="font-display font-semibold leading-tight mb-1"
                        style={{ fontSize: "18px", color: "var(--text)" }}
                      >
                        {selectedMovie.title || selectedMovie.name}
                      </h3>
                      {selectedMovie.artist && (
                        <p className="text-[12px] mb-1" style={{ color: "var(--mode-accent)" }}>{selectedMovie.artist}</p>
                      )}
                      <p className="label-upper">
                        {(selectedMovie.release_date || selectedMovie.first_air_date || "").slice(0, 4)}
                        {mediaType && ` · ${mediaType === "movie" ? "Movie" : mediaType === "tv" ? "TV Show" : mediaType === "album" ? "Album" : "Track"}`}
                      </p>
                    </div>
                  </div>

                  {/* Overview */}
                  {selectedMovie.overview && (
                    <div className="p-4">
                      <p
                        className="text-[11px] leading-relaxed line-clamp-5"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {selectedMovie.overview}
                      </p>
                    </div>
                  )}

                  {/* Current rating preview */}
                  {rating > 0 && (
                    <div
                      className="px-4 pb-4"
                      style={{ borderTop: "1px solid var(--border-raw)", paddingTop: "12px" }}
                    >
                      <p className="label-upper mb-2">Your rating</p>
                      <div className="flex items-center gap-2">
                        <span style={{ letterSpacing: "2px", fontSize: "18px" }}>
                          {Array.from({ length: 5 }, (_, i) => {
                            const pos = i + 1;
                            const filled = rating >= pos;
                            const half = !filled && rating >= pos - 0.5;
                            return (
                              <span
                                key={i}
                                style={{
                                  color: "var(--mode-accent)",
                                  opacity: filled ? 1 : half ? 0.55 : 0.2,
                                }}
                              >★</span>
                            );
                          })}
                        </span>
                        <span
                          className="font-display text-xl font-semibold"
                          style={{ color: "var(--mode-accent)" }}
                        >
                          {rating}/5
                        </span>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* Empty state */
                <div
                  className="flex flex-col items-center justify-center text-center p-8"
                  style={{ minHeight: 280 }}
                >
                  <div
                    className="w-14 h-14 flex items-center justify-center mb-4"
                    style={{ border: "1px solid var(--border-raw)", background: "var(--surface-2)" }}
                  >
                    {(mediaType === "album" || mediaType === "track")
                      ? <Disc3 className="w-6 h-6" style={{ color: "var(--text-dim)" }} />
                      : <Film className="w-6 h-6" style={{ color: "var(--text-dim)" }} />}
                  </div>
                  <p className="label-upper mb-1">Preview</p>
                  <p className="text-[12px]" style={{ color: "var(--text-dim)" }}>
                    Select a title to<br />preview artwork here
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>{/* end two-column grid */}
    </div>
  );
}
