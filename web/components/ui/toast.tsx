"use client";

import * as React from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

type Tone = "success" | "error" | "info";

export interface ToastOptions {
  /** The stamped mark, one or two words: "Logged", "Removed", "Saved". */
  mark?: string;
  /** What happened, in a sentence. */
  title: string;
  description?: string;
  tone?: Tone;
  action?: { label: string; onClick: () => void };
  /** Milliseconds on screen. Errors and toasts with an action stay longer by default. */
  duration?: number;
}

interface ToastItem extends ToastOptions {
  id: number;
}

const ToastContext = React.createContext<(options: ToastOptions) => void>(() => {});

/** `const toast = useToast(); toast({ mark: "Logged", title: "Dune added to your library" })` */
export function useToast() {
  return React.useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const nextId = React.useRef(1);
  const timers = React.useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = React.useCallback((id: number) => {
    setItems((list) => list.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const toast = React.useCallback(
    (options: ToastOptions) => {
      const id = nextId.current++;
      setItems((list) => [...list.slice(-2), { ...options, id }]);
      const duration =
        options.duration ?? (options.tone === "error" || options.action ? 7000 : 4000);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), duration),
      );
    },
    [dismiss],
  );

  React.useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((t) => clearTimeout(t));
  }, []);

  const toneClass: Record<Tone, string> = {
    success: "text-primary",
    error: "text-danger",
    info: "text-muted-foreground",
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        aria-live="polite"
        aria-relevant="additions"
        className="pointer-events-none fixed inset-x-4 bottom-[4.5rem] z-[1000] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:items-end"
      >
        {items.map((t) => {
          const tone = t.tone ?? "success";
          return (
            <div
              key={t.id}
              role={tone === "error" ? "alert" : "status"}
              className="frame frame-raised drawer-in pointer-events-auto flex w-full max-w-[380px] items-start gap-3.5 border-border-strong bg-surface-3 py-3 pl-3.5 pr-2"
            >
              {t.mark && (
                <span className={cn("stamp stamp-mark mt-0.5 shrink-0", toneClass[tone])}>
                  {t.mark}
                </span>
              )}
              <div className="min-w-0 flex-1 py-0.5">
                <p className="text-[12px] leading-snug text-foreground">{t.title}</p>
                {t.description && <p className="t-meta mt-0.5">{t.description}</p>}
                {t.action && (
                  <button
                    type="button"
                    onClick={() => {
                      t.action?.onClick();
                      dismiss(t.id);
                    }}
                    className="mt-2 text-[11px] font-medium uppercase tracking-[0.1em] text-primary underline-offset-4 hover:underline"
                  >
                    {t.action.label}
                  </button>
                )}
              </div>
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => dismiss(t.id)}
                className="flex h-7 w-7 shrink-0 items-center justify-center text-muted-foreground transition-colors duration-cut ease-mech hover:text-foreground"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
