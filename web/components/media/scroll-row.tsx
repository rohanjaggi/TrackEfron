"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { POSTER_ASPECT_CLASS, type PosterAspect } from "@/components/media/poster-card";

/** Pulsing placeholder with the same footprint as a poster card. */
export function PosterSkeleton({
  aspect,
  className,
}: {
  aspect: PosterAspect;
  className?: string;
}) {
  return (
    <div className={className ?? "shrink-0 w-[130px] md:w-[150px]"}>
      <div className={`w-full ${POSTER_ASPECT_CLASS[aspect]} bg-muted/20 border-2 border-border animate-pulse`} />
      <div className="h-3.5 bg-muted/20 rounded mt-1.5 w-3/4 animate-pulse" />
      <div className="h-3 bg-muted/20 rounded mt-1 w-1/2 animate-pulse" />
    </div>
  );
}

/**
 * Titled horizontally scrolling row with prev/next buttons. Renders nothing
 * when not loading and `items` is empty; shows skeletons while loading.
 */
export function ScrollRow({
  title,
  subtitle,
  icon: Icon,
  iconClassName = "text-primary",
  aspect,
  items,
  loading,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ElementType;
  /** Colour class for the heading icon. */
  iconClassName?: string;
  aspect: PosterAspect;
  items: readonly unknown[];
  loading?: boolean;
  /** The cards, rendered when not loading. */
  children: React.ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) {
      el.addEventListener("scroll", checkScroll, { passive: true });
      return () => el.removeEventListener("scroll", checkScroll);
    }
  }, [checkScroll, items]);

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.75;
    el.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  if (!loading && items.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          {Icon && <Icon className={`w-4 h-4 ${iconClassName} shrink-0`} />}
          <div className="min-w-0">
            <h2 className="font-display text-base md:text-lg font-bold truncate">{title}</h2>
            {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-2">
          {canScrollLeft && (
            <button onClick={() => scroll("left")} className="w-7 h-7 border border-border flex items-center justify-center hover:bg-muted/50 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          {canScrollRight && (
            <button onClick={() => scroll("right")} className="w-7 h-7 border border-border flex items-center justify-center hover:bg-muted/50 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-1"
        style={{ scrollbarWidth: "none" }}
      >
        {loading
          ? Array.from({ length: 8 }).map((_, i) => <PosterSkeleton key={i} aspect={aspect} />)
          : children}
      </div>
    </div>
  );
}
