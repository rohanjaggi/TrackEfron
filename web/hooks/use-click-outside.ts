"use client";

import { useEffect, useRef, type RefObject } from "react";

/** Calls `onOutside` on a mousedown outside `ref`. Pass `enabled=false` to detach. */
export function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  onOutside: () => void,
  enabled = true,
) {
  const handlerRef = useRef(onOutside);
  handlerRef.current = onOutside;

  useEffect(() => {
    if (!enabled) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) handlerRef.current();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [ref, enabled]);
}
