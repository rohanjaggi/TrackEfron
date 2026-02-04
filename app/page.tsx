import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Film, Star, Sparkles, Play, TrendingUp, Users } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col bg-background overflow-hidden">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/2 -right-32 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-secondary/20 rounded-full blur-3xl animate-pulse delay-500" />
      </div>

      <div className="flex-1 w-full flex flex-col relative z-10">
        {/* Navigation */}
        <nav className="w-full flex justify-center h-20 bg-background/80 backdrop-blur-lg border-b border-border/50 sticky top-0 z-50">
          <div className="w-full max-w-7xl flex justify-between items-center px-6">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary via-accent to-secondary flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <Film className="w-5 h-5 text-white" />
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
                TrackEfron
              </span>
            </Link>
            <div className="flex items-center gap-4">
              <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                <Link href="/auth/login">Sign In</Link>
              </Button>
              <Button asChild size="sm" className="bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-lg shadow-primary/25">
                <Link href="/auth/sign-up">Get Started</Link>
              </Button>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center">
          <div className="max-w-4xl mx-auto space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-sm text-primary">
              <Sparkles className="w-4 h-4" />
              <span>AI-Powered Recommendations</span>
            </div>

            {/* Main Heading */}
            <h1 className="text-5xl md:text-7xl font-bold leading-tight">
              <span className="text-foreground">Track Every</span>
              <br />
              <span className="bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent animate-gradient">
                Story You Watch
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Your personal movie & TV diary. Rate, review, and discover what to watch next with intelligent recommendations.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button asChild size="lg" className="bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-xl shadow-primary/30 text-lg px-8 py-6 h-auto">
                <Link href="/auth/sign-up" className="flex items-center gap-2">
                  <Play className="w-5 h-5" />
                  Start Tracking Free
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-border/50 text-lg px-8 py-6 h-auto hover:bg-card">
                <Link href="/auth/login">Sign In</Link>
              </Button>
            </div>

            {/* Social Proof */}
            <div className="flex items-center justify-center gap-6 pt-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                <span>Join 10k+ movie lovers</span>
              </div>
              <div className="w-1 h-1 rounded-full bg-muted-foreground" />
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-accent fill-accent" />
                <span>4.9/5 rating</span>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="w-full max-w-7xl mx-auto px-6 py-20">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Everything You Need</h2>
            <p className="text-muted-foreground text-lg">Track your viewing journey from start to finish</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="group p-8 bg-card/50 backdrop-blur rounded-2xl border border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Film className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Track Everything</h3>
              <p className="text-muted-foreground leading-relaxed">
                Log every movie and TV show you watch. Keep a beautiful record of your viewing history with dates and details.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="group p-8 bg-card/50 backdrop-blur rounded-2xl border border-border/50 hover:border-accent/50 transition-all duration-300 hover:shadow-xl hover:shadow-accent/10 hover:-translate-y-1">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Star className="w-7 h-7 text-accent" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Rate & Review</h3>
              <p className="text-muted-foreground leading-relaxed">
                Share your thoughts with ratings and reviews. Reflect on what you loved, hated, or felt about each title.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="group p-8 bg-card/50 backdrop-blur rounded-2xl border border-border/50 hover:border-secondary/50 transition-all duration-300 hover:shadow-xl hover:shadow-secondary/10 hover:-translate-y-1">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-secondary/20 to-secondary/5 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <TrendingUp className="w-7 h-7 text-secondary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Smart Recommendations</h3>
              <p className="text-muted-foreground leading-relaxed">
                Get personalized suggestions powered by ML. Discover your next favorite based on your unique taste.
              </p>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="w-full max-w-4xl mx-auto px-6 py-20">
          <div className="relative p-12 rounded-3xl bg-gradient-to-br from-primary/10 via-accent/10 to-secondary/10 border border-border/50 text-center overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-accent/5" />
            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to Start Tracking?</h2>
              <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">
                Join thousands of movie enthusiasts. It's free to get started.
              </p>
              <Button asChild size="lg" className="bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-xl shadow-primary/30 text-lg px-10 py-6 h-auto">
                <Link href="/auth/sign-up">Create Free Account</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="w-full border-t border-border/50 py-8">
          <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <Film className="w-5 h-5 text-primary" />
              <span className="font-semibold">TrackEfron</span>
            </div>
            <p className="text-sm text-muted-foreground">© 2026 TrackEfron. Track your story.</p>
          </div>
        </footer>
      </div>
    </main>
  );
}
