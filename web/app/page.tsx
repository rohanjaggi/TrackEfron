import Link from "next/link";
import { ArrowRight, Disc3, Film, Music2, Search, Tv, type LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LeaderRow, StatBlock } from "@/components/ui/page";
import { Stars } from "@/components/ui/stars";
import { cn } from "@/lib/utils";

/* Every title, name and figure below is an invented specimen: it shows the
   shape of the interface, not real works and not real user data. */

const WRAP = "mx-auto w-full max-w-[1200px] px-4 sm:px-6";

type Rating = [label: string, value: number];

const FILM_RATINGS: Rating[] = [
  ["Plot", 4],
  ["Acting", 4.5],
  ["Cinematography", 5],
  ["Soundtrack", 4],
  ["Pacing", 3.5],
  ["Casting", 4.5],
];

const MUSIC_RATINGS: Rating[] = [
  ["Lyrics", 4.5],
  ["Production", 5],
  ["Vocals", 4],
  ["Melody", 4.5],
  ["Replay value", 5],
  ["Energy", 3.5],
];

type Entry = { icon: LucideIcon; title: string; meta: string; rating: number; date: string };

const RECENT_WATCHES: Entry[] = [
  { icon: Film, title: "The Salt Cartographer", meta: "Film, 2021", rating: 4.5, date: "12 Oct" },
  { icon: Tv, title: "Harbour Watch", meta: "TV, series 2", rating: 3.5, date: "9 Oct" },
  { icon: Film, title: "Low Tide at Marrow Bay", meta: "Film, 1987", rating: 4, date: "3 Oct" },
];

const RECENT_LISTENS: Entry[] = [
  { icon: Disc3, title: "Paper Lanterns, Night Bus", meta: "Album, Odalie Fenn", rating: 4.5, date: "14 Oct" },
  { icon: Music2, title: "Kerosene Summer", meta: "Track, The Quiet Arcade", rating: 5, date: "11 Oct" },
  { icon: Disc3, title: "Small Hours Atlas", meta: "Album, Wren Okafor", rating: 3.5, date: "6 Oct" },
];

const THE_REST: { term: string; detail: string }[] = [
  { term: "Library", detail: "Everything you've logged, with artwork, ratings and reviews." },
  { term: "Watchlist and queue", detail: "Save films and albums for later from search or discover." },
  { term: "Search", detail: "Films and shows from TMDB, albums and tracks from Spotify." },
  { term: "Spotify", detail: "Connect your account to bring in your listening history." },
  { term: "Friends", detail: "Add friends and read each other's profiles." },
  { term: "Lists", detail: "Make your own lists, each with a name and a note." },
  { term: "Context", detail: "Note where you watched and who you were with." },
  { term: "Your own key", detail: "Add an OpenAI, Anthropic or Gemini key for the AI features." },
];

/** Empty artwork panel in the right proportion: 2:3 for a poster, square for a cover. */
function Artwork({
  icon: Icon,
  shape,
  className,
}: {
  icon: LucideIcon;
  shape: "poster" | "square";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center border border-border bg-surface-2",
        shape === "poster" ? "aspect-[2/3]" : "aspect-square",
        className,
      )}
    >
      <Icon className="size-1/4 min-h-3.5 min-w-3.5 text-dim" strokeWidth={1.25} aria-hidden="true" />
    </div>
  );
}

function CategoryRatings({ ratings, className }: { ratings: Rating[]; className?: string }) {
  return (
    <div className={className}>
      {ratings.map(([label, value]) => (
        <LeaderRow key={label} label={label} value={<Stars value={value} size={11} />} />
      ))}
    </div>
  );
}

