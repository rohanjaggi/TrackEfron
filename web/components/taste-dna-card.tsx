"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Sparkles, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TasteDNA, TasteObservation } from "@/lib/ai/types";

type TasteCardData = Pick<TasteDNA, "fingerprint" | "pulse" | "observations"> & {
  logs_since: number;
  needs_regenerate: boolean;
};

type CardError =
  | { kind: "no_key" }
  | { kind: "not_enough" }
  | { kind: "message"; message: string };

function Observation({ observation }: { observation: TasteObservation }) {
  const { text, cited_title } = observation;
  const at = cited_title ? text.toLowerCase().indexOf(cited_title.toLowerCase()) : -1;

  if (!cited_title) return <>{text}</>;
  if (at === -1) {
    return (
      <>
        {text} <span className="font-semibold text-foreground">{cited_title}</span>
      </>
    );
  }
  return (
    <>
      {text.slice(0, at)}
      <span className="font-semibold text-foreground">{text.slice(at, at + cited_title.length)}</span>
      {text.slice(at + cited_title.length)}
    </>
  );
}

function ErrorLine({ error }: { error: CardError }) {
  let content: React.ReactNode;
  if (error.kind === "no_key") {
    content = (
      <>
        Add an Anthropic, OpenAI or Gemini key in{" "}
        <Link href="/protected/profile" className="underline text-primary">profile settings</Link>{" "}
        to generate your taste card.
      </>
    );
  } else if (error.kind === "not_enough") {
    content = "Log a few films or albums first, then generate your taste card.";
  } else {
    content = error.message;
  }
  return (
    <p className="mt-4 p-3 border-2 border-destructive bg-destructive/10 text-destructive text-sm">
      {content}
    </p>
  );
}

export function TasteDNACard() {
  const [dna, setDna] = useState<TasteCardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<CardError | null>(null);

  useEffect(() => {
    async function fetchDna() {
      try {
        const res = await fetch("/api/ai/taste-dna");
        if (!res.ok) {
          setError({ kind: "message", message: "Couldn't load your taste card." });
          return;
        }
        setDna(await res.json());
      } catch {
        setError({ kind: "message", message: "Couldn't load your taste card." });
      } finally {
        setLoading(false);
      }
    }
    fetchDna();
  }, []);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/taste-dna", { method: "POST" });
      // A non-JSON body just means there is no server message to show; the status still decides the error.
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        if (res.status === 402 || body?.code === "NO_API_KEY") {
          setError({ kind: "no_key" });
        } else if (res.status === 400) {
          setError({ kind: "not_enough" });
        } else {
          setError({ kind: "message", message: body?.error || "Something went wrong. Try again." });
        }
        return;
      }
      setDna({
        fingerprint: body.fingerprint,
        pulse: body.pulse,
        observations: body.observations,
        logs_since: 0,
        needs_regenerate: false,
      });
    } catch {
      setError({ kind: "message", message: "Something went wrong. Try again." });
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="border-2 border-border bg-card/50 p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h2 className="font-display text-base font-bold">Your taste</h2>
        </div>
        {!loading && (
          <Button variant="ghost" size="sm" onClick={handleGenerate} disabled={generating} className="text-muted-foreground">
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : dna ? <RefreshCw className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
            <span className="ml-2">{generating ? "Generating..." : dna ? "Regenerate" : "Generate"}</span>
          </Button>
        )}
      </div>

      {loading ? (
        <div className="mt-4 space-y-2 animate-pulse">
          <div className="h-5 w-2/3 bg-muted/50" />
          <div className="h-4 w-1/3 bg-muted/50" />
        </div>
      ) : dna ? (
        <div className="mt-4">
          <p className="text-lg font-semibold">&ldquo;{dna.fingerprint}&rdquo;</p>
          {dna.needs_regenerate ? (
            <p className="text-sm text-muted-foreground mt-2">Regenerate to update</p>
          ) : (
            <>
              {dna.pulse.length > 0 && (
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-2">
                  {dna.pulse.join(" · ")}
                </p>
              )}
              {dna.observations.length > 0 && (
                <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                  {dna.observations.map((o, i) => (
                    <li key={i}><Observation observation={o} /></li>
                  ))}
                </ul>
              )}
            </>
          )}
          {dna.logs_since > 0 && (
            <p className="text-xs text-muted-foreground mt-3">
              {dna.logs_since} {dna.logs_since === 1 ? "log" : "logs"} since this was generated
            </p>
          )}
        </div>
      ) : (
        !error && (
          <p className="text-sm text-muted-foreground mt-4">
            A short read on your taste, built from what you&apos;ve logged.
          </p>
        )
      )}

      {error && <ErrorLine error={error} />}
    </div>
  );
}
