import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Film, Star, BookOpen, TrendingUp, Clock, Search, BarChart3 } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col bg-background">
      {/* Subtle vintage paper texture */}
      <div className="fixed inset-0 opacity-[0.015] pointer-events-none bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,hsl(var(--foreground))_2px,hsl(var(--foreground))_4px)]" />

      <div className="flex-1 w-full flex flex-col relative z-10">
        {/* Navigation */}
        <nav className="w-full flex justify-center border-b-2 border-border py-6">
          <div className="w-full max-w-6xl flex justify-between items-center px-6">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="h-14 w-14 flex items-center justify-center">
                <img
                  src="/images/logo.png"
                  alt="TrackEfron Logo"
                  className="h-full w-full object-contain"
                />
              </div>
              <span className="font-display text-3xl font-bold text-foreground tracking-tight">
                TrackEfron
              </span>
            </Link>
            <div className="flex items-center gap-4">
              <Button asChild variant="ghost" size="sm">
                <Link href="/auth/login">Sign In</Link>
              </Button>
              <Button asChild size="sm" className="font-semibold">
                <Link href="/auth/sign-up">Get Started</Link>
              </Button>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="flex-1 flex flex-col items-center justify-center px-6 py-20 md:py-28 text-center">
          <div className="max-w-4xl mx-auto space-y-10">
            {/* Logo */}
            <div className="flex items-center justify-center">
              <img
                src="/images/logo.png"
                alt="TrackEfron Logo"
                className="h-28 w-28 md:h-36 md:w-36 object-contain"
              />
            </div>

            {/* Main Heading */}
            <h1 className="font-display text-6xl md:text-8xl font-bold leading-tight text-foreground">
              Track<span className="italic text-primary">Efron</span>
            </h1>

            {/* Subtitle */}
            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              A personal diary for every movie and TV show you watch.
              Track, rate, review, and discover what to watch next.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button asChild size="lg" className="group font-semibold text-base px-8 py-6 h-auto border-2">
                <Link href="/auth/sign-up" className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5" />
                  Start Tracking — It&apos;s Free
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="text-base px-8 py-6 h-auto border-2">
                <Link href="/auth/login">Sign In</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="w-full border-t-2 border-border bg-muted/10">
          <div className="max-w-6xl mx-auto px-6 py-20">
            <div className="text-center mb-16">
              <div className="flex items-center justify-center gap-3 text-muted-foreground mb-6">
                <div className="w-12 h-[1px] bg-border"></div>
                <span className="text-xs uppercase tracking-widest font-medium">How It Works</span>
                <div className="w-12 h-[1px] bg-border"></div>
              </div>
              <h2 className="font-display text-4xl md:text-5xl font-bold">
                Three simple steps
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="relative border-2 border-border p-8 text-center">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground w-8 h-8 flex items-center justify-center font-bold text-sm">
                  1
                </div>
                <Search className="w-8 h-8 text-primary mx-auto mb-4 mt-2" />
                <h3 className="font-display text-xl font-bold mb-2">Find It</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Search any movie or TV show. We pull in details, posters, and cast info automatically.
                </p>
              </div>

              <div className="relative border-2 border-border p-8 text-center">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground w-8 h-8 flex items-center justify-center font-bold text-sm">
                  2
                </div>
                <Star className="w-8 h-8 text-accent mx-auto mb-4 mt-2" />
                <h3 className="font-display text-xl font-bold mb-2">Log It</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Rate it, write a review, break it down by category — plot, acting, cinematography, and more.
                </p>
              </div>

              <div className="relative border-2 border-border p-8 text-center">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground w-8 h-8 flex items-center justify-center font-bold text-sm">
                  3
                </div>
                <BarChart3 className="w-8 h-8 text-secondary mx-auto mb-4 mt-2" />
                <h3 className="font-display text-xl font-bold mb-2">See It</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Your library builds over time. See your stats, your taste profile, and what you love.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="w-full border-t-2 border-border">
          <div className="max-w-6xl mx-auto px-6 py-20">
            <div className="text-center mb-16">
              <h2 className="font-display text-4xl md:text-5xl font-bold mb-4">Built for Movie Lovers</h2>
              <p className="text-muted-foreground text-lg italic">Everything you need, nothing you don&apos;t</p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="border-2 border-border p-6 space-y-3">
                <Film className="w-6 h-6 text-primary" />
                <h3 className="font-semibold text-lg">Full Library</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Every movie and show you&apos;ve watched, organized with posters, dates, and your ratings.
                </p>
              </div>

              <div className="border-2 border-border p-6 space-y-3">
                <Star className="w-6 h-6 text-accent" />
                <h3 className="font-semibold text-lg">Category Ratings</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Go beyond a single score. Rate plot, acting, cinematography, soundtrack, pacing, and casting.
                </p>
              </div>

              <div className="border-2 border-border p-6 space-y-3">
                <Clock className="w-6 h-6 text-secondary" />
                <h3 className="font-semibold text-lg">Watchlist</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Keep track of what you want to watch next. Add from search or the discover page.
                </p>
              </div>

              <div className="border-2 border-border p-6 space-y-3">
                <TrendingUp className="w-6 h-6 text-primary" />
                <h3 className="font-semibold text-lg">Trending & Discover</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  See what&apos;s trending today and search across movies and TV shows to find your next watch.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="w-full border-t-2 border-border">
          <div className="max-w-4xl mx-auto px-6 py-20">
            <div className="border-4 border-border p-12 md:p-16 text-center space-y-6">
              <div className="flex items-center justify-center">
                <img
                  src="/images/logo.png"
                  alt="TrackEfron"
                  className="h-12 w-12 object-contain"
                />
              </div>
              <h2 className="font-display text-4xl md:text-5xl font-bold">
                Start <span className="italic text-primary">Tracking</span>
              </h2>
              <p className="text-muted-foreground text-lg max-w-lg mx-auto">
                Free to use. No ads. Just you and the movies you love.
              </p>
              <div className="pt-4">
                <Button asChild size="lg" className="font-semibold text-base px-10 py-6 h-auto border-2">
                  <Link href="/auth/sign-up">Create Free Account</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="w-full border-t-2 border-border py-8">
          <div className="max-w-6xl mx-auto px-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex items-center gap-3">
                <img
                  src="/images/logo.png"
                  alt="TrackEfron"
                  className="h-7 w-auto object-contain"
                />
              </div>

              <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8">
                {/* TMDB Attribution */}
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground">Data & images provided by</span>
                  <img
                    src="/images/tmdb.svg"
                    alt="TMDB Logo"
                    className="h-4"
                  />
                </div>

                <p className="text-sm text-muted-foreground">© 2026 TrackEfron. All rights reserved.</p>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
