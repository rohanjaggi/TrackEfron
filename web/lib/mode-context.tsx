"use client";

import { createContext, useContext, useCallback, useMemo, useSyncExternalStore } from "react";

export type AppMode = "film" | "music";

interface ModeContextValue {
  mode: AppMode;
  /** False during the server render and hydration, when `mode` is only the default. */
  ready: boolean;
  setMode: (m: AppMode) => void;
}

const ModeContext = createContext<ModeContextValue>({
  mode: "film",
  ready: true,
  setMode: () => {},
});

// The stored mode is applied to <html data-mode> by an inline script in the root layout
// before first paint, so the attribute is the source of truth on the client.
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function subscribeNever() {
  return () => {};
}

function readMode(): AppMode {
  return document.documentElement.getAttribute("data-mode") === "music" ? "music" : "film";
}

export function ModeProvider({ children }: { children: React.ReactNode }) {
  // The server snapshot is always "film", so the server render and hydration match and do not
  // depend on localStorage. React then re-renders at once with the real mode and `ready` true.
  const mode = useSyncExternalStore<AppMode>(subscribe, readMode, () => "film");
  const ready = useSyncExternalStore(subscribeNever, () => true, () => false);

  const setMode = useCallback((m: AppMode) => {
    try {
      localStorage.setItem("trackefron-mode", m);
    } catch {
      // Storage can be blocked; the mode still changes for this session.
    }
    document.documentElement.setAttribute("data-mode", m);
    listeners.forEach((listener) => listener());
  }, []);

  const value = useMemo(() => ({ mode, ready, setMode }), [mode, ready, setMode]);

  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
}

export function useMode() {
  return useContext(ModeContext);
}
