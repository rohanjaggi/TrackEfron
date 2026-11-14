"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";

export type AppMode = "film" | "music";

interface ModeContextValue {
  mode: AppMode;
  /** False until the stored mode has been read; before that, `mode` is only the default. */
  ready: boolean;
  setMode: (m: AppMode) => void;
}

const ModeContext = createContext<ModeContextValue>({
  mode: "film",
  ready: true,
  setMode: () => {},
});

export function ModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<AppMode>("film");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("trackefron-mode") as AppMode | null;
    const initial = stored === "film" || stored === "music" ? stored : "film";
    setModeState(initial);
    document.documentElement.setAttribute("data-mode", initial);
    setReady(true);
  }, []);

  const setMode = useCallback((m: AppMode) => {
    setModeState(m);
    localStorage.setItem("trackefron-mode", m);
    document.documentElement.setAttribute("data-mode", m);
  }, []);

  return (
    <ModeContext.Provider value={{ mode, ready, setMode }}>
      {children}
    </ModeContext.Provider>
  );
}

export function useMode() {
  return useContext(ModeContext);
}
