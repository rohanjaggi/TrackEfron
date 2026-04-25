import { AuthButton } from "@/components/auth-button";
import { NavAccentBar, NavLinks, NavModeToggle } from "@/components/nav-client";
import { ModeProvider } from "@/lib/mode-context";
import Link from "next/link";
import { Suspense } from "react";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ModeProvider>
      <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>

        {/* ── Mode accent bar ── */}
        <NavAccentBar />

        {/* ── Sticky nav ── */}
        <nav
          className="sticky top-0 z-50 border-b w-full"
          style={{
            background: "rgba(10, 10, 8, 0.92)",
            backdropFilter: "blur(16px)",
            borderColor: "var(--border-raw)",
          }}
        >
          <div className="max-w-[1200px] mx-auto px-6 flex items-center justify-between h-[60px] gap-6">

            {/* Logo */}
            <Link href="/protected" className="flex items-center gap-2.5 flex-shrink-0 group">
              <div className="h-9 w-9 flex items-center justify-center">
                <img
                  src="/images/logo.png"
                  alt="TrackEfron"
                  className="h-full w-full object-contain"
                />
              </div>
              <span
                className="font-display text-[22px] font-semibold tracking-[0.02em] hidden sm:block"
                style={{ color: "var(--text)" }}
              >
                TrackEfron
              </span>
            </Link>

            {/* Center nav links */}
            <div className="flex-1 flex justify-center">
              <NavLinks />
            </div>

            {/* Right side */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <NavModeToggle />
              <Suspense>
                <AuthButton />
              </Suspense>
            </div>
          </div>
        </nav>

        {/* ── Page content ── */}
        <main className="flex-1 w-full max-w-[1200px] mx-auto px-6 py-10">
          {children}
        </main>

        {/* ── Footer ── */}
        <footer
          className="w-full border-t py-6 mt-auto"
          style={{ borderColor: "var(--border-raw)" }}
        >
          <div className="max-w-[1200px] mx-auto px-6">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-3">
                <img src="/images/logo.png" alt="TrackEfron" className="h-6 w-auto object-contain" />
                <span className="font-display text-lg font-semibold" style={{ color: "var(--text)" }}>
                  TrackEfron
                </span>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                <div className="flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
                  <span className="text-xs tracking-wide">Data &amp; images by</span>
                  <img src="/images/tmdb.svg" alt="TMDB" className="h-3" />
                </div>
                <p className="text-xs tracking-wide" style={{ color: "var(--text-muted)" }}>
                  © 2026 TrackEfron
                </p>
              </div>
            </div>
          </div>
        </footer>

      </div>
    </ModeProvider>
  );
}
