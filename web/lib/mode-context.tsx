"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { MODE_STORAGE_KEY } from "@/lib/mode-boot";

export type AppMode = "film" | "music";

const listeners = new Set<() => void>();

function readMode(): AppMode {
  try {
    return localStorage.getItem(MODE_STORAGE_KEY) === "music" ? "music" : "film";
  } catch {
    return "film";
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

interface ModeContextValue {
  mode: AppMode;
  setMode: (m: AppMode) => void;
  /** How many times the mode has changed since this provider mounted; drives the reel-change animation. */
  switches: number;
  /**
   * False during the server render and hydration, when `mode` is only the
   * default "film"; true afterwards. It flips in the same render in which
   * `mode` settles, so `ready` is never true alongside the server default.
   */
  ready: boolean;
}

const ModeContext = createContext<ModeContextValue>({
  mode: "film",
  setMode: () => {},
  switches: 0,
  ready: true,
});

let switchCount = 0;
// One snapshot carries mode, switch count and readiness, so they change together.
const readSnapshot = () => `${readMode()}|${switchCount}|1`;

export function ModeProvider({ children }: { children: React.ReactNode }) {
  // The server always renders film; the client re-reads storage straight after hydration.
  const snapshot = useSyncExternalStore(subscribe, readSnapshot, () => "film|0|0");
  const [mode, count, readyFlag] = snapshot.split("|") as [AppMode, string, string];
  const ready = readyFlag === "1";

  // Count only the switches made while this provider is mounted, so returning
  // to the app does not replay the reel change.
  const [baseline] = useState(() => Number(count));

  // Keep <html data-mode> in step with the store. The boot script in the root
  // layout sets it before paint; this covers another tab changing the mode.
  useEffect(() => {
    document.documentElement.setAttribute("data-mode", mode);
  }, [mode]);

  const setMode = useCallback((m: AppMode) => {
    if (m === readMode()) return;
    try {
      localStorage.setItem(MODE_STORAGE_KEY, m);
    } catch {
      /* private mode: the choice lasts for this page only */
    }
    document.documentElement.setAttribute("data-mode", m);
    switchCount += 1;
    listeners.forEach((l) => l());
  }, []);

  return (
    <ModeContext.Provider
      value={{ mode, setMode, switches: Number(count) - baseline, ready }}
    >
      {children}
    </ModeContext.Provider>
  );
}

export function useMode() {
  return useContext(ModeContext);
}

/**
 * For pages about ONE item whose domain is fixed by the item, not by the
 * toggle (a film's detail page, a music list, a log being edited). Once the
 * item's domain is known, the app moves to that mode so the accent, the nav
 * wording and the page always agree. Pass `null` while it is still loading.
 */
export function useSyncMode(domain: AppMode | null | undefined) {
  const { setMode } = useMode();
  useEffect(() => {
    if (domain) setMode(domain);
  }, [domain, setMode]);
}
