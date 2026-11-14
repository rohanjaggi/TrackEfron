import { AuthButton } from "@/components/auth-button";
import {
  FooterAttribution,
  GlobalShortcuts,
  MobileNav,
  NavAccentBar,
  NavLinks,
  NavLogButton,
  NavModeToggle,
  ReelCueMark,
} from "@/components/nav-client";
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
      <GlobalShortcuts />
      <div className="flex min-h-screen flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:border focus:border-primary focus:bg-background focus:px-3 focus:py-2 focus:text-[13px] focus:font-medium"
        >
          Skip to content
        </a>

        {/* ── Sticky header: accent line + nav ── */}
        <header className="sticky top-0 z-50 w-full">
          <NavAccentBar />
          <nav
            aria-label="Main"
            className="relative w-full border-b border-[var(--border-raw)] bg-[var(--bg)]"
          >
            <ReelCueMark />
            <div className="mx-auto flex h-[60px] max-w-[1200px] items-center justify-between gap-3 px-4 sm:gap-6 sm:px-6">
              {/* Logo */}
              <Link
                href="/protected"
                aria-label="TrackEfron home"
                className="flex flex-shrink-0 items-center gap-2.5"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/logo.png" alt="" className="h-9 w-9 object-contain" />
                <span className="wordmark hidden text-[22px] xl:block">
                  TrackEfron
                </span>
              </Link>

              {/* Section links */}
              <div className="flex min-w-0 flex-1 justify-center">
                <NavLinks />
              </div>

              {/* Right side */}
              <div className="flex flex-shrink-0 items-center gap-2">
                <NavLogButton />
                <NavModeToggle />
                <Suspense>
                  <AuthButton />
                </Suspense>
              </div>
            </div>
          </nav>
        </header>

        {/* ── Page content ── */}
        <main id="main" className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-10 sm:px-6">
          {children}
        </main>

        {/* ── Footer ── */}
        <footer className="mt-auto w-full border-t border-[var(--border-raw)] pb-20 pt-6 sm:pb-6">
          <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/logo.png" alt="" className="h-6 w-auto object-contain" />
              <span className="wordmark text-[18px]">
                TrackEfron
              </span>
            </div>
            <div className="t-meta flex flex-col items-center gap-3 sm:flex-row sm:gap-6">
              <span className="hidden md:inline">
                Press <kbd className="border border-[var(--border-strong)] px-1.5 py-0.5 text-[11.5px] text-[var(--text)]">N</kbd> to log
              </span>
              <FooterAttribution />
              <span>© 2026 TrackEfron</span>
            </div>
          </div>
        </footer>
        <MobileNav />
      </div>
    </ModeProvider>
  );
}
