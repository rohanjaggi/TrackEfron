"use client";

import { createContext, useCallback, useContext, useSyncExternalStore } from "react";

export type AppMode = "film" | "music";

const STORAGE_KEY = "trackefron-mode";
const listeners = new Set<() => void>();

function readMode(): AppMode {
  try {
    return localStorage.getItem(STORAGE_KEY) === "music" ? "music" : "film";
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

/**
 * Runs before first paint (see app/layout.tsx) so the accent colour is right
 * from the first frame instead of flashing film gold for music users.
 */
export const MODE_BOOT_SCRIPT = `try{var m=localStorage.getItem("${STORAGE_KEY}");document.documentElement.setAttribute("data-mode",m==="music"?"music":"film")}catch(e){}`;

interface ModeContextValue {
  mode: AppMode;
  setMode: (m: AppMode) => void;
  /** How many times the user has switched mode in this session; drives the reel-change animation. */
  switches: number;
}

const ModeContext = createContext<ModeContextValue>({
  mode: "film",
  setMode: () => {},
  switches: 0,
});

let switches = 0;
const readSnapshot = () => `${readMode()}|${switches}`;

export function ModeProvider({ children }: { children: React.ReactNode }) {
  // The server always renders film; the client re-reads storage straight after hydration.
  const snapshot = useSyncExternalStore(subscribe, readSnapshot, () => "film|0");
  const [mode, count] = snapshot.split("|") as [AppMode, string];

  const setMode = useCallback((m: AppMode) => {
    if (m === readMode()) return;
    try {
      localStorage.setItem(STORAGE_KEY, m);
    } catch {
      /* private mode: the choice lasts for this page only */
    }
    document.documentElement.setAttribute("data-mode", m);
    switches += 1;
    listeners.forEach((l) => l());
  }, []);

  return (
    <ModeContext.Provider value={{ mode, setMode, switches: Number(count) }}>
      {children}
    </ModeContext.Provider>
  );
}

export function useMode() {
  return useContext(ModeContext);
}
