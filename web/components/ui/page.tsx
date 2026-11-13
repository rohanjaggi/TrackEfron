import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Page title block. One per page.
 * `title` may contain <strong> (a name) and <em> (the italic accent clause):
 *   <PageHeader title={<>Your <em>library</em></>} />
 * `media` puts artwork or an avatar to the left of the title.
 */
export function PageHeader({
  title,
  description,
  actions,
  media,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  media?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn("mb-10 flex flex-wrap items-end justify-between gap-x-8 gap-y-5", className)}
    >
      <div className="flex min-w-0 items-end gap-5">
        {media && <div className="shrink-0">{media}</div>}
        <div className="min-w-0">
          <h1 className="t-display">{title}</h1>
          {description && <div className="t-meta mt-3 max-w-[62ch]">{description}</div>}
        </div>
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
  description,
  as: Heading = "h2",
  size = "md",
  flush = false,
  className,
}: {
  title: React.ReactNode;
  /** Short right-hand note, e.g. a count. */
  meta?: React.ReactNode;
  action?: React.ReactNode;
  /** One plain line under the rule explaining the section. */
  description?: React.ReactNode;
  as?: "h2" | "h3";
  /** `lg` is for marketing pages only. */
  size?: "md" | "lg";
  /** No space below, so a ruled list can sit directly on the rule. */
  flush?: boolean;
  className?: string;
}) {
  return (
    <div className={cn(!flush && "mb-5", className)}>
      <div className="rule flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pb-3">
        <Heading
          className={cn("t-title min-w-0", size === "lg" && "text-[clamp(28px,3.4vw,40px)] font-normal")}
        >
          {title}
        </Heading>
        {(meta || action) && (
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1">
            {meta && <span className="label-upper">{meta}</span>}
            {action}
          </div>
        )}
      </div>
      {description && <p className="t-meta mt-3.5 max-w-[68ch]">{description}</p>}
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
  truncate = false,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  /** Keep the row on one line and cut a long label with an ellipsis. */
  truncate?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-baseline py-1.5 text-[12px]", className)}>
      <span className={cn("text-muted-foreground", truncate && "min-w-0 truncate")}>{label}</span>
      <i className="leader" aria-hidden="true" />
      <span className={cn("text-foreground", truncate ? "shrink-0" : "text-right")}>{value}</span>
    </div>
  );
}

/** Nothing here yet: square mark, an italic line in the product's voice, one way forward. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  titleAs: Title = "p",
  className,
}: {
  icon?: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  /** Use "h1" when the empty state is the whole page (not found, error). */
  titleAs?: "p" | "h1" | "h2";
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-4 py-16 text-center", className)}>
      {Icon && (
        <div className="mb-5 flex h-14 w-14 items-center justify-center border border-border bg-surface-2">
          <Icon className="size-6 text-muted-foreground" aria-hidden="true" />
        </div>
      )}
      <Title className="font-display text-[22px] font-normal italic leading-snug text-foreground">
        {title}
      </Title>
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
  action,
  className,
}: {
  tone?: "error" | "success" | "warning" | "info";
  title?: React.ReactNode;
  children?: React.ReactNode;
  /** A button or link offering the way out, e.g. "Try again". */
  action?: React.ReactNode;
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
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border px-3.5 py-3 text-[12px] leading-relaxed",
        tones[tone],
        className,
      )}
    >
      <div className="min-w-0">
        {title && <p className="mb-0.5 font-medium uppercase tracking-[0.08em]">{title}</p>}
        {children && <div className={title ? "text-foreground" : undefined}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/**
 * A labelled form row. Give it the control's id as `htmlFor` and it wires the
 * hint and error to the control (aria-describedby, aria-invalid) for you.
 */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  optional = false,
  hideLabel = false,
  labelAction,
  children,
  className,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  /** Appends "optional" to the label. */
  optional?: boolean;
  /** Keep the label for assistive tech but hide it visually (toolbars). */
  hideLabel?: boolean;
  /** A small link or button on the label's line, e.g. "Forgot your password?". */
  labelAction?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const describedBy = htmlFor ? (error ? `${htmlFor}-error` : hint ? `${htmlFor}-hint` : undefined) : undefined;

  // Wire aria onto a single control child without overriding what the caller set.
  let control = children;
  if (htmlFor && React.isValidElement<Record<string, unknown>>(children)) {
    const props = children.props;
    if (props.id === htmlFor) {
      control = React.cloneElement(children, {
        "aria-describedby": props["aria-describedby"] ?? describedBy,
        "aria-invalid": props["aria-invalid"] ?? (error ? true : undefined),
      });
    }
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className={cn("flex items-baseline justify-between gap-3", hideLabel && "sr-only")}>
        <label htmlFor={htmlFor} className="label-upper">
          {label}
          {optional && <span className="ml-1.5 normal-case tracking-normal text-dim">optional</span>}
        </label>
        {labelAction}
      </div>
      {control}
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
