"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useMode } from "@/lib/mode-context";
import { Home, Library, Clock, Compass, BarChart3, Clapperboard, Music2, Plus } from "lucide-react";
import { SegmentedControl } from "@/components/ui/segmented-control";

const NAV_LINKS = [
  { href: "/protected",           label: "Home",      icon: Home,      exact: true,  key: "h" },
  { href: "/protected/library",   label: "Library",   icon: Library,   exact: false, key: "l" },
  { href: "/protected/watchlist", label: "Queue",     icon: Clock,     exact: false, key: "q" },
  { href: "/protected/discover",  label: "Discover",  icon: Compass,   exact: false, key: "d" },
  { href: "/protected/analytics", label: "Analytics", icon: BarChart3, exact: false, key: "a" },
];

/**
 * Wording that differs by mode, shown from the `data-mode` attribute (set
 * before first paint) rather than from JS state, so a hard reload in music mode
 * never flashes the film wording while the page hydrates.
 */
function ModeWord({ film, music }: { film: string; music: string }) {
  return (
    <>
      <span className="film-only">{film}</span>
      <span className="music-only">{music}</span>
    </>
  );
}

/**
 * The accent line above the nav. On a film ↔ music change a highlight sweeps
 * it and a cue mark blinks twice in the corner, like a reel change.
 */
export function NavAccentBar() {
  const { switches } = useMode();

  return (
    <div className="mode-accent-bar w-full" aria-hidden="true">
      {switches > 0 && <span key={switches} className="reel-sweep" />}
    </div>
  );
}

export function ReelCueMark() {
  const { switches } = useMode();
  if (switches === 0) return null;
  return <span key={switches} className="cue-mark" aria-hidden="true" />;
}

/**
 * Phone navigation: the five sections as a bottom bar in thumb reach, each
 * with its label. The top bar keeps the logo, Log, the mode toggle and the account.
 */
export function MobileNav() {
  const pathname = usePathname();
  const { mode } = useMode();

  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--border-strong)] bg-[var(--bg)] pb-[env(safe-area-inset-bottom)] sm:hidden"
    >
      <ul className="grid grid-cols-5">
        {NAV_LINKS.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          const isQueue = label === "Queue";
          const name = isQueue && mode === "film" ? "Watchlist" : label;
          const short = label === "Analytics" ? "Stats" : label;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-label={name}
                aria-current={active ? "page" : undefined}
                className={[
                  "relative flex h-14 flex-col items-center justify-center gap-1",
                  "text-[12px] font-medium",
                  "transition-colors duration-cut ease-mech",
                  active ? "text-[var(--mode-accent)]" : "text-[var(--text-muted)]",
                ].join(" ")}
              >
                {active && (
                  <span aria-hidden="true" className="absolute inset-x-3 top-[-1px] h-[2px] bg-[var(--mode-accent)]" />
                )}
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span aria-hidden="true">
                  {isQueue ? <ModeWord film="Watch" music="Queue" /> : short}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Credits the catalogue that the current mode draws on. */
export function FooterAttribution() {
  return (
    <>
      <span className="film-only flex items-center gap-2">
        Data &amp; images by
        { }
        <img src="/images/tmdb.svg" alt="TMDB" className="h-3" />
      </span>
      <span className="music-only">Music data &amp; covers by Spotify</span>
    </>
  );
}

export function NavLinks() {
  const pathname = usePathname();
  const { mode } = useMode();

  return (
    <div className="hidden items-center gap-0.5 sm:flex">
      {NAV_LINKS.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        const isQueue = label === "Queue";
        // Accessible name follows the mode once known; the visible word follows data-mode.
        const name = isQueue && mode === "film" ? "Watchlist" : label;

        return (
          <Link
            key={href}
            href={href}
            aria-label={name}
            aria-current={active ? "page" : undefined}
            title={name}
            className={[
              "flex h-9 items-center gap-1.5 border px-2.5 lg:px-3.5",
              "text-[13.5px] font-medium",
              "transition-[color,background-color,border-color] duration-cut ease-mech",
              active
                ? "nav-link-active"
                : "border-transparent text-[var(--text-muted)] hover:border-[var(--border-raw)] hover:text-[var(--text)]",
            ].join(" ")}
          >
            <Icon className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
            <span className="hidden lg:inline">
              {isQueue ? <ModeWord film="Watchlist" music="Queue" /> : label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

/** The core action, always one click (or the N key) away. */
export function NavLogButton() {
  const pathname = usePathname();
  const { mode } = useMode();
  const label = mode === "music" ? "Log a listen" : "Log a watch";
  const active = pathname.startsWith("/protected/log");

  return (
    <Link
      href="/protected/log"
      aria-label={`${label} (press N)`}
      aria-current={active ? "page" : undefined}
      title={`${label} · N`}
      className={[
        "flex h-9 items-center gap-1.5 border px-3",
        "text-[13px] font-semibold",
        "transition-[color,background-color,border-color,transform] duration-cut ease-mech active:translate-y-px",
        "border-primary bg-primary text-primary-foreground hover:border-foreground hover:bg-foreground",
      ].join(" ")}
    >
      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
      <span className="hidden sm:inline">Log</span>
    </Link>
  );
}

export function NavModeToggle() {
  const { mode, setMode } = useMode();

  return (
    <SegmentedControl
      label="Mode"
      size="sm"
      value={mode}
      onChange={setMode}
      options={[
        { value: "film", label: "Film", icon: Clapperboard },
        { value: "music", label: "Music", icon: Music2 },
      ]}
      className="nav-mode-toggle [&_span]:hidden md:[&_span]:inline"
    />
  );
}

/**
 * Global keys. N logs; G then H/L/Q/D/A jumps between sections.
 * Ignored while typing or when a modifier is held.
 */
export function GlobalShortcuts() {
  const router = useRouter();

  useEffect(() => {
    let gAt = 0;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      const el = e.target as HTMLElement | null;
      if (
        el &&
        (el.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) ||
          el.getAttribute("role") === "slider")
      ) {
        return;
      }
      const key = e.key.toLowerCase();
      if (key === "n") {
        e.preventDefault();
        router.push("/protected/log");
        return;
      }
      if (key === "g") {
        gAt = Date.now();
        return;
      }
      if (Date.now() - gAt < 1200) {
        const target = NAV_LINKS.find((l) => l.key === key);
        if (target) {
          e.preventDefault();
          router.push(target.href);
        }
        gAt = 0;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return null;
}
