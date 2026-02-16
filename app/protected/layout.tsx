import { AuthButton } from "@/components/auth-button";
import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";
import { Suspense } from "react";
import { Film, Home, Library, Sparkles, Clock } from "lucide-react";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen flex flex-col bg-background">
      {/* Subtle background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -right-64 w-[500px] h-[500px] bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 -left-64 w-[500px] h-[500px] bg-accent/10 rounded-full blur-3xl" />
      </div>

      <div className="flex-1 w-full flex flex-col relative z-10">
        {/* Top Navigation */}
        <nav className="w-full flex justify-center border-b border-border/50 h-16 bg-background/80 backdrop-blur-lg sticky top-0 z-50">
          <div className="w-full max-w-7xl flex justify-between items-center px-6">
            {/* Logo */}
            <Link href="/protected" className="flex items-center gap-2 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary via-accent to-secondary flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                <Film className="w-4 h-4 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent hidden sm:block">
                TrackEfron
              </span>
            </Link>

            {/* Center Navigation */}
            <div className="flex items-center gap-1 bg-card/50 rounded-full border border-border/50 p-1">
              <Link 
                href="/protected" 
                className="flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium hover:bg-primary/10 hover:text-primary transition-colors"
              >
                <Home className="w-4 h-4" />
                <span className="hidden md:inline">Home</span>
              </Link>
              <Link 
                href="/protected/library" 
                className="flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium hover:bg-primary/10 hover:text-primary transition-colors"
              >
                <Library className="w-4 h-4" />
                <span className="hidden md:inline">Library</span>
              </Link>
              <Link 
                href="/protected/watchlist" 
                className="flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium hover:bg-primary/10 hover:text-primary transition-colors"
              >
                <Clock className="w-4 h-4" />
                <span className="hidden md:inline">Watchlist</span>
              </Link>
              <Link 
                href="/protected/discover" 
                className="flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium hover:bg-primary/10 hover:text-primary transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                <span className="hidden md:inline">Discover</span>
              </Link>
            </div>

            {/* Right Side */}
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <Suspense>
                <AuthButton />
              </Suspense>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <div className="flex-1 flex flex-col w-full max-w-7xl mx-auto px-6 py-8">
          {children}
        </div>

        {/* Footer */}
        <footer className="w-full border-t border-border/50 py-6 mt-auto">
          <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Film className="w-4 h-4 text-primary" />
              <span>TrackEfron</span>
            </div>
            <p>© 2026 TrackEfron. Track your story.</p>
          </div>
        </footer>
      </div>
    </main>
  );
}
