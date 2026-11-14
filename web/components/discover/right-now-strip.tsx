import { Music2, TrendingUp } from "lucide-react";
import type { RightNow } from "@/lib/ai/types";

type StripArtist = RightNow["rising"][number];

function ArtistGroup({ label, artists }: { label: string; artists: StripArtist[] }) {
  if (artists.length === 0) return null;
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">{label}</p>
      <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {artists.map((artist) => (
          <a
            key={artist.id}
            href={`https://open.spotify.com/artist/${artist.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 w-[72px] group"
          >
            {artist.image_url ? (
              <img
                src={artist.image_url}
                alt={artist.name}
                className="w-full aspect-square object-cover border-2 border-border group-hover:border-[var(--music)] transition-colors duration-200"
              />
            ) : (
              <div className="w-full aspect-square bg-muted/20 border-2 border-border flex items-center justify-center">
                <Music2 className="w-5 h-5 text-muted-foreground/50" />
              </div>
            )}
            <p className="text-xs font-medium truncate mt-1.5 group-hover:text-[var(--music)] transition-colors">
              {artist.name}
            </p>
          </a>
        ))}
      </div>
    </div>
  );
}

export function RightNowStrip({ rightNow }: { rightNow: RightNow }) {
  if (rightNow.rising.length === 0 && rightNow.dropped_off.length === 0) return null;
  return (
    <div className="border-2 border-border p-4 space-y-4">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-[var(--music)] shrink-0" />
        <h2 className="font-display text-base md:text-lg font-bold">Right now</h2>
      </div>
      <div className="flex flex-col sm:flex-row gap-6">
        <ArtistGroup label="Rising" artists={rightNow.rising} />
        <ArtistGroup label="Dropped off" artists={rightNow.dropped_off} />
      </div>
    </div>
  );
}
