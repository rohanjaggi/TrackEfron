"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp,
  Film,
  Headphones,
  Link2,
  Eye,
  Zap,
  Key,
} from "lucide-react";
import Link from "next/link";

interface TasteDNAData {
  fingerprint: string;
  film_identity: {
    core: string;
    aspect_lens: string;
    patterns: string;
    rating_style: string;
  };
  music_identity: {
    core: string;
    aspect_lens: string;
    patterns: string;
    rating_style: string;
  };
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

function Section({
  icon: Icon,
  title,
  children,
  defaultOpen = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-2 border-border">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">{title}</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-4 pb-4 space-y-3 text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

function IdentitySection({ data }: { data: { core: string; aspect_lens: string; patterns: string; rating_style: string } }) {
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
  const [dna, setDna] = useState<TasteDNAData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noApiKey, setNoApiKey] = useState(false);

  useEffect(() => {
    async function fetchDNA() {
      try {
        const res = await fetch("/api/ai/taste-dna");
        if (res.ok) {
          const data = await res.json();
          setDna(data);
        }
      } catch {
        // no DNA yet — that's fine
      } finally {
        setLoading(false);
      }
    }
    fetchDNA();
  }, []);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/taste-dna", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        if (data.code === "NO_API_KEY") {
          setNoApiKey(true);
          return;
        }
        setError(data.error || "Failed to generate Taste DNA");
        return;
      }
      const data = await res.json();
      setDna({ ...data, generated_at: new Date().toISOString() });
    } catch {
      setError("Something went wrong. Check your API key.");
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="border-2 border-border p-6">
        <div className="flex items-center gap-3 mb-4">
          <Sparkles className="w-5 h-5 text-primary" />
          <h2 className="font-display text-xl font-semibold">Taste DNA</h2>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!dna) {
    return (
      <div className="border-2 border-border p-6">
        <div className="flex items-center gap-3 mb-4">
          <Sparkles className="w-5 h-5 text-primary" />
          <h2 className="font-display text-xl font-semibold">Taste DNA</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Generate an AI-powered analysis of your taste in film and music.
          Discover patterns you didn't know you had.
        </p>
        {noApiKey && (
          <div className="mb-4 p-3 border-2 border-primary/30 bg-primary/5 text-sm flex items-start gap-3">
            <Key className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">API key required</p>
              <p className="text-muted-foreground">
                Add an Anthropic or OpenAI key in{" "}
                <Link href="/protected/profile" className="underline text-primary">profile settings</Link>
                {" "}to enable AI features.
              </p>
            </div>
          </div>
        )}
        {error && (
          <div className="mb-4 p-3 border-2 border-destructive bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}
        <Button onClick={handleGenerate} disabled={generating || noApiKey} className="border-2">
          {generating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Analyzing your taste...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Generate Taste DNA
            </>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="border-2 border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-primary" />
          <h2 className="font-display text-xl font-semibold">Taste DNA</h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleGenerate}
          disabled={generating}
          className="text-muted-foreground"
        >
          {generating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          <span className="ml-2">{generating ? "Generating..." : "Regenerate"}</span>
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-3 border-2 border-destructive bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Fingerprint */}
      <div className="mb-6 p-4 bg-primary/5 border-2 border-primary/20">
        <p className="text-lg font-semibold text-center italic">
          &ldquo;{dna.fingerprint}&rdquo;
        </p>
      </div>

      <div className="space-y-2">
        {dna.film_identity?.core && (
          <Section icon={Film} title="Film Identity" defaultOpen>
            <IdentitySection data={dna.film_identity} />
          </Section>
        )}

        {dna.music_identity?.core && (
          <Section icon={Headphones} title="Music Identity">
            <IdentitySection data={dna.music_identity} />
          </Section>
        )}

        {dna.cross_domain?.thread && (
          <Section icon={Link2} title="The Thread Between">
            <p>{dna.cross_domain.thread}</p>
            {dna.cross_domain.surprising_connection && (
              <p className="italic">{dna.cross_domain.surprising_connection}</p>
            )}
          </Section>
        )}

        {dna.blind_spots && dna.blind_spots.length > 0 && (
          <Section icon={Eye} title="Blind Spots">
            <ul className="list-disc list-inside space-y-1">
              {dna.blind_spots.map((spot, i) => (
                <li key={i}>{spot}</li>
              ))}
            </ul>
          </Section>
        )}

        {dna.guilty_pleasures && dna.guilty_pleasures.length > 0 && (
          <Section icon={Zap} title="Guilty Pleasures">
            <ul className="list-disc list-inside space-y-1">
              {dna.guilty_pleasures.map((gp, i) => (
                <li key={i}>{gp}</li>
              ))}
            </ul>
          </Section>
        )}
      </div>

      {dna.generated_at && (
        <p className="text-xs text-muted-foreground mt-4 text-right">
          Generated {new Date(dna.generated_at).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}