function EntryList({ label, entries, shape }: { label: string; entries: Entry[]; shape: "poster" | "square" }) {
  return (
    <div>
      <p className="t-label hairline pb-2">{label}</p>
      <ul>
        {entries.map((e) => (
          <li key={e.title} className="row-item flex items-center gap-3 px-1 py-2.5">
            <Artwork icon={e.icon} shape={shape} className="w-8" />
            <div className="min-w-0 flex-1">
              <p className="t-card truncate">{e.title}</p>
              <p className="t-meta truncate">{e.meta}</p>
            </div>
            <Stars value={e.rating} size={11} className="shrink-0" />
            <span className="t-meta hidden w-12 shrink-0 text-right sm:block">{e.date}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Landing section title: the section-title face, one step larger, over the rule. */
function SectionHead({ title, children }: { title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mb-10">
      <div className="rule pb-4">
        <h2 className="t-title text-[calc(clamp(26px,3.2vw,36px)*var(--title-scale))]">
          {title}
        </h2>
      </div>
      {children && <p className="mt-5 max-w-[62ch] text-muted-foreground">{children}</p>}
    </div>
  );
}

function Wordmark() {
  return (
    <span className="wordmark text-[22px]">TrackEfron</span>
  );
}

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col overflow-x-clip">
      <header className="border-b border-border">
        <div className={cn(WRAP, "flex h-14 items-center justify-between gap-4")}>
          <Link href="/" className="flex items-center gap-2.5" aria-label="TrackEfron home">
            { }
            <img src="/images/logo.png" alt="" className="h-7 w-7 object-contain" />
            <Wordmark />
          </Link>
          <Button asChild variant="ghost">
            <Link href="/auth/login">Sign in</Link>
          </Button>
        </div>
      </header>

      <main className="flex-1">
        {/* ── First viewport ── */}
        <section
          className={cn(
            WRAP,
            "shutter-in grid items-center gap-x-16 gap-y-14 pb-6 pt-14 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:pb-10 lg:pt-24",
          )}
        >
          <div className="min-w-0">
            <h1 className="t-display text-[clamp(44px,7vw,88px)] leading-none">
              A diary for everything you <em>watch and hear.</em>
            </h1>
            <p className="mt-7 max-w-[54ch] text-muted-foreground">
              Log films, shows and albums with a rating and a review, and see the patterns in your taste. Free to
              use, no ads.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/auth/sign-up">
                  Sign up
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/auth/login">Sign in</Link>
              </Button>
            </div>
          </div>

          <figure className="light-leak mode-film min-w-0">
            <div className="frame frame-accent frame-raised ticks p-5 sm:p-6">
              <div className="flex gap-4 sm:gap-5">
                <Artwork icon={Film} shape="poster" className="w-24 self-start sm:w-32" />
                <div className="min-w-0 flex-1">
                  <Badge>Film</Badge>
                  <p className="mt-3 font-display text-[26px] leading-[1.1] text-foreground sm:text-[30px]">
                    The Salt Cartographer
                  </p>
                  <p className="t-meta mt-1.5">2021, watched 12 Oct at the cinema</p>
                  <Stars value={4.5} size={16} showValue className="mt-4" />
                </div>
              </div>
              <p className="t-prose mt-5">
                Slow first hour, but the last shot of the harbour is worth the wait.
              </p>
              <CategoryRatings ratings={FILM_RATINGS} className="mt-5 border-t border-border pt-3" />
            </div>
          </figure>
        </section>

        {/* ── Two modes ── */}
        <section className={cn(WRAP, "mt-24 lg:mt-36")}>
          <SectionHead
            title={
              <>
                One diary, <em>two modes</em>
              </>
            }
          >
            One switch moves between film mode and music mode. Each has its own colours, words and six rating
            categories.
          </SectionHead>

          <div className="advance grid gap-x-10 gap-y-14 md:grid-cols-2">
            <div className="mode-film flex min-w-0 flex-col gap-7">
              <div className="frame frame-accent p-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="t-title flex items-center gap-2.5">
                    <Film className="size-4 text-film" aria-hidden="true" />
                    Films and TV
                  </h3>
                  <Badge variant="film">Film mode</Badge>
                </div>
                <div className="mt-5 flex gap-4">
                  <Artwork icon={Film} shape="poster" className="w-24 self-start border-film/40" />
                  <div className="min-w-0 flex-1">
                    <p className="t-card">Low Tide at Marrow Bay</p>
                    <p className="t-meta mt-1">Film, 1987</p>
                    <CategoryRatings ratings={FILM_RATINGS} className="mt-3" />
                  </div>
                </div>
              </div>
              <EntryList label="Recently watched" entries={RECENT_WATCHES} shape="poster" />
            </div>

            <div className="mode-music flex min-w-0 flex-col gap-7">
              <div className="frame frame-accent p-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="t-title flex items-center gap-2.5">
                    <Disc3 className="size-4 text-music" aria-hidden="true" />
                    Albums and tracks
                  </h3>
                  <Badge variant="music">Music mode</Badge>
                </div>
                <div className="mt-5 flex gap-4">
                  <Artwork icon={Disc3} shape="square" className="w-24 self-start border-music/40" />
                  <div className="min-w-0 flex-1">
                    <p className="t-card">Paper Lanterns, Night Bus</p>
                    <p className="t-meta mt-1">Album, Odalie Fenn</p>
                    <CategoryRatings ratings={MUSIC_RATINGS} className="mt-3" />
                  </div>
                </div>
              </div>
              <EntryList label="Recently played" entries={RECENT_LISTENS} shape="square" />
            </div>
          </div>
        </section>

        {/* ── Analytics and taste: text left, specimen right ── */}
        <section className={cn(WRAP, "mt-24 lg:mt-36")}>
          <SectionHead
            title={
              <>
                What your ratings <em>add up to</em>
              </>
            }
          />
          <div className="grid gap-x-16 gap-y-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <dl className="min-w-0">
              <div className="hairline pb-4">
                <dt className="t-card">Analytics</dt>
                <dd className="mt-1.5 text-muted-foreground">
                  Genres, decades, film lengths, your top artists, and where your taste differs from the crowd.
                </dd>
              </div>
              <div className="py-4">
                <dt className="t-card">Taste DNA</dt>
                <dd className="mt-1.5 text-muted-foreground">
                  AI reads your ratings and reviews and sums up your taste in film and music, blind spots included.
                </dd>
              </div>
            </dl>

            <figure className="min-w-0">
              <div className="frame p-5 sm:p-6">
                <div className="grid grid-cols-2 gap-x-6 gap-y-7 sm:grid-cols-4">
                  <StatBlock label="Films" value="212" />
                  <StatBlock label="Shows" value="38" />
                  <StatBlock label="Albums" value="147" />
                  <StatBlock label="Average" value="3.8" />
                </div>
                <div className="mt-6 border-t border-border pt-4">
                  <LeaderRow label="Most-watched genre" value="Drama" />
                  <LeaderRow label="Favourite decade" value="1980s" />
                  <LeaderRow label="Rated highest for" value="Cinematography" />
                  <LeaderRow label="Most-logged artist" value="Odalie Fenn" />
                  <LeaderRow label="Against the crowd" value="Kinder to slow films" />
                </div>
              </div>
              <figcaption className="t-meta mt-4">Example figures.</figcaption>
            </figure>
          </div>
        </section>

        {/* ── Recommendations and vibe search: specimen left, text right ── */}
        <section className={cn(WRAP, "mt-24 lg:mt-36")}>
          <SectionHead
            title={
              <>
                Something for <em>tonight</em>
              </>
            }
          />
          <div className="grid gap-x-16 gap-y-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            <figure className="order-2 min-w-0 lg:order-1">
              <div className="frame p-5 sm:p-6">
                <p className="t-label mb-2">Vibe search</p>
                <div className="well flex items-center gap-3 px-3.5 py-3">
                  <Search className="size-3.5 shrink-0 text-dim" aria-hidden="true" />
                  <p className="min-w-0 text-[15.5px] italic leading-snug text-foreground">
                    something that feels like driving alone at 2am
                  </p>
                </div>
                <ul className="mt-4">
                  <li className="hairline flex gap-4 py-4">
                    <Artwork icon={Film} shape="poster" className="w-12 self-start" />
                    <div className="min-w-0">
                      <p className="t-card">Sodium Lights</p>
                      <p className="t-meta mt-0.5">Film, 2014</p>
                      <p className="mt-2 text-muted-foreground">
                        <span className="t-label mr-2">Why it fits</span>
                        Empty night roads, and you rate cinematography highest.
                      </p>
                    </div>
                  </li>
                  <li className="flex gap-4 pt-4">
                    <Artwork icon={Disc3} shape="square" className="w-12 self-start" />
                    <div className="min-w-0">
                      <p className="t-card">Small Hours Atlas</p>
                      <p className="t-meta mt-0.5">Album, Wren Okafor</p>
                      <p className="mt-2 text-muted-foreground">
                        <span className="t-label mr-2">Why it fits</span>
                        Low energy and high replay value, like your favourite albums.
                      </p>
                    </div>
                  </li>
                </ul>
              </div>
              <figcaption className="t-meta mt-4">Example search.</figcaption>
            </figure>

            <dl className="order-1 min-w-0 lg:order-2">
              <div className="hairline pb-4">
                <dt className="t-card">Recommendations</dt>
                <dd className="mt-1.5 text-muted-foreground">
                  AI picks for film and music, based on your ratings and listening, each with a reason it fits.
                </dd>
              </div>
              <div className="hairline py-4">
                <dt className="t-card">Vibe search</dt>
                <dd className="mt-1.5 text-muted-foreground">
                  Search by mood instead of title, like &ldquo;rainy Sunday melancholy&rdquo; or &ldquo;heist
                  energy&rdquo;.
                </dd>
              </div>
              <div className="py-4">
                <dt className="t-card">Trending and discover</dt>
                <dd className="mt-1.5 text-muted-foreground">See what&rsquo;s trending, or browse by genre.</dd>
              </div>
            </dl>
          </div>
        </section>

        {/* ── Everything else: full-width ruled list ── */}
        <section className={cn(WRAP, "mt-24 lg:mt-36")}>
          <SectionHead title="And the rest of it" />
          <dl className="grid gap-x-16 md:grid-cols-2">
            {THE_REST.map((item) => (
              <div key={item.term} className="hairline grid gap-x-6 gap-y-1 py-4 sm:grid-cols-[150px_minmax(0,1fr)]">
                <dt className="t-card">{item.term}</dt>
                <dd className="text-muted-foreground">{item.detail}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ── Closing call ── */}
        <section className={cn(WRAP, "mt-24 pb-24 lg:mt-40 lg:pb-36")}>
          <h2 className="t-display max-w-[16ch] text-[clamp(40px,6vw,76px)] leading-none">
            Start with the last thing you <em>loved.</em>
          </h2>
          <div className="mt-8">
            <Button asChild size="lg">
              <Link href="/auth/sign-up">
                Sign up
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className={cn(WRAP, "flex flex-col gap-5 py-8 md:flex-row md:items-center md:justify-between")}>
          <div className="flex items-center gap-2.5">
            { }
            <img src="/images/logo.png" alt="" className="h-6 w-6 object-contain" />
            <Wordmark />
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-8">
            <p className="t-meta flex items-center gap-3">
              Data and images provided by
              { }
              <img src="/images/tmdb.svg" alt="TMDB" className="h-3.5" />
            </p>
            <p className="t-meta">&copy; 2026 TrackEfron. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
