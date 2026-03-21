"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useMode } from "@/lib/mode-context";
import { Home, Library, Clock, Compass, BarChart3, Clapperboard, Music2 } from "lucide-react";

const NAV_LINKS = [
  { href: "/protected",           label: "Home",      icon: Home,      exact: true },
  { href: "/protected/library",   label: "Library",   icon: Library,   exact: false },
  { href: "/protected/watchlist", label: "Queue",     icon: Clock,     exact: false },
  { href: "/protected/discover",  label: "Discover",  icon: Compass,   exact: false },
  { href: "/protected/analytics", label: "Analytics", icon: BarChart3, exact: false },
];

export function NavAccentBar() {
  return <div className="mode-accent-bar w-full" />;
}

export function NavLinks() {
  const pathname = usePathname();
  const { mode } = useMode();

  return (
    <div className="flex items-center gap-0.5">
      {NAV_LINKS.map(({ href, label, icon: Icon, exact }) => {
        const isActive = exact ? pathname === href : pathname.startsWith(href) && href !== "/protected";
        const isDashboard = href === "/protected" && pathname === "/protected";
        const active = isActive || isDashboard;

        return (
          <Link
            key={href}
            href={href}
            className={[
              "flex items-center gap-1.5 px-3.5 py-1.5 border transition-all duration-200",
              "text-[11px] font-medium tracking-[0.08em] uppercase",
              active
                ? "nav-link-active"
                : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--border-raw)]",
            ].join(" ")}
          >
            <Icon className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="hidden md:inline">{label === "Queue" && mode === "film" ? "Watchlist" : label}</span>
          </Link>
        );
      })}
    </div>
  );
}

export function NavModeToggle() {
  const { mode, setMode } = useMode();

  return (
    <div
      className="flex items-center p-[3px] gap-[2px]"
      style={{ background: "var(--surface)", border: "1px solid var(--border-raw)" }}
    >
      <button
        onClick={() => setMode("film")}
        title="Film & TV mode"
        className={[
          "flex items-center gap-[5px] px-2.5 py-[5px]",
          "text-[10px] font-medium tracking-[0.08em] uppercase transition-all duration-200",
          mode === "film"
            ? "text-[var(--film)]"
            : "text-[var(--text-muted)] hover:text-[var(--text)]",
        ].join(" ")}
        style={mode === "film" ? { background: "var(--film-dim)" } : {}}
      >
        <Clapperboard className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Film</span>
      </button>

      <button
        onClick={() => setMode("music")}
        title="Music mode"
        className={[
          "flex items-center gap-[5px] px-2.5 py-[5px]",
          "text-[10px] font-medium tracking-[0.08em] uppercase transition-all duration-200",
          mode === "music"
            ? "text-[var(--music)]"
            : "text-[var(--text-muted)] hover:text-[var(--text)]",
        ].join(" ")}
        style={mode === "music" ? { background: "var(--music-dim)" } : {}}
      >
        <Music2 className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Music</span>
      </button>
    </div>
  );
}
