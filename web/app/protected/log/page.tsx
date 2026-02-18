"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
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
  ChevronUp
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type MediaType = "movie" | "tv";

type TmdbResult = {
  id: number;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string;
  poster_url?: string | null;
  overview?: string;
};

export default function LogWatchPage() {
  const router = useRouter();
  const [mediaType, setMediaType] = useState<MediaType | null>(null);
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

      const { error: insertError } = await supabase.from("watch_logs").insert({
        user_id: user.id,
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
      });

      if (insertError) {
        throw insertError;
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

      router.push("/protected/library");
    } catch (err) {
      setError("Failed to save. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const q = title.trim();
    if (!q) {
      setResults([]);
      setSelectedMovie(null);
      return;
    }

    const t = setTimeout(async () => {
      try {
        setIsSearching(true);
        const res = await fetch(`/api?q=${encodeURIComponent(q)}&type=${mediaType}`);
        const data = await res.json();
        setResults(Array.isArray(data) ? data : []);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => clearTimeout(t);
  }, [title, mediaType]);

  return (
    <div className="flex flex-col gap-8 max-w-3xl mx-auto w-full">
      {/* Header */}
      <div>
        <Link 
          href="/protected"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
        <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">Log a Watch</h1>
        <p className="text-muted-foreground">
          Add a movie or TV show you've watched to your library
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="border-2 border-border p-6 md:p-8 space-y-6">
        {/* Media Type Selection */}
        <div>
          <Label className="text-base mb-3 block">What did you watch?</Label>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => { setMediaType("movie"); setTitle(""); setSelectedMovie(null); setResults([]); }}
              className={`p-6 border-2 transition-all duration-200 ${
                mediaType === "movie"
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/50 bg-card"
              }`}
            >
              <Film className={`w-8 h-8 mx-auto mb-2 ${mediaType === "movie" ? "text-primary" : "text-muted-foreground"}`} />
              <span className={`font-medium ${mediaType === "movie" ? "text-primary" : "text-foreground"}`}>
                Movie
              </span>
            </button>
            <button
              type="button"
              onClick={() => { setMediaType("tv"); setTitle(""); setSelectedMovie(null); setResults([]); }}
              className={`p-6 border-2 transition-all duration-200 ${
                mediaType === "tv"
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/50 bg-card"
              }`}
            >
              <Tv className={`w-8 h-8 mx-auto mb-2 ${mediaType === "tv" ? "text-primary" : "text-muted-foreground"}`} />
              <span className={`font-medium ${mediaType === "tv" ? "text-primary" : "text-foreground"}`}>
                TV Show
              </span>
            </button>
          </div>
        </div>

        {mediaType && (<>
        {/* Title */}
        <div className="space-y-2">
          <Label htmlFor="title" className="text-base">
            Title <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="title"
              type="text"
              placeholder={`Search for a ${mediaType === "movie" ? "movie" : "TV show"}...`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="pl-10 bg-card border-2 border-border"
              required
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                Searching...
              </div>
            )}
          </div>

          {results.length > 0 && (
            <div className="border-2 border-border bg-card mt-2 max-h-64 overflow-auto">
              {results.slice(0, 8).map((r: any) => {
                const label = r.title || r.name || "Untitled";
                const yearLabel = (r.release_date || r.first_air_date || "").slice(0, 4);
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      setTitle(label);
                      setSelectedMovie(r);
                      setResults([]);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-muted flex gap-3 items-center"
                  >
                    {r.poster_url && (
                      <img
                        src={r.poster_url}
                        alt={label}
                        className="w-8 h-12 object-cover rounded"
                      />
                    )}
                    <div>
                      <div className="font-medium">{label}</div>
                      {yearLabel && (
                        <div className="text-xs text-muted-foreground">{yearLabel}</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {selectedMovie && (
            <div className="border-2 border-primary bg-primary/5 p-4 mt-4 rounded-lg space-y-3">
              <div className="flex gap-4">
                {selectedMovie.poster_url && (
                  <img
                    src={selectedMovie.poster_url}
                    alt={selectedMovie.title || selectedMovie.name}
                    className="w-16 h-24 object-cover rounded"
                  />
                )}
                <div className="flex-1">
                  <h3 className="font-bold text-lg">{selectedMovie.title || selectedMovie.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {(selectedMovie.release_date || selectedMovie.first_air_date || "").slice(0, 4)}
                  </p>
                  {selectedMovie.overview && (
                    <p className="text-sm mt-2 line-clamp-3">{selectedMovie.overview}</p>
                  )}
                </div>
              </div>
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

        {/* Date Watched */}
        <div className="space-y-2">
          <Label htmlFor="watchedDate" className="text-base flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Date Watched
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

        {/* Category Ratings */}
        <div className="space-y-4">
          <Label className="text-base block">Rate by Category (Optional)</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
            {([
              { key: "plot", label: "Plot", value: plotRating, setter: setPlotRating },
              { key: "cinematography", label: "Cinematography", value: cinematographyRating, setter: setCinematographyRating },
              { key: "acting", label: "Acting", value: actingRating, setter: setActingRating },
              { key: "soundtrack", label: "Soundtrack", value: soundtrackRating, setter: setSoundtrackRating },
              { key: "pacing", label: "Pacing", value: pacingRating, setter: setPacingRating },
              { key: "casting", label: "Casting", value: castingRating, setter: setCastingRating },
            ] as const).map(({ key, label, value, setter }) => (
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
                            isActive
                              ? "text-accent fill-accent"
                              : "text-muted-foreground/30"
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
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 border-2 border-destructive bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        {/* Submit Buttons */}
        <div className="flex gap-3 pt-4">
          <Button
            type="submit"
            disabled={isLoading}
            className="group flex-1 bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-lg shadow-primary/25"
          >
            {isLoading ? (
              "Saving..."
            ) : (
              <>
                <Check className="w-4 h-4 mr-2 transition-transform group-hover:scale-110" />
                Save to Library
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/protected")}
            disabled={isLoading}
            className="border-2"
          >
            Cancel
          </Button>
        </div>
        </>)}
      </form>

      {/* Tips */}
      <div className="border-2 border-border p-4">
        <p className="text-sm text-muted-foreground">
          💡 <strong>Tip:</strong> Your ratings and reviews help us provide better recommendations for you!
        </p>
      </div>
    </div>
  );
}
