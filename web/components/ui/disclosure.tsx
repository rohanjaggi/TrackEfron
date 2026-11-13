"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * A ruled row that opens a panel beneath it. Use for optional form sections
 * and collapsible groups. Works controlled (`open` + `onOpenChange`) or
 * uncontrolled (`defaultOpen`). The panel arrives with the drawer cut.
 */
export function Disclosure({
  id,
  title,
  summary,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  children,
  className,
}: {
  /** Unique id; the panel is `${id}-panel`. */
  id: string;
  title: React.ReactNode;
  /** Short right-hand note shown while closed, e.g. "3 of 6 rated". */
  summary?: React.ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const [inner, setInner] = React.useState(defaultOpen);
  const open = openProp ?? inner;
  const toggle = () => {
    const next = !open;
    if (openProp === undefined) setInner(next);
    onOpenChange?.(next);
  };

  return (
    <div className={cn("border-t border-border", className)}>
      <button
        type="button"
        id={`${id}-button`}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        onClick={toggle}
        className="group flex w-full items-center justify-between gap-4 py-3.5 text-left"
      >
        <span className="label-upper transition-colors duration-cut ease-mech group-hover:text-foreground">
          {title}
        </span>
        <span className="flex items-center gap-3">
          {summary && !open && <span className="t-meta">{summary}</span>}
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "size-3.5 text-muted-foreground transition-transform duration-cut ease-mech",
              open && "rotate-180",
            )}
          />
        </span>
      </button>
      {open && (
        <div id={`${id}-panel`} role="region" aria-labelledby={`${id}-button`} className="drawer-in pb-6 pt-1">
          {children}
        </div>
      )}
    </div>
  );
}
