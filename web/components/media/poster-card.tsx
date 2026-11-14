import type { ReactNode } from "react";
import { Disc3, Film } from "lucide-react";

export type PosterAspect = "poster" | "square";

export const POSTER_ASPECT_CLASS: Record<PosterAspect, string> = {
  poster: "aspect-[2/3]",
  square: "aspect-square",
};

const ACCENT = {
  primary: { border: "group-hover:border-primary", title: "group-hover:text-primary" },
  music: { border: "group-hover:border-[var(--music)]", title: "group-hover:text-[var(--music)]" },
} as const;

/**
 * Artwork with a title and a caller-supplied subtitle underneath. `tag` and
 * `action` are overlays positioned by the caller over the artwork.
 */
export function PosterCard({
  imageUrl,
  title,
  subtitle,
  aspect,
  accent = "primary",
  onClick,
  className = "shrink-0 w-[130px] md:w-[150px]",
  tag,
  action,
}: {
  imageUrl?: string | null;
  title: string;
  subtitle?: ReactNode;
  aspect: PosterAspect;
  /** Hover colour for the border and title. */
  accent?: keyof typeof ACCENT;
  /** Makes the whole card clickable. */
  onClick?: () => void;
  /** Root sizing classes. */
  className?: string;
  tag?: ReactNode;
  action?: ReactNode;
}) {
  const FallbackIcon = aspect === "square" ? Disc3 : Film;
  const art = imageUrl ? (
    <img
      src={imageUrl}
      alt={title}
      className={`w-full ${POSTER_ASPECT_CLASS[aspect]} object-cover border-2 border-border ${ACCENT[accent].border} transition-colors duration-200`}
      onError={(e) => { e.currentTarget.style.display = "none"; }}
    />
  ) : (
    <div className={`w-full ${POSTER_ASPECT_CLASS[aspect]} bg-muted/20 border-2 border-border flex items-center justify-center`}>
      <FallbackIcon className="w-6 h-6 text-muted-foreground/50" />
    </div>
  );

  return (
    <div onClick={onClick} className={`${className} ${onClick ? "cursor-pointer " : ""}group`}>
      {tag || action ? (
        <div className="relative">
          {art}
          {tag}
          {action}
        </div>
      ) : (
        art
      )}
      <p className={`text-sm font-medium truncate mt-1.5 ${ACCENT[accent].title} transition-colors`}>
        {title}
      </p>
      {subtitle}
    </div>
  );
}
