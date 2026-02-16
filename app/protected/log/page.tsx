"use client";

import { useState } from "react";
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
  Check
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type MediaType = "movie" | "tv";

export default function LogWatchPage() {
  const router = useRouter();
  const [mediaType, setMediaType] = useState<MediaType>("movie");
  const [title, setTitle] = useState("");
  const [year, setYear] = useState("");
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [review, setReview] = useState("");
  const [watchedDate, setWatchedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      // TODO: Save to Supabase database
      console.log({
        title,
        mediaType,
        year,
        rating,
        review,
        watchedDate,
      });

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Redirect to library
      router.push("/protected/library");
    } catch (err) {
      setError("Failed to save. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

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
        <h1 className="text-3xl md:text-4xl font-bold mb-2">Log a Watch</h1>
        <p className="text-muted-foreground">
          Add a movie or TV show you've watched to your library
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-card/50 backdrop-blur rounded-2xl border border-border/50 p-6 md:p-8 space-y-6">
        {/* Media Type Selection */}
        <div>
          <Label className="text-base mb-3 block">What did you watch?</Label>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setMediaType("movie")}
              className={`p-6 rounded-xl border-2 transition-all duration-200 ${
                mediaType === "movie"
                  ? "border-primary bg-primary/10 shadow-lg shadow-primary/20"
                  : "border-border/50 hover:border-border bg-card/30"
              }`}
            >
              <Film className={`w-8 h-8 mx-auto mb-2 ${mediaType === "movie" ? "text-primary" : "text-muted-foreground"}`} />
              <span className={`font-medium ${mediaType === "movie" ? "text-primary" : "text-foreground"}`}>
                Movie
              </span>
            </button>
            <button
              type="button"
              onClick={() => setMediaType("tv")}
              className={`p-6 rounded-xl border-2 transition-all duration-200 ${
                mediaType === "tv"
                  ? "border-primary bg-primary/10 shadow-lg shadow-primary/20"
                  : "border-border/50 hover:border-border bg-card/30"
              }`}
            >
              <Tv className={`w-8 h-8 mx-auto mb-2 ${mediaType === "tv" ? "text-primary" : "text-muted-foreground"}`} />
              <span className={`font-medium ${mediaType === "tv" ? "text-primary" : "text-foreground"}`}>
                TV Show
              </span>
            </button>
          </div>
        </div>

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
              placeholder={`Enter ${mediaType === "movie" ? "movie" : "TV show"} title...`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="pl-10 bg-card border-border/50"
              required
            />
          </div>
        </div>

        {/* Year */}
        <div className="space-y-2">
          <Label htmlFor="year" className="text-base">Year (Optional)</Label>
          <Input
            id="year"
            type="number"
            placeholder="2024"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="bg-card border-border/50"
            min="1900"
            max={new Date().getFullYear()}
          />
        </div>

        {/* Rating */}
        <div className="space-y-3">
          <Label className="text-base">
            Your Rating <span className="text-destructive">*</span>
          </Label>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRating(value)}
                onMouseEnter={() => setHoverRating(value)}
                onMouseLeave={() => setHoverRating(0)}
                className="group relative"
              >
                <Star
                  className={`w-8 h-8 transition-all duration-200 ${
                    value <= (hoverRating || rating)
                      ? "text-accent fill-accent scale-110"
                      : "text-muted-foreground/30 hover:text-muted-foreground/50"
                  }`}
                />
                <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                  {value}
                </span>
              </button>
            ))}
          </div>
          {rating > 0 && (
            <p className="text-sm text-muted-foreground">
              You rated this {rating}/10
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
            className="bg-card border-border/50"
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
            className="w-full min-h-32 px-3 py-2 bg-card border border-border/50 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <p className="text-xs text-muted-foreground">
            {review.length} characters
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        {/* Submit Buttons */}
        <div className="flex gap-3 pt-4">
          <Button
            type="submit"
            disabled={isLoading}
            className="flex-1 bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-lg shadow-primary/25"
          >
            {isLoading ? (
              "Saving..."
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Save to Library
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/protected")}
            disabled={isLoading}
            className="border-border/50"
          >
            Cancel
          </Button>
        </div>
      </form>

      {/* Tips */}
      <div className="bg-card/30 rounded-xl border border-border/50 p-4">
        <p className="text-sm text-muted-foreground">
          💡 <strong>Tip:</strong> Your ratings and reviews help us provide better recommendations for you!
        </p>
      </div>
    </div>
  );
}
