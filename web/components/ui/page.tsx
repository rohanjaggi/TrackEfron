import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Page title block. One per page.
 * `title` may contain <strong> (a name) and <em> (the italic accent clause):
 *   <PageHeader title={<>Your <em>library</em></>} />
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn("mb-10 flex flex-wrap items-end justify-between gap-x-8 gap-y-5", className)}
    >
      <div className="min-w-0">
        <h1 className="t-display">{title}</h1>
        {description && <p className="t-meta mt-3 max-w-[62ch]">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </header>
  );
}

/** Section title over a rule (double rule in film, meter scale in music). */
export function SectionHeader({
  title,
  meta,
  action,
  as: Heading = "h2",
  className,
}: {
  title: React.ReactNode;
  /** Short right-hand note, e.g. a count. */
  meta?: React.ReactNode;
  action?: React.ReactNode;
  as?: "h2" | "h3";
  className?: string;
}) {
  return (
    <div className={cn("rule mb-5 flex items-baseline justify-between gap-4 pb-3", className)}>
      <Heading className="t-title min-w-0">{title}</Heading>
      {(meta || action) && (
        <div className="flex shrink-0 items-baseline gap-4">
          {meta && <span className="label-upper">{meta}</span>}
          {action}
        </div>
      )}
    </div>
  );
}

/** A bare figure over its label. No box: the numeral is the object. */
export function StatBlock({
  label,
  value,
  hint,
  loading,
  size = "lg",
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  loading?: boolean;
  size?: "md" | "lg";
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className={cn("t-numeral mb-1.5", size === "lg" ? "text-[38px]" : "text-[28px]")}>
        {loading ? (
          <span className="skeleton inline-block h-[0.8em] w-[1.6em] align-baseline" aria-hidden="true" />
        ) : (
          <span className="counter-in">{value}</span>
        )}
      </div>
      <div className="label-upper">{label}</div>
      {hint && <div className="t-meta mt-1">{hint}</div>}
    </div>
  );
}

/** Label ......... value, as in a programme's credits or a spec sheet. */
export function LeaderRow({
  label,
  value,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-baseline py-1.5 text-[12px]", className)}>
      <span className="text-muted-foreground">{label}</span>
      <i className="leader" aria-hidden="true" />
      <span className="text-foreground">{value}</span>
    </div>
  );
}

/** Nothing here yet: square mark, an italic line in the product's voice, one way forward. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-4 py-16 text-center", className)}>
      {Icon && (
        <div className="frame mb-5 flex h-14 w-14 items-center justify-center">
          <Icon className="size-6 text-muted-foreground" aria-hidden="true" />
        </div>
      )}
      <p className="font-display text-[22px] italic leading-snug text-foreground">{title}</p>
      {description && <p className="t-meta mx-auto mt-2 max-w-[46ch]">{description}</p>}
      {action && <div className="mt-6 flex flex-wrap justify-center gap-2.5">{action}</div>}
    </div>
  );
}

/** Inline message. `error` interrupts (role=alert); the rest are polite. */
export function Notice({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: "error" | "success" | "warning" | "info";
  title?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  const tones = {
    error: "border-danger/60 bg-danger/10 text-danger",
    success: "border-success/60 bg-success/10 text-success",
    warning: "border-warning/60 bg-warning/10 text-warning",
    info: "border-border-strong bg-surface-2 text-foreground",
  } as const;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("border px-3.5 py-3 text-[12px] leading-relaxed", tones[tone], className)}
    >
      {title && <p className="mb-0.5 font-medium uppercase tracking-[0.08em]">{title}</p>}
      {children && <div className={title ? "text-foreground" : undefined}>{children}</div>}
    </div>
  );
}

/** A labelled form row with hint and error wired to the control via aria. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={htmlFor} className="label-upper">
        {label}
      </label>
      {children}
      {error ? (
        <p id={htmlFor ? `${htmlFor}-error` : undefined} role="alert" className="text-[12px] text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={htmlFor ? `${htmlFor}-hint` : undefined} className="t-meta">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Square portrait. Falls back to the first letter set in the display face. */
export function Avatar({
  src,
  name,
  size = 32,
  className,
}: {
  src?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
}) {
  const initial = (name ?? "").trim().charAt(0).toUpperCase() || "·";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden border border-border-strong bg-surface-2",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <span
          aria-hidden="true"
          className="font-display font-semibold leading-none text-muted-foreground"
          style={{ fontSize: Math.round(size * 0.5) }}
        >
          {initial}
        </span>
      )}
    </span>
  );
}
