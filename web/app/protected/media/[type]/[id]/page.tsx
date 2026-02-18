"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Star,
  Clock,
  Calendar,
  Tv,
  Film,
  Loader2,
  Users,
} from "lucide-react";

type Genre = { id: number; name: string };

type MediaDetail = {
  id: number;
  overview: string;
  poster_url: string | null;
  backdrop_url: string | null;
  genres: Genre[];
  vote_average: number;
  vote_count: number;
  tagline?: string;
  status: string;
  credits?: {
    cast: {
      id: number;
      name: string;
      character: string;
      profile_path: string | null;
    }[];
  };
  // Movie fields
  title?: string;
  release_date?: string;
  runtime?: number;
  // TV fields
  name?: string;
  first_air_date?: string;
  last_air_date?: string;
  number_of_seasons?: number;
  number_of_episodes?: number;
  episode_run_time?: number[];
  created_by?: { id: number; name: string }[];
  networks?: { id: number; name: string; logo_path: string | null }[];
};

export default function MediaDetailPage() {
  const params = useParams();
  const type = params.type as string;
  const id = params.id as string;

  const [detail, setDetail] = useState<MediaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (type !== "movie" && type !== "tv") {
      setError("Invalid media type");
      setLoading(false);
      return;
    }
    async function fetchDetail() {
      try {
        setLoading(true);
        const res = await fetch(`/api?action=detail&type=${type}&id=${id}`);
        if (!res.ok) throw new Error("Failed to fetch details");
        const data = await res.json();
        setDetail(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchDetail();
  }, [type, id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="flex flex-col gap-4 max-w-3xl mx-auto">
        <Link
          href="/protected/discover"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Discover
        </Link>
        <div className="border-2 border-destructive bg-destructive/10 p-6 text-destructive">
          {error || "Media not found"}
        </div>
      </div>
    );
  }

  const displayTitle = detail.title || detail.name || "Unknown";
  const year = (detail.release_date || detail.first_air_date || "").slice(0, 4);
  const isMovie = type === "movie";
  const runtime = isMovie
    ? detail.runtime
      ? `${detail.runtime} min`
      : null
    : detail.episode_run_time?.length
      ? `${detail.episode_run_time[0]} min/ep`
      : null;
  const topCast = detail.credits?.cast?.slice(0, 6) ?? [];

  return (
    <div className="flex flex-col gap-0 max-w-5xl mx-auto w-full">
      {/* Back button */}
      <div className="mb-6">
        <Link
          href="/protected/discover"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Discover
        </Link>
      </div>

      {/* Backdrop */}
      {detail.backdrop_url && (
        <div className="relative w-full h-48 md:h-72 overflow-hidden border-2 border-border mb-8">
          <img
            src={detail.backdrop_url}
            alt={displayTitle}
            className="w-full h-full object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        </div>
      )}

      {/* Main content grid */}
      <div className="grid md:grid-cols-[auto,1fr] gap-8">
        {/* Poster column */}
        <div className="flex flex-col gap-4">
          <div className="w-40 md:w-48 border-2 border-border overflow-hidden shrink-0">
            {detail.poster_url ? (
              <img
                src={detail.poster_url}
                alt={displayTitle}
                className="w-full object-cover"
              />
            ) : (
              <div className="aspect-[2/3] bg-muted flex items-center justify-center">
                {isMovie
                  ? <Film className="w-12 h-12 text-muted-foreground" />
                  : <Tv className="w-12 h-12 text-muted-foreground" />}
              </div>
            )}
          </div>
        </div>

        {/* Info column */}
        <div className="flex flex-col gap-6">
          {/* Title block */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-xs border-2">
                {isMovie ? "Movie" : "TV Show"}
              </Badge>
              {detail.status && (
                <Badge variant="secondary" className="text-xs">
                  {detail.status}
                </Badge>
              )}
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-bold mb-1">{displayTitle}</h1>
            {detail.tagline && (
              <p className="text-muted-foreground italic text-lg">&ldquo;{detail.tagline}&rdquo;</p>
            )}
          </div>

          {/* Key metadata row */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            {year && (
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                {year}
              </span>
            )}
            {runtime && (
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                {runtime}
              </span>
            )}
            {detail.vote_average > 0 && (
              <span className="flex items-center gap-1.5">
                <Star className="w-4 h-4 text-accent fill-accent" />
                <span className="font-semibold text-foreground">
                  {detail.vote_average.toFixed(1)}
                </span>
                <span>({detail.vote_count.toLocaleString()} votes)</span>
              </span>
            )}
            {!isMovie && detail.number_of_seasons != null && (
              <span className="flex items-center gap-1.5">
                <Tv className="w-4 h-4" />
                {detail.number_of_seasons} season{detail.number_of_seasons !== 1 ? "s" : ""}
                {detail.number_of_episodes != null &&
                  ` · ${detail.number_of_episodes} episodes`}
              </span>
            )}
          </div>

          {/* Genres */}
          {detail.genres?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {detail.genres.map((g) => (
                <Badge key={g.id} variant="outline" className="border-2">
                  {g.name}
                </Badge>
              ))}
            </div>
          )}

          {/* Overview */}
          {detail.overview && (
            <div className="border-2 border-border p-4 bg-muted/10">
              <h2 className="font-semibold mb-2">Overview</h2>
              <p className="text-muted-foreground leading-relaxed">{detail.overview}</p>
            </div>
          )}

          {/* TV-specific info */}
          {!isMovie && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              {detail.created_by?.length ? (
                <div>
                  <span className="font-semibold block mb-1">Created by</span>
                  <span className="text-muted-foreground">
                    {detail.created_by.map((c) => c.name).join(", ")}
                  </span>
                </div>
              ) : null}
              {detail.networks?.length ? (
                <div>
                  <span className="font-semibold block mb-1">Network</span>
                  <span className="text-muted-foreground">
                    {detail.networks.map((n) => n.name).join(", ")}
                  </span>
                </div>
              ) : null}
              {detail.last_air_date && (
                <div>
                  <span className="font-semibold block mb-1">Last aired</span>
                  <span className="text-muted-foreground">
                    {detail.last_air_date.slice(0, 4)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Cast */}
          {topCast.length > 0 && (
            <div>
              <h2 className="font-semibold mb-3 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Top Cast
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {topCast.map((member) => (
                  <div
                    key={member.id}
                    className="border-2 border-border p-3 text-sm"
                  >
                    <div className="font-medium truncate">{member.name}</div>
                    <div className="text-muted-foreground text-xs truncate">
                      {member.character}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
