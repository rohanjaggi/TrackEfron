"use client";

import * as React from "react";
import Link from "next/link";
import { Film, type LucideIcon } from "lucide-react";

import { Stars } from "@/components/ui/stars";
import { cn } from "@/lib/utils";

export interface MediaCardProps {
  title: string;
  /** Second line: year, artist, "Film · 2021". */
  subtitle?: React.ReactNode;
  image?: string | null;
  /** Posters are 2:3. Albums and tracks are 1:1. */
  aspect?: "poster" | "square";
  /** Where the card goes. Give `href` or `onClick`. */
  href?: string;
  onClick?: () => void;
  rating?: number | null;
  /** Small tag pinned top-left of the artwork. */
  badge?: React.ReactNode;
  /** Buttons pinned top-right; shown on hover, focus, and always on touch. */
  actions?: React.ReactNode;
  /** Extra text that wipes up over the artwork on hover or focus (a review line, an overview). */
  caption?: React.ReactNode;
  /** Extra line under the subtitle (date logged, match %). */
  footer?: React.ReactNode;
  fallbackIcon?: LucideIcon;
  className?: string;
}

/**
 * The one poster/cover card. Artwork in an accent-topped frame, title set
 * beneath it. The whole card is the link; actions sit above the link.
 */
export function MediaCard({
  title,
  subtitle,
  image,
  aspect = "poster",
  href,
  onClick,
  rating,
  badge,
  actions,
  caption,
  footer,
  fallbackIcon: Fallback = Film,
  className,
}: MediaCardProps) {
  const [broken, setBroken] = React.useState(false);
  const stretched =
    "after:absolute after:inset-0 after:z-[1] after:content-[''] focus-visible:outline-none";

  return (
    <article className={cn("media-card group relative min-w-0", className)}>
      <div
        className={cn(
          "frame frame-accent frame-interactive overflow-hidden",
          "group-focus-within:outline group-focus-within:outline-2 group-focus-within:outline-offset-2 group-focus-within:outline-primary",
          "[.media-card:not(:has(:focus-visible))_&]:outline-none",
          aspect === "square" ? "aspect-square" : "aspect-[2/3]",
        )}
      >
        {image && !broken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setBroken(true)}
            className="artwork h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-surface-2">
            <Fallback className="size-7 text-dim" aria-hidden="true" />
          </div>
        )}

        {badge && <div className="absolute left-2 top-2 z-[2]">{badge}</div>}

        {caption && (
          <div className="media-card__caption absolute inset-x-0 bottom-0 z-[2] border-t border-border-strong bg-background/95 p-3 text-[12px] leading-relaxed text-foreground">
            {caption}
          </div>
        )}

        {actions && (
          <div className="absolute right-2 top-2 z-[4] flex gap-1 opacity-0 transition-opacity duration-cut ease-mech group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
            {actions}
          </div>
        )}
      </div>

      <div className="pt-3">
        <h3 className="t-card line-clamp-2 text-[16px]">
          {href ? (
            <Link href={href} className={stretched}>
              {title}
            </Link>
          ) : onClick ? (
            <button type="button" onClick={onClick} className={cn(stretched, "text-left")}>
              {title}
            </button>
          ) : (
            title
          )}
        </h3>
        {subtitle && <p className="t-meta mt-1 line-clamp-1">{subtitle}</p>}
        {rating != null && rating > 0 && <Stars value={rating} className="mt-1.5" />}
        {footer && <div className="t-meta mt-1.5">{footer}</div>}
      </div>
    </article>
  );
}

/** The standard responsive grid for MediaCards, with the frame-advance entrance. */
export function MediaGrid({
  children,
  dense = false,
  className,
}: {
  children: React.ReactNode;
  /** Six columns on wide screens instead of five. */
  dense?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "advance grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 md:grid-cols-4",
        dense ? "lg:grid-cols-6" : "lg:grid-cols-5",
        className,
      )}
    >
      {children}
    </div>
  );
}
