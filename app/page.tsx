import { AuthButton } from "@/components/auth-button";
import { Hero } from "@/components/hero";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Suspense } from "react";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      <div className="flex-1 w-full flex flex-col gap-20">
        <nav className="w-full flex justify-center border-b border-border h-16 bg-card/50 backdrop-blur-sm">
          <div className="w-full max-w-5xl flex justify-between items-center p-3 px-5 text-sm">
            <div className="flex items-center font-bold text-lg">
              <Link href="/" className="bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
                TrackEfron
              </Link>
            </div>
            <Suspense>
              <AuthButton />
            </Suspense>
          </div>
        </nav>

        <div className="flex-1 flex flex-col gap-20 max-w-5xl mx-auto p-5 w-full justify-center">
          <Hero />

          <div className="flex flex-col gap-8">
            <div className="grid md:grid-cols-3 gap-6">
              <div className="p-6 bg-card rounded-lg border border-border hover:border-primary/50 transition-colors">
                <div className="text-2xl mb-2">🎬</div>
                <h3 className="font-semibold mb-2">Track Your Watchlist</h3>
                <p className="text-sm text-muted-foreground">
                  Keep track of every movie and show you watch with dates and details
                </p>
              </div>

              <div className="p-6 bg-card rounded-lg border border-border hover:border-accent/50 transition-colors">
                <div className="text-2xl mb-2">⭐</div>
                <h3 className="font-semibold mb-2">Rate & Review</h3>
                <p className="text-sm text-muted-foreground">
                  Write your thoughts and give ratings to share your opinions
                </p>
              </div>

              <div className="p-6 bg-card rounded-lg border border-border hover:border-secondary/50 transition-colors">
                <div className="text-2xl mb-2">🎯</div>
                <h3 className="font-semibold mb-2">Get Recommendations</h3>
                <p className="text-sm text-muted-foreground">
                  Discover new shows and movies based on your viewing history
                </p>
              </div>
            </div>

            <div className="flex justify-center gap-4 pt-8">
              <Button asChild size="lg" variant="default" className="bg-primary hover:bg-primary/90">
                <Link href="/auth/sign-up">Get Started</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/auth/login">Sign In</Link>
              </Button>
            </div>
          </div>
        </div>

        <footer className="w-full flex items-center justify-center border-t border-border mx-auto text-center text-xs gap-8 py-8 text-muted-foreground">
          <p>© 2024 TrackEfron. Track your story.</p>
        </footer>
      </div>
    </main>
  );
}
