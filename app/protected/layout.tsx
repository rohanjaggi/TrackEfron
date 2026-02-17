import { AuthButton } from "@/components/auth-button";
import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";
import { Suspense } from "react";
import { Film, Home, Library, BookOpen, Clock } from "lucide-react";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen flex flex-col bg-background">
      {/* Subtle vintage paper texture */}
      <div className="fixed inset-0 opacity-[0.015] pointer-events-none bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,hsl(var(--foreground))_2px,hsl(var(--foreground))_4px)]" />

      <div className="flex-1 w-full flex flex-col relative z-10">
        {/* Top Navigation */}
        <nav className="w-full flex justify-center border-b-2 border-border py-4 sticky top-0 z-50 bg-background">
          <div className="w-full max-w-6xl flex justify-between items-center px-6">
            {/* Logo */}
            <Link href="/protected" className="flex items-center gap-3 group">
              <div className="h-12 w-12 flex items-center justify-center">
                <img 
                  src="/images/logo.png" 
                  alt="TrackEfron" 
                  className="h-full w-full object-contain"
                />
              </div>
              <span className="font-display text-2xl font-bold text-foreground hidden sm:block">
                TrackEfron
              </span>
            </Link>

            {/* Center Navigation */}
            <div className="flex items-center gap-1">
              <Link 
                href="/protected" 
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium hover:text-primary transition-colors border-b-2 border-transparent hover:border-primary"
              >
                <Home className="w-4 h-4" />
                <span className="hidden md:inline">Home</span>
              </Link>
              <Link 
                href="/protected/library" 
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium hover:text-primary transition-colors border-b-2 border-transparent hover:border-primary"
              >
                <Library className="w-4 h-4" />
                <span className="hidden md:inline">Library</span>
              </Link>
              <Link 
                href="/protected/watchlist" 
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium hover:text-primary transition-colors border-b-2 border-transparent hover:border-primary"
              >
                <Clock className="w-4 h-4" />
                <span className="hidden md:inline">Watchlist</span>
              </Link>
              <Link 
                href="/protected/discover" 
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium hover:text-primary transition-colors border-b-2 border-transparent hover:border-primary"
              >
                <BookOpen className="w-4 h-4" />
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
        <div className="flex-1 flex flex-col w-full max-w-6xl mx-auto px-6 py-10">
          {children}
        </div>

        {/* Footer */}
        <footer className="w-full border-t-2 border-border py-6 mt-auto">
          <div className="max-w-6xl mx-auto px-6">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-sm">
              <div className="flex items-center gap-3">
                <img 
                  src="/images/logo.png" 
                  alt="TrackEfron" 
                  className="h-7 w-auto object-contain"
                />
              </div>
              
              <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-6">
                {/* TMDB Attribution */}
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Data & images by</span>
                  <img 
                    src="/images/tmdb.svg" 
                    alt="TMDB Logo" 
                    className="h-3"
                  />
                </div>
                
                <p className="text-muted-foreground">© 2026 TrackEfron. All rights reserved.</p>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
