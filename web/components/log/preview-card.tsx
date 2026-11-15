import type { LucideIcon } from "lucide-react";

import { Stars } from "@/components/ui/stars";
import { labelOf, yearOf } from "@/lib/log-options";
import { resizePoster } from "@/lib/tmdb/poster";
import type { MediaSearchResult } from "@/lib/types";
import { cn } from "@/lib/utils";

/** The log page's preview: the page's one feature object. Sticky beside the form on wide screens;
 * below it, and only once something is chosen, on small ones. */
export function PreviewCard({
  selected,
  music,
  rating,
  typeLabel,
  Icon,
}: {
  selected: MediaSearchResult | null;
  music: boolean;
  rating: number;
  typeLabel: string;
  Icon: LucideIcon;
}) {
  return (
    <aside
      aria-label="Preview"
      className={cn(
        "w-full lg:sticky lg:top-20",
        music ? "max-w-[260px]" : "max-w-[240px]",
        !selected && "hidden lg:block",
      )}
    >
      <div className="frame frame-accent frame-raised ticks">
        {selected ? (
          <>
            <div className={cn("relative overflow-hidden bg-surface-2", music ? "aspect-square" : "aspect-[2/3]")}>
              {selected.poster_url ? (
                <img
                  src={resizePoster(selected.poster_url, "w780") ?? selected.poster_url}
                  alt=""
                  className="artwork-live h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Icon className="size-12 text-dim" aria-hidden="true" />
                </div>
              )}
            </div>

            <div className="p-4">
              <h2 className="t-card line-clamp-3">{labelOf(selected)}</h2>
              {selected.artist && <p className="mt-1 truncate text-[13px] text-primary">{selected.artist}</p>}
              <p className="t-label mt-2">{[yearOf(selected), typeLabel].filter(Boolean).join(" · ")}</p>
              {selected.overview && <p className="t-meta mt-3 line-clamp-5">{selected.overview}</p>}
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
              <Icon className="size-6 text-dim" aria-hidden="true" />
            </div>
            <p className="t-label mb-1">Preview</p>
            <p className="text-[13px] text-muted-foreground">Choose a title to see its artwork here.</p>
          </div>
        )}
      </div>
    </aside>
  );
}
