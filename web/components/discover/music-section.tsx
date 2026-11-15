import { RightNowStrip } from "@/components/discover/right-now-strip";
import { Button } from "@/components/ui/button";
import { MediaGrid } from "@/components/ui/media-card";
import { Notice } from "@/components/ui/page";
import type { RightNow } from "@/lib/ai/types";
import type { SpotifySearchResult } from "@/lib/spotify/spotify";
import { MusicCard, MusicShelf } from "./music";
import { PicksSection } from "./recs";
import type { MusicRec, Recs } from "./types";

type MusicFeed = {
  personalMusicRows: { title: string; items: SpotifySearchResult[] }[];
  personalMusicLoading: boolean;
  spotifyTopTracks: SpotifySearchResult[];
  spotifyOAuthConnected: boolean | null;
  spotifyOAuthLoading: boolean;
};

/** Everything music mode shows below the search: right now, picks, top tracks and library shelves. */
export function MusicSection({
  rightNow,
  recs,
  onRefresh,
  feed,
  queuedIds,
  onQueue,
}: {
  rightNow: RightNow | null;
  recs: Recs<MusicRec>;
  onRefresh: () => void;
  feed: MusicFeed;
  queuedIds: Set<string>;
  onQueue: (item: SpotifySearchResult) => void;
}) {
  const { personalMusicRows, personalMusicLoading, spotifyTopTracks, spotifyOAuthConnected, spotifyOAuthLoading } =
    feed;
  return (
    <>
      {/* Right now: rising and dropped-off artists, from the same answer as the picks */}
      {rightNow && <RightNowStrip rightNow={rightNow} />}

      {/* For you */}
      <section>
        <PicksSection
          title="For you"
          note="Based on what you have logged and rated highly."
          domain="music"
          recs={{ loading: recs.loading, problem: recs.problem, count: recs.items.length }}
          onRefresh={onRefresh}
        >
          <MediaGrid>
            {recs.items.map((item) => (
              <MusicCard
                key={item.id}
                item={item}
                explanation={item.explanation}
                stretch={item.confidence === "discovery"}
                onQueue={onQueue}
                queued={queuedIds.has(item.id)}
              />
            ))}
          </MediaGrid>
        </PicksSection>
      </section>

      {/* Spotify — top tracks */}
      {spotifyOAuthLoading && (
        <MusicShelf
          title="Your top tracks"
          subtitle="Loading from Spotify"
          items={[]}
          loading
          queuedIds={queuedIds}
        />
      )}
      {spotifyOAuthConnected === true && (
        <MusicShelf
          title="Your top tracks"
          subtitle="Your most-played tracks on Spotify"
          items={spotifyTopTracks}
          onQueue={onQueue}
          queuedIds={queuedIds}
        />
      )}
      {spotifyOAuthConnected === false && (
        <Notice
          tone="info"
          title="Connect Spotify for personalised picks"
          action={
            <Button
              asChild
              variant="outline"
              className="shrink-0 border-[#1DB954] bg-[#1DB954] text-black hover:border-[#1DB954] hover:bg-[#1DB954]/85 hover:text-black"
            >
              <a href="/api/spotify/connect">Connect Spotify</a>
            </Button>
          }
        >
          See your top tracks and what is rising in your listening once you connect your account.
        </Notice>
      )}

      {/* Personalised shelves — based on the artists logged most */}
      {personalMusicLoading ? (
        <MusicShelf
          title="From your library"
          subtitle="Based on artists you've logged"
          items={[]}
          loading
          queuedIds={queuedIds}
        />
      ) : (
        personalMusicRows.map((row) => (
          <MusicShelf key={row.title} title={row.title} items={row.items} onQueue={onQueue} queuedIds={queuedIds} />
        ))
      )}
    </>
  );
}
