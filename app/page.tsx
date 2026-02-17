import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Film, Star, BookOpen, Feather, TrendingUp, Users } from "lucide-react";

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
        <section className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
          <div className="max-w-4xl mx-auto space-y-10">
            {/* Ornamental top */}
            <div className="flex items-center justify-center gap-6 text-muted-foreground">
              <div className="w-24 h-[2px] bg-border"></div>
              <div className="h-16 w-16 flex items-center justify-center">
                <img 
                  src="/images/logo.png" 
                  alt="TrackEfron" 
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="w-24 h-[2px] bg-border"></div>
            </div>

            {/* Main Heading */}
            <h1 className="font-display text-6xl md:text-8xl font-bold leading-tight text-foreground">
              Your Cinematic
              <br />
              <span className="italic">Chronicle</span>
            </h1>

            {/* Subtitle */}
            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Your personal diary for movies and TV shows. Track what you watch, write reviews, and get recommendations.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
              <Button asChild size="lg" className="font-semibold text-base px-8">
                <Link href="/auth/sign-up" className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5" />
                  Start Tracking
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="text-base px-8">
                <Link href="/auth/login">Sign In</Link>
              </Button>
            </div>

            {/* Ornamental bottom */}
            <div className="flex items-center justify-center gap-8 pt-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span>10,000+ Users</span>
              </div>
              <div className="w-1 h-1 bg-muted-foreground"></div>
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4" />
                <span>Since 2026</span>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="w-full max-w-6xl mx-auto px-6 py-20 border-t-2 border-border">
          <div className="text-center mb-16">
            <div className="ornamental-line mb-8"></div>
            <h2 className="font-display text-4xl md:text-5xl font-bold mb-4">What You Get</h2>
            <p className="text-muted-foreground text-lg italic">Everything you need to track your viewing</p>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            {/* Feature 1 */}
            <div className="space-y-4">
              <div className="w-16 h-16 border-2 border-primary flex items-center justify-center mx-auto">
                <Film className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-display text-2xl font-bold text-center">Track Everything</h3>
              <p className="text-muted-foreground text-center leading-relaxed">
                Keep a complete record of every movie and TV show you watch. Track your viewing history with dates and details.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="space-y-4">
              <div className="w-16 h-16 border-2 border-secondary flex items-center justify-center mx-auto">
                <Star className="w-8 h-8 text-secondary" />
              </div>
              <h3 className="font-display text-2xl font-bold text-center">Rate & Review</h3>
              <p className="text-muted-foreground text-center leading-relaxed">
                Write reviews and rate what you watch. Share your thoughts and reflect on what you loved or didn't.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="space-y-4">
              <div className="w-16 h-16 border-2 border-accent flex items-center justify-center mx-auto">
                <TrendingUp className="w-8 h-8 text-accent" />
              </div>
              <h3 className="font-display text-2xl font-bold text-center">Smart Recommendations</h3>
              <p className="text-muted-foreground text-center leading-relaxed">
                Get personalised suggestions based on your taste. Discover your next favourite movie or show.
              </p>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="w-full max-w-5xl mx-auto px-6 py-20">
          <div className="relative p-16 border-4 newspaper-border border-border text-center">
            <div className="max-w-xl mx-auto space-y-6">
              <div className="flex items-center justify-center gap-3 text-muted-foreground">
                <div className="w-8 h-[1px] bg-border"></div>
                <span className="text-xs uppercase tracking-widest">Get Started</span>
                <div className="w-8 h-[1px] bg-border"></div>
              </div>
              <h2 className="font-display text-4xl md:text-5xl font-bold">Start Tracking Today</h2>
              <p className="text-muted-foreground text-lg">
                Join thousands of movie lovers. It's free to get started.
              </p>
              <Button asChild size="lg" className="font-semibold text-base px-10 mt-6">
                <Link href="/auth/sign-up">Create Free Account</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="w-full border-t-2 border-border py-8 mt-12">
          <div className="max-w-6xl mx-auto px-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex items-center gap-3">
                <Film className="w-5 h-5 text-primary" />
                <span className="font-display text-xl font-semibold">TrackEfron</span>
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
