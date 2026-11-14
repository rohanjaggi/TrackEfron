"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
  /** Optional count shown after the label. */
  count?: number;
  /** Hide the text label visually (icon-only); the label still names the control. */
  iconOnly?: boolean;
  /** Greys the option out and skips it for keyboard users. */
  disabled?: boolean;
  /** Tooltip, e.g. why the option is disabled. */
  hint?: string;
  /** `alert` draws the count in the accent so pending items get noticed. */
  countTone?: "default" | "alert";
}

interface SegmentedControlProps<T extends string> {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Names the group for assistive tech, e.g. "Filter by type". */
  label: string;
  size?: "sm" | "md";
  className?: string;
}

/**
 * Choose one among peers: filters, view modes, media type.
 * A recessed tray of square keys; the selected key fills with accent ink.
 * Arrow keys move the selection, as in a radio group.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  size = "md",
  className,
}: SegmentedControlProps<T>) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);

  const move = (from: number, delta: number) => {
    let next = from;
    for (let step = 0; step < options.length; step++) {
      next = (next + delta + options.length) % options.length;
      if (!options[next].disabled) break;
    }
    if (options[next].disabled) return;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  // One tab stop: the selected option, or the first enabled one if none is selected.
  const selected = options.findIndex((o) => o.value === value && !o.disabled);
  const focusable = selected >= 0 ? selected : options.findIndex((o) => !o.disabled);

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("well inline-flex max-w-full gap-[2px] overflow-x-auto p-[3px]", className)}
    >
      {options.map((opt, i) => {
        const active = opt.value === value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={typeof opt.count === "number" ? `${opt.label}, ${opt.count}` : opt.label}
            title={opt.hint ?? (opt.iconOnly ? opt.label : undefined)}
            tabIndex={i === focusable ? 0 : -1}
            data-active={active}
            disabled={opt.disabled}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                e.preventDefault();
                move(i, 1);
              } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                e.preventDefault();
                move(i, -1);
              }
            }}
            className={cn(
              "seg flex shrink-0 items-center gap-1.5 whitespace-nowrap font-medium uppercase tracking-[0.08em] disabled:cursor-not-allowed disabled:opacity-40",
              size === "sm" ? "h-7 px-2.5 text-[10px]" : "h-8 px-3 text-[11px]",
            )}
          >
            {Icon && <Icon className="size-3.5 shrink-0" aria-hidden="true" />}
            {!opt.iconOnly && <span>{opt.label}</span>}
            {typeof opt.count === "number" && (
              <span className="text-[10px] opacity-70">{opt.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

interface TabBarProps<T extends string> {
  tabs: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  /** If set, each tab gets id `${idBase}-tab-${value}` and controls `${idBase}-panel-${value}`. */
  idBase?: string;
  className?: string;
}

/**
 * Switch between sections of one page. A hairline with an accent underline
 * that inks in under the current tab.
 */
export function TabBar<T extends string>({
  tabs,
  value,
  onChange,
  label,
  idBase,
  className,
}: TabBarProps<T>) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);

  const move = (from: number, delta: number) => {
    const next = (from + delta + tabs.length) % tabs.length;
    onChange(tabs[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn("hairline flex max-w-full gap-7 overflow-x-auto", className)}
    >
      {tabs.map((tab, i) => {
        const active = tab.value === value;
        const Icon = tab.icon;
        return (
          <button
            key={tab.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={idBase ? `${idBase}-tab-${tab.value}` : undefined}
            aria-controls={idBase ? `${idBase}-panel-${tab.value}` : undefined}
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            data-active={active}
            onClick={() => onChange(tab.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") {
                e.preventDefault();
                move(i, 1);
              } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                move(i, -1);
              }
            }}
            className="tab flex shrink-0 items-center gap-2 whitespace-nowrap pb-3 pt-1 text-[11px] font-medium uppercase tracking-[0.1em]"
          >
            {Icon && <Icon className="size-3.5 shrink-0" aria-hidden="true" />}
            <span>{tab.label}</span>
            {typeof tab.count === "number" && (
              <span
                className={cn(
                  "text-[10px]",
                  tab.countTone === "alert" && tab.count > 0
                    ? "border border-primary/50 bg-primary/10 px-1 text-primary"
                    : "text-muted-foreground",
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
