import { Bookmark, BookmarkCheck, Film } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MediaCard } from "@/components/ui/media-card";
import { Shelf, StretchBadge } from "./shelf";
import { filmMeta, mediaHref, type FilmRec, type MediaItem } from "./types";

export function FilmCard({
  item,
  rank,
  stretch,
  onWatchlist,
  watchlisted,
}: {
  item: FilmRec;
  rank?: number;
  /** A "discovery" pick: shown with a Stretch tag. */
  stretch?: boolean;
  onWatchlist?: (item: MediaItem) => void;
  watchlisted?: boolean;
}) {
  const title = item.title || item.name || "Untitled";
  return (
    <MediaCard
      title={title}
      subtitle={filmMeta(item) || undefined}
      image={item.poster_url}
      aspect="poster"
      href={mediaHref(item.media_type, item.id)}
      fallbackIcon={Film}
      badge={
        rank != null || stretch ? (
          <span className="flex flex-wrap gap-1">
            {rank != null && <Badge variant="secondary">No. {rank}</Badge>}
            {stretch && <StretchBadge />}
          </span>
        ) : undefined
      }
      footer={item.explanation ? <p className="line-clamp-4">{item.explanation}</p> : undefined}
      actions={
        onWatchlist ? (
          <Button
            size="icon"
            variant="secondary"
            className="h-8 w-8 disabled:text-primary disabled:opacity-100"
            aria-label={watchlisted ? `${title} is on your watchlist` : `Add ${title} to watchlist`}
            disabled={watchlisted}
            onClick={() => onWatchlist(item)}
          >
            {watchlisted ? <BookmarkCheck aria-hidden="true" /> : <Bookmark aria-hidden="true" />}
          </Button>
        ) : undefined
      }
    />
  );
}

export function FilmShelf({
  title,
  subtitle,
  items,
  loading,
}: {
  title: string;
  subtitle?: string;
  items: MediaItem[];
  loading?: boolean;
}) {
  if (!loading && items.length === 0) return null;
  return (
    <Shelf title={title} subtitle={subtitle} loading={loading} aspect="poster" itemCount={items.length}>
      {items.map((item) => (
        <FilmCard key={`${item.media_type}-${item.id}`} item={item} />
      ))}
    </Shelf>
  );
}
