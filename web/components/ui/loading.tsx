import { cn } from "@/lib/utils";

/** Placeholder block with a scan line. Size it with width/height classes. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("skeleton", className)} />;
}

/** A line of text with a block cursor: the product's only inline loader. */
export function LoadingLine({
  label = "Loading",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <p role="status" aria-live="polite" className={cn("t-label cursor-blink", className)}>
      {label}
    </p>
  );
}

/** Whole-section loading state. Use instead of a centred spinner. */
export function PageLoading({
  label = "Loading",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-[40vh] items-center justify-center", className)}>
      <LoadingLine label={label} />
    </div>
  );
}

/** Loading placeholder for a grid of posters or covers. */
export function MediaGridSkeleton({
  count = 10,
  aspect = "poster",
  className,
}: {
  count?: number;
  aspect?: "poster" | "square";
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn("grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5", className)}
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>
          <Skeleton className={aspect === "square" ? "aspect-square" : "aspect-[2/3]"} />
          <Skeleton className="mt-3 h-3 w-3/4" />
          <Skeleton className="mt-2 h-2.5 w-1/2" />
        </div>
      ))}
    </div>
  );
}

/** Loading placeholder for a list of rows. */
export function RowListSkeleton({
  count = 4,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div role="status" aria-label="Loading" className={className}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="hairline flex items-center gap-4 py-4">
          <Skeleton className="w-10 shrink-0 h-14" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3 w-[55%]" />
            <Skeleton className="h-2.5 w-[30%]" />
          </div>
        </div>
      ))}
    </div>
  );
}
