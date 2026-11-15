"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/loading";
import { SectionHeader } from "@/components/ui/page";

/** A titled row of cards that scrolls sideways inside its own container. */
export function Shelf({
  title,
  subtitle,
  loading,
  aspect,
  itemCount,
  children,
}: {
  title: string;
  subtitle?: string;
  loading?: boolean;
  aspect: "poster" | "square";
  itemCount: number;
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
    if (!el) return;
    el.addEventListener("scroll", checkScroll, { passive: true });
    window.addEventListener("resize", checkScroll);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [checkScroll, itemCount, loading]);

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.75;
    el.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  return (
    <section>
      <SectionHeader
        title={title}
        className={subtitle ? "mb-3" : undefined}
        action={
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label={`Scroll ${title} back`}
              disabled={!canScrollLeft}
              onClick={() => scroll("left")}
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label={`Scroll ${title} forward`}
              disabled={!canScrollRight}
              onClick={() => scroll("right")}
            >
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        }
      />
      {subtitle && <p className="t-meta mb-5">{subtitle}</p>}
      <div className="relative">
        <div
          ref={scrollRef}
          role={loading ? "status" : "group"}
          aria-label={loading ? `Loading ${title}` : `${title}, scrolls sideways`}
          tabIndex={loading ? undefined : 0}
          className="-mx-1 flex snap-x snap-proximity gap-5 overflow-x-auto px-1 pb-2 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*]:w-[140px] [&>*]:shrink-0 [&>*]:snap-start sm:[&>*]:w-[160px]"
        >
          {loading
            ? Array.from({ length: 8 }, (_, i) => (
                <div key={i}>
                  <Skeleton className={aspect === "square" ? "aspect-square" : "aspect-[2/3]"} />
                  <Skeleton className="mt-3 h-3 w-3/4" />
                  <Skeleton className="mt-2 h-2.5 w-1/2" />
                </div>
              ))
            : children}
        </div>
        {canScrollRight && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-[var(--bg)] to-transparent"
          />
        )}
      </div>
    </section>
  );
}

/** Marks a pick that reaches past the user's usual taste. */
export function StretchBadge() {
  return <Badge variant="secondary">Stretch</Badge>;
}
