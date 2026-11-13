"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  Film,
  Headphones,
  Link2,
  RefreshCw,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingLine, Skeleton } from "@/components/ui/loading";
import { LeaderRow, Notice, SectionHeader } from "@/components/ui/page";
import { useToast } from "@/components/ui/toast";

interface Identity {
  core: string;
  aspect_lens: string;
  patterns: string;
  rating_style: string;
}

interface TasteDNAData {
  fingerprint: string;
  film_identity: Identity;
  music_identity: Identity;
  cross_domain: {
    thread: string;
    surprising_connection: string;
  };
  blind_spots: string[];
  guilty_pleasures: string[];
  generated_at?: string;
  film_log_count?: number;
  music_log_count?: number;
}

const GENERATE_FAILED = "Couldn't generate your Taste DNA. Try again in a moment.";

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** A ruled, collapsible section of the profile. Not a box: a hairline and a heading. */
function Section({
  icon: Icon,
  title,
  count,
  children,
  defaultOpen = false,
}: {
  icon: LucideIcon;
  title: string;
  count?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <div className="hairline">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
        className="group flex w-full items-center gap-3 py-3.5 text-left"
      >
        <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
        <span className="label-upper min-w-0 flex-1 text-foreground transition-colors duration-cut ease-mech group-hover:text-primary">
          {title}
        </span>
        {count != null && <Badge variant="outline">{count}</Badge>}
        {open ? (
          <ChevronUp className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        ) : (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
      </button>
      {open && (
        <div
          id={panelId}
          className="drawer-in flex max-w-[68ch] flex-col gap-3 pb-5 leading-relaxed text-muted-foreground"
        >
          {children}
        </div>
      )}
    </div>
  );
}

function IdentitySection({ data }: { data: Identity }) {
  return (
    <>
      <p>{data.core}</p>
      {data.aspect_lens && <p>{data.aspect_lens}</p>}
      {data.patterns && <p>{data.patterns}</p>}
      {data.rating_style && <p className="italic">{data.rating_style}</p>}
    </>
  );
}

export function TasteDNACard() {
  const toast = useToast();
  const [dna, setDna] = useState<TasteDNAData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noApiKey, setNoApiKey] = useState(false);

  useEffect(() => {
    async function fetchDNA() {
      try {
        const res = await fetch("/api/ai/taste-dna");
        if (!res.ok) {
          setLoadFailed(true);
          return;
        }
        // `null` means none has been generated yet.
        const data: TasteDNAData | null = await res.json();
        setDna(data);
      } catch {
        setLoadFailed(true);
      } finally {
        setLoading(false);
      }
    }
    fetchDNA();
  }, []);

  async function handleGenerate() {
    const regenerating = dna !== null;
    setGenerating(true);
    setError(null);
    setNoApiKey(false);
    try {
      const res = await fetch("/api/ai/taste-dna", { method: "POST" });
      if (!res.ok) {
        const data: { error?: string; code?: string } = await res.json();
        if (data.code === "NO_API_KEY") {
          setNoApiKey(true);
          return;
        }
        // Only the 400 carries a message written for the user (nothing logged yet).
        setError(res.status === 400 && data.error ? data.error : GENERATE_FAILED);
        return;
      }
      const data: TasteDNAData = await res.json();
      setDna({ ...data, generated_at: new Date().toISOString() });
      setLoadFailed(false);
      toast({
        mark: regenerating ? "Updated" : "Saved",
        title: regenerating ? "Your Taste DNA has been rewritten" : "Your Taste DNA is ready",
      });
    } catch {
      setError("Couldn't generate your Taste DNA. Check your connection and try again.");
    } finally {
      setGenerating(false);
    }
  }

  const apiKeyNotice = noApiKey && (
    <Notice tone="warning" title="API key required" className="mb-5">
      Add an Anthropic or OpenAI key in{" "}
      <Link href="/protected/profile" className="text-primary underline underline-offset-4">
        profile settings
      </Link>{" "}
      to turn on Taste DNA.
    </Notice>
  );

  const errorNotice = error && (
    <Notice tone="error" className="mb-5">
      {error}
    </Notice>
  );

  if (loading) {
    return (
      <section className="frame p-6">
        <SectionHeader title="Taste DNA" />
        <LoadingLine label="Loading your Taste DNA" />
        <div className="mt-5 flex flex-col gap-3">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
        </div>
      </section>
    );
  }

  if (!dna) {
    return (
      <section className="frame p-6">
        <SectionHeader title="Taste DNA" />
        {loadFailed ? (
          <Notice tone="error" title="Couldn't load your Taste DNA" className="mb-5">
            Reload the page to try again. If you have not generated one yet, you can do that below.
          </Notice>
        ) : (
          <p className="mb-5 max-w-[62ch] leading-relaxed text-muted-foreground">
            A written read of your taste in film and music, generated from what you have logged.
            Discover patterns you didn&rsquo;t know you had.
          </p>
        )}
        {apiKeyNotice}
        {errorNotice}
        {generating ? (
          <LoadingLine label="Analysing your taste" className="py-2.5" />
        ) : (
          <Button variant="outline" onClick={handleGenerate}>
            Generate Taste DNA
          </Button>
        )}
      </section>
    );
  }

  const hasCounts = dna.film_log_count != null || dna.music_log_count != null;

  return (
    <section className="frame p-6">
      <SectionHeader
        title="Taste DNA"
        action={
          generating ? (
            <LoadingLine label="Analysing your taste" />
          ) : (
            <Button variant="ghost" size="sm" onClick={handleGenerate}>
              <RefreshCw aria-hidden="true" />
              Regenerate
            </Button>
          )
        }
      />

      {apiKeyNotice}
      {errorNotice}

      <p className="mb-6 font-display text-[22px] italic leading-snug text-foreground">
        &ldquo;{dna.fingerprint}&rdquo;
      </p>

      <div className="border-t border-border">
        {dna.film_identity?.core && (
          <Section icon={Film} title="Film identity" defaultOpen>
            <IdentitySection data={dna.film_identity} />
          </Section>
        )}

        {dna.music_identity?.core && (
          <Section icon={Headphones} title="Music identity">
            <IdentitySection data={dna.music_identity} />
          </Section>
        )}

        {dna.cross_domain?.thread && (
          <Section icon={Link2} title="The thread between">
            <p>{dna.cross_domain.thread}</p>
            {dna.cross_domain.surprising_connection && (
              <p className="italic">{dna.cross_domain.surprising_connection}</p>
            )}
          </Section>
        )}

        {dna.blind_spots && dna.blind_spots.length > 0 && (
          <Section icon={Eye} title="Blind spots" count={dna.blind_spots.length}>
            <ul className="flex flex-wrap gap-2">
              {dna.blind_spots.map((spot, i) => (
                <li key={i} className="max-w-full">
                  <Badge variant="outline" className="max-w-full whitespace-normal leading-snug">
                    {spot}
                  </Badge>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {dna.guilty_pleasures && dna.guilty_pleasures.length > 0 && (
          <Section icon={Zap} title="Guilty pleasures" count={dna.guilty_pleasures.length}>
            <ul className="flex flex-col gap-2">
              {dna.guilty_pleasures.map((gp, i) => (
                <li key={i}>{gp}</li>
              ))}
            </ul>
          </Section>
        )}
      </div>

      {(dna.generated_at || hasCounts) && (
        <div className="mt-5 max-w-sm">
          {dna.generated_at && <LeaderRow label="Generated" value={formatDate(dna.generated_at)} />}
          {dna.film_log_count != null && (
            <LeaderRow label="Films and shows read" value={dna.film_log_count} />
          )}
          {dna.music_log_count != null && (
            <LeaderRow label="Albums and tracks read" value={dna.music_log_count} />
          )}
        </div>
      )}
    </section>
  );
}
