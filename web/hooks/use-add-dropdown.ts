"use client";

import { useCallback, useRef, useState, type KeyboardEvent } from "react";
import { useClickOutside } from "@/hooks/use-click-outside";

/**
 * Open/close state for an "add to collection" search dropdown: closes on an
 * outside click and on Escape, re-opens on focus when there are results, and
 * closes when the query is emptied. Attach `ref` and `onKeyDown` to the element
 * that wraps the input and the dropdown; the caller calls `show` once a search lands.
 */
export function useAddDropdown() {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const show = useCallback(() => setOpen(true), []);
  const hide = useCallback(() => setOpen(false), []);

  useClickOutside(ref, hide);

  return {
    ref,
    open,
    show,
    hide,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === "Escape") hide();
    },
    /** Call from the input's onChange with the new value. */
    onQueryChange: (value: string) => {
      if (!value.trim()) hide();
    },
    /** Call from the input's onFocus. */
    onFocus: (hasResults: boolean) => {
      if (hasResults) show();
    },
  };
}
