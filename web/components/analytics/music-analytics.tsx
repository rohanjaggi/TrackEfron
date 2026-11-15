import { averageRating } from "@/lib/media";
import { StatBlock } from "@/components/ui/page";
import type { ListenLog } from "@/lib/types";
import { Hint, RankedList, Section } from "./blocks";
import { plural, tally } from "./helpers";

export function MusicAnalytics({ listenLogs }: { listenLogs: ListenLog[] }) {
  const albumCount = listenLogs.filter((l) => l.media_type === "album").length;
  const trackCount = listenLogs.filter((l) => l.media_type === "track").length;
  const avgRating = averageRating(listenLogs.map((l) => l.rating));

  const topArtists = tally(listenLogs.map((l) => l.artist)).slice(0, 10);

  return (
    <>
      <div className="grid grid-cols-2 gap-x-8 gap-y-8 md:grid-cols-4">
        <StatBlock label="Logged" value={listenLogs.length} />
        <StatBlock label="Average rating" value={avgRating} hint="out of 5" />
        <StatBlock label="Albums" value={albumCount} />
        <StatBlock label="Tracks" value={trackCount} />
      </div>

      <Section title="Top artists" note="The artists you have logged the most.">
        {topArtists.length > 0 ? (
          <div className="max-w-xl">
            <RankedList items={topArtists} unit={(n) => plural(n, "log", "logs")} />
          </div>
        ) : (
          <Hint>Log 1 more album or track with an artist to see this.</Hint>
        )}
      </Section>
    </>
  );
}
