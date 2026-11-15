import { ArrowUpRight } from "lucide-react";

import { Avatar, SectionHeader } from "@/components/ui/page";
import type { RightNow } from "@/lib/ai/types";

type StripArtist = RightNow["rising"][number];

/** One labelled ruled list of artists, each opening on Spotify. Nothing when the list is empty. */
function ArtistList({ label, artists }: { label: string; artists: StripArtist[] }) {
  if (artists.length === 0) return null;
  return (
    <div className="min-w-0">
      <h3 className="t-label mb-2">{label}</h3>
      <ul>
        {artists.map((artist) => (
          <li key={artist.id} className="row-item">
            <a
              href={`https://open.spotify.com/artist/${artist.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-2 py-2.5"
            >
              <Avatar src={artist.image_url} name={artist.name} size={36} />
              <span className="min-w-0 flex-1 truncate text-foreground">{artist.name}</span>
              <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="sr-only">(opens Spotify in a new tab)</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Artists rising in, and dropping out of, the user's recent Spotify listening. Hidden when both are empty. */
export function RightNowStrip({ rightNow }: { rightNow: RightNow }) {
  if (rightNow.rising.length === 0 && rightNow.dropped_off.length === 0) return null;
  return (
    <section>
      <SectionHeader
        title="Right now"
        description="Who is climbing and who has dropped off in your recent Spotify listening."
      />
      <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
        <ArtistList label="Rising" artists={rightNow.rising} />
        <ArtistList label="Dropped off" artists={rightNow.dropped_off} />
      </div>
    </section>
  );
}
