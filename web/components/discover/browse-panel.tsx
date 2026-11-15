import { Film } from "lucide-react";

import { MediaGridSkeleton } from "@/components/ui/loading";
import { MediaGrid } from "@/components/ui/media-card";
import { EmptyState, Notice, SectionHeader } from "@/components/ui/page";
import { titleKey } from "@/lib/saved-items";
import { ClearButton, ToggleGroup } from "./controls";
import { FilmCard, FilmShelf } from "./film";
import type { ForYouRow, MediaItem } from "./types";

export const FILM_GENRES = [
  { id: 28, name: "Action" },
  { id: 35, name: "Comedy" },
  { id: 18, name: "Drama" },
  { id: 878, name: "Sci-Fi" },
  { id: 53, name: "Thriller" },
  { id: 27, name: "Horror" },
  { id: 10749, name: "Romance" },
  { id: 99, name: "Documentary" },
];

const FILM_GENRE_OPTIONS = FILM_GENRES.map((g) => ({ key: String(g.id), label: g.name }));

type Genre = { id: number; name: string };

/** The Browse tab: a genre picker with its results, or the trending, cinema and personalised shelves. */
export function BrowsePanel({
  selectedGenre,
  genreResults,
  genreLoading,
  genreError,
  onGenreToggle,
  onGenreClear,
  feed,
}: {
  selectedGenre: Genre | null;
  genreResults: MediaItem[];
  genreLoading: boolean;
  genreError: boolean;
  onGenreToggle: (key: string) => void;
  onGenreClear: () => void;
  feed: {
    trending: MediaItem[];
    nowPlaying: MediaItem[];
    topRated: MediaItem[];
    browseLoading: boolean;
    browseFailed: boolean;
    forYouRows: ForYouRow[];
    personalLoading: boolean;
    watchedKeys: Set<string>;
  };
}) {
  const { trending, nowPlaying, topRated, browseLoading, browseFailed, forYouRows, personalLoading, watchedKeys } =
    feed;
  const filterWatched = (items: MediaItem[]) =>
    watchedKeys.size > 0 ? items.filter((i) => !watchedKeys.has(titleKey(i.media_type, i.id))) : items;

  return (
    <div
      role="tabpanel"
      id="discover-panel-browse"
      aria-labelledby="discover-tab-browse"
      className="flex flex-col gap-16"
    >
      <section>
        <SectionHeader
          title={selectedGenre ? `${selectedGenre.name} films` : "Pick a genre"}
          className={selectedGenre ? "mb-3" : undefined}
          action={selectedGenre ? <ClearButton label="Clear genre" onClick={onGenreClear} /> : undefined}
        />
        {selectedGenre && <p className="t-meta mb-5">Top rated by audience score</p>}
        <ToggleGroup
          label="Genre"
          options={FILM_GENRE_OPTIONS}
          activeKey={selectedGenre ? String(selectedGenre.id) : null}
          onToggle={onGenreToggle}
        />

        {selectedGenre && (
          <div className="mt-8">
            {genreLoading ? (
              <MediaGridSkeleton count={10} />
            ) : genreError ? (
              <Notice tone="error" title={`Couldn't load ${selectedGenre.name} films`}>
                Check your connection, then pick the genre again.
              </Notice>
            ) : genreResults.length === 0 ? (
              <div className="frame">
                <EmptyState
                  icon={Film}
                  title="Nothing turned up for that genre."
                  description="Try another one."
                />
              </div>
            ) : (
              <MediaGrid>
                {genreResults.map((item) => (
                  <FilmCard key={`${item.media_type}-${item.id}`} item={item} />
                ))}
              </MediaGrid>
            )}
          </div>
        )}
      </section>

      {!selectedGenre && (
        <>
          {browseFailed && (
            <Notice tone="error" title="Couldn't load films to browse">
              Check your connection and reload the page.
            </Notice>
          )}

          <FilmShelf title="Trending now" items={trending} loading={browseLoading} />

          <FilmShelf title="In cinemas now" items={filterWatched(nowPlaying)} loading={browseLoading} />

          {/* Picked from the watch history */}
          {personalLoading ? (
            <FilmShelf title="Picked for you" subtitle="Based on your watch history" items={[]} loading />
          ) : (
            forYouRows.map((row) => (
              <FilmShelf key={row.id} title={row.title} subtitle={row.subtitle} items={row.items} />
            ))
          )}

          <FilmShelf
            title="All-time greats"
            subtitle="The highest rated films of all time"
            items={filterWatched(topRated)}
            loading={browseLoading}
          />
        </>
      )}
    </div>
  );
}
