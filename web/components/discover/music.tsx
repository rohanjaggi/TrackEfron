import { Check, Disc3, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MediaCard } from "@/components/ui/media-card";
import type { SpotifySearchResult } from "@/lib/spotify/spotify";
import { Shelf, StretchBadge } from "./shelf";

export function MusicCard({
  item,
  onQueue,
  queued,
  explanation,
  stretch,
  showType,
}: {
  item: SpotifySearchResult;
  /** Leave out for things that cannot be queued (an artist). */
  onQueue?: (item: SpotifySearchResult) => void;
  queued?: boolean;
  explanation?: string;
  /** A "discovery" pick: shown with a Stretch tag. */
  stretch?: boolean;
  /** Add "Album" or "Track" and the year to the second line. */
  showType?: boolean;
}) {
  const subtitle = showType
    ? [item.artist, item.type === "album" ? "Album" : "Track", item.release_date.slice(0, 4)]
        .filter(Boolean)
        .join(" · ")
    : item.artist;
  return (
    <MediaCard
      title={item.name}
      subtitle={subtitle || undefined}
      image={item.image_url}
      aspect="square"
      fallbackIcon={Disc3}
      badge={stretch ? <StretchBadge /> : undefined}
      footer={
        explanation || onQueue ? (
          <>
            {explanation && <p className="line-clamp-4">{explanation}</p>}
            {onQueue && (
              <Button
                variant="outline"
                size="sm"
                className="mt-2 w-full disabled:text-primary disabled:opacity-100"
                aria-label={queued ? `${item.name} is in your queue` : `Add ${item.name} to queue`}
                disabled={queued}
                onClick={() => onQueue(item)}
              >
                {queued ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}
                {queued ? "In queue" : "Queue"}
              </Button>
            )}
          </>
        ) : undefined
      }
    />
  );
}

export function MusicShelf({
  title,
  subtitle,
  items,
  loading,
  onQueue,
  queuedIds,
}: {
  title: string;
  subtitle?: string;
  items: SpotifySearchResult[];
  loading?: boolean;
  onQueue?: (item: SpotifySearchResult) => void;
  queuedIds: Set<string>;
}) {
  if (!loading && items.length === 0) return null;
  return (
    <Shelf title={title} subtitle={subtitle} loading={loading} aspect="square" itemCount={items.length}>
      {items.map((item) => (
        <MusicCard key={item.id} item={item} onQueue={onQueue} queued={queuedIds.has(item.id)} />
      ))}
    </Shelf>
  );
}
