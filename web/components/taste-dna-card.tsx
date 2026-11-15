"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { LoadingLine, Skeleton } from "@/components/ui/loading";
import { Notice, SectionHeader } from "@/components/ui/page";
import { useToast } from "@/components/ui/toast";
import type { TasteDNA, TasteObservation } from "@/lib/ai/types";

type TasteCardData = Pick<TasteDNA, "fingerprint" | "pulse" | "observations"> & {
  logs_since: number;
  needs_regenerate: boolean;
};

type CardError =
  | { kind: "no_key" }
  | { kind: "not_enough" }
  | { kind: "message"; message: string };

const LOAD_FAILED = "Couldn't load your taste card. Reload the page to try again.";
const GENERATE_FAILED = "Something went wrong generating your taste card. Try again.";

/** One observation as a single line, with the title it cites picked out in emphasis. */
function Observation({ observation }: { observation: TasteObservation }) {
  const { text, cited_title } = observation;
  if (!cited_title) return <>{text}</>;

  const at = text.toLowerCase().indexOf(cited_title.toLowerCase());
  const cited = <strong className="font-semibold text-foreground">{at === -1 ? cited_title : text.slice(at, at + cited_title.length)}</strong>;
  if (at === -1) {
    return (
      <>
        {text} {cited}
      </>
    );
  }
  return (
    <>
      {text.slice(0, at)}
      {cited}
      {text.slice(at + cited_title.length)}
    </>
  );
}

function ErrorNotice({ error }: { error: CardError }) {
  if (error.kind === "no_key") {
    return (
      <Notice tone="warning" title="API key required" className="mt-6">
        Add an Anthropic, OpenAI or Gemini key in{" "}
        <Link href="/protected/profile" className="text-primary underline underline-offset-4">
          profile settings
        </Link>{" "}
        to generate your taste card.
      </Notice>
    );
  }
  if (error.kind === "not_enough") {
    return (
      <Notice tone="info" title="Not enough logged yet" className="mt-6">
        Log a few films or albums first, then generate your taste card.
      </Notice>
    );
  }
  return (
    <Notice tone="error" className="mt-6">
      {error.message}
    </Notice>
  );
}

export function TasteDNACard() {
  const toast = useToast();
  const [dna, setDna] = useState<TasteCardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<CardError | null>(null);

  // GET only reads what was generated before; generating is always a button press.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/ai/taste-dna");
        if (!res.ok) throw new Error("load failed");
        // `null` means nothing has been generated yet.
        const data: TasteCardData | null = await res.json();
        if (!cancelled) setDna(data);
      } catch {
        if (!cancelled) setError({ kind: "message", message: LOAD_FAILED });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleGenerate() {
    const regenerating = dna !== null;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/taste-dna", { method: "POST" });
      // A non-JSON body only means there is no server message; the status still decides the error.
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        if (res.status === 402) {
          setError({ kind: "no_key" });
        } else if (res.status === 400) {
          setError({ kind: "not_enough" });
        } else {
          const message = typeof body?.error === "string" && body.error ? body.error : GENERATE_FAILED;
          setError({ kind: "message", message });
        }
        return;
      }
      if (!body || typeof body.fingerprint !== "string") {
        setError({ kind: "message", message: GENERATE_FAILED });
        return;
      }
      setDna({
        fingerprint: body.fingerprint,
        pulse: Array.isArray(body.pulse) ? body.pulse : [],
        observations: Array.isArray(body.observations) ? body.observations : [],
        logs_since: 0,
        needs_regenerate: false,
      });
      toast({
        mark: regenerating ? "Updated" : "Saved",
        title: regenerating ? "Your taste card has been rewritten" : "Your taste card is ready",
      });
    } catch {
      setError({ kind: "message", message: GENERATE_FAILED });
    } finally {
      setGenerating(false);
    }
  }

  const action = loading ? undefined : (
    <Button variant="outline" size="sm" onClick={handleGenerate} disabled={generating}>
      {generating ? "Generating" : dna ? "Regenerate" : "Generate"}
    </Button>
  );

  return (
    <section className="frame frame-accent p-6">
      <SectionHeader title="Your taste" action={action} />

      {loading ? (
        <div className="mt-5 flex flex-col gap-3">
          <LoadingLine label="Loading your taste card" />
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      ) : (
        <>
          {generating && <LoadingLine label="Generating your taste card" className="mt-5" />}

          {dna ? (
            <div className="mt-5">
              <p className="t-voice-lg">&ldquo;{dna.fingerprint}&rdquo;</p>
              {dna.needs_regenerate ? (
                <p className="t-meta mt-3">Regenerate to update</p>
              ) : (
                <>
                  {dna.pulse.length > 0 && <p className="t-label mt-3">{dna.pulse.join(" · ")}</p>}
                  {dna.observations.length > 0 && (
                    <ul className="mt-5 flex flex-col gap-2 text-muted-foreground">
                      {dna.observations.map((o, i) => (
                        <li key={i}>
                          <Observation observation={o} />
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
              {dna.logs_since > 0 && (
                <p className="t-meta mt-4">
                  {dna.logs_since} {dna.logs_since === 1 ? "log" : "logs"} since this was generated
                </p>
              )}
            </div>
          ) : (
            !error &&
            !generating && (
              <p className="t-meta mt-5">A short read on your taste, built from what you&apos;ve logged.</p>
            )
          )}

          {error && <ErrorNotice error={error} />}
        </>
      )}
    </section>
  );
}
