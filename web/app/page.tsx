"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Film,
  Star,
  BookOpen,
  TrendingUp,
  Clock,
  Search,
  BarChart3,
  Music,
  Disc3,
  Sparkles,
  Headphones,
  Brain,
  Zap,
  ArrowRight,
  ChevronDown,
} from "lucide-react";

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

function FadeIn({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, visible } = useInView();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(24px)",
        transition: `opacity 0.7s cubic-bezier(0.22,1,0.36,1) ${delay}s, transform 0.7s cubic-bezier(0.22,1,0.36,1) ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

function RotatingWord({ words, interval = 3000 }: { words: { text: string; color: string }[]; interval?: number }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % words.length), interval);
    return () => clearInterval(t);
  }, [words.length, interval]);
  return (
    <span className="relative inline-block" style={{ minWidth: "3ch" }}>
      {words.map((w, i) => (
        <span
          key={w.text}
          className="italic font-display transition-all duration-500 absolute left-0"
          style={{
            color: w.color,
            opacity: i === idx ? 1 : 0,
            transform: i === idx ? "translateY(0)" : "translateY(12px)",
            position: i === idx ? "relative" : "absolute",
          }}
        >
          {w.text}
        </span>
      ))}
    </span>
  );
}

function WaveformViz() {
  return (
    <div className="flex items-end gap-[3px] h-8">
      {[14, 20, 8, 24, 12, 18, 6, 22, 10, 16, 24, 8, 20, 14, 6, 18, 10, 22].map((h, i) => (
        <div
          key={i}
          className="w-[3px] rounded-sm"
          style={{
            height: `${h}px`,
            background: "var(--music)",
            opacity: 0.6,
            animation: `wave 1.4s ease infinite ${i * 0.08}s`,
          }}
        />
      ))}
    </div>
  );
}

function FilmStripDeco() {
  return (
    <div className="flex gap-1 opacity-20">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="w-3 h-4 border border-[var(--film)]" />
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col bg-background overflow-hidden">
      <div className="fixed inset-0 opacity-[0.015] pointer-events-none bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,hsl(var(--foreground))_2px,hsl(var(--foreground))_4px)]" />

      <div className="flex-1 w-full flex flex-col relative z-10">
        {/* ── Navigation ──────────────────────────────────────── */}
        <nav className="w-full flex justify-center border-b-2 border-border py-5">
          <div className="w-full max-w-6xl flex justify-between items-center px-6">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="h-12 w-12 flex items-center justify-center">
                <img src="/images/logo.png" alt="TrackEfron Logo" className="h-full w-full object-contain" />
              </div>
              <span className="font-display text-2xl font-bold text-foreground tracking-tight">
                Track<span className="italic" style={{ color: "var(--film)" }}>Efron</span>
              </span>
            </Link>
            <div className="flex items-center gap-4">
              <Button asChild variant="ghost" size="sm">
                <Link href="/auth/login">Sign In</Link>
              </Button>
              <Button asChild size="sm" className="font-semibold">
                <Link href="/auth/sign-up">Get Started</Link>
              </Button>
            </div>
          </div>
        </nav>

        {/* ── Hero ────────────────────────────────────────────── */}
        <section className="relative flex flex-col items-center justify-center px-6 pt-12 pb-32 md:pt-16 md:pb-40 text-center">
          {/* Radial glow behind hero */}
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] pointer-events-none"
            style={{
              background: "radial-gradient(ellipse 60% 50% at 50% 20%, rgba(200,168,106,0.08) 0%, transparent 70%)",
            }}
          />

          <div className="max-w-4xl mx-auto space-y-8 relative">
            {/* Dual badges */}
            <FadeIn className="flex items-center justify-center gap-3">
              <span className="badge-film">Film</span>
              <span className="text-[10px] text-muted-foreground tracking-widest">×</span>
              <span className="badge-music">Music</span>
              <span className="text-[10px] text-muted-foreground tracking-widest">×</span>
              <span
                className="inline-flex items-center px-[7px] py-[2px] text-[9px] font-medium tracking-[0.1em] uppercase"
                style={{ border: "1px solid hsl(280 60% 65%)", color: "hsl(280 60% 65%)", background: "hsla(280,60%,65%,0.12)" }}
              >
                AI
              </span>
            </FadeIn>

            {/* Logo */}
            <FadeIn delay={0.05} className="flex items-center justify-center">
              <img
                src="/images/logo.png"
                alt="TrackEfron Logo"
                className="h-24 w-24 md:h-32 md:w-32 object-contain"
              />
            </FadeIn>

            {/* Heading */}
            <FadeIn delay={0.1}>
              <h1 className="font-display text-5xl md:text-7xl lg:text-8xl font-bold leading-[1.05] text-foreground">
                Track everything you{" "}
                <RotatingWord
                  words={[
                    { text: "watch.", color: "var(--film)" },
                    { text: "hear.", color: "var(--music)" },
                    { text: "love.", color: "hsl(280 60% 65%)" },
                  ]}
                />
              </h1>
            </FadeIn>

            {/* Subtitle */}
            <FadeIn delay={0.2}>
              <p className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
                A personal diary for every film, show, and album.
                Log, rate, review — and let AI reveal patterns in your taste you never noticed.
              </p>
            </FadeIn>

            {/* CTA */}
            <FadeIn delay={0.3} className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
              <Button asChild size="lg" className="group font-semibold text-base px-8 py-6 h-auto border-2">
                <Link href="/auth/sign-up" className="flex items-center gap-2">
                  Start Tracking — It&apos;s Free
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="text-base px-8 py-6 h-auto border-2">
                <Link href="/auth/login">Sign In</Link>
              </Button>
            </FadeIn>

            {/* Scroll hint */}
            <FadeIn delay={0.5} className="pt-8">
              <ChevronDown className="w-5 h-5 text-muted-foreground mx-auto animate-bounce" />
            </FadeIn>
          </div>
        </section>

        {/* ── Dual-mode Showcase ─────────────────────────────── */}
        <section className="w-full border-t-2 border-border">
          <div className="max-w-6xl mx-auto px-6 py-20 md:py-28">
            <FadeIn>
              <div className="text-center mb-16">
                <div className="flex items-center justify-center gap-3 text-muted-foreground mb-6">
                  <div className="w-12 h-[1px] bg-border" />
                  <span className="text-xs uppercase tracking-widest font-medium">Two Worlds, One Library</span>
                  <div className="w-12 h-[1px] bg-border" />
                </div>
                <h2 className="font-display text-4xl md:text-5xl font-bold">
                  Film <span className="italic" style={{ color: "var(--film)" }}>&</span> Music
                </h2>
              </div>
            </FadeIn>

            <div className="grid md:grid-cols-2 gap-6 md:gap-8">
              {/* Film Card */}
              <FadeIn delay={0.1} className="h-full">
                <div className="border-2 border-border p-8 md:p-10 relative group hover:border-[var(--film)]/30 transition-colors duration-500 h-full">
                  <div className="absolute top-0 left-0 w-full h-[2px]" style={{ background: "var(--film)" }} />
                  <div className="flex items-start justify-between mb-6">
                    <Film className="w-8 h-8" style={{ color: "var(--film)" }} />
                    <FilmStripDeco />
                  </div>
                  <h3 className="font-display text-2xl md:text-3xl font-bold mb-3">Films & Shows</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed mb-8">
                    Log every movie and TV show. Rate across six dimensions — plot, acting,
                    cinematography, soundtrack, pacing, casting. Build a library that captures how you actually feel about what you watch.
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    {["Plot", "Acting", "Cinema", "Sound", "Pacing", "Casting"].map((cat) => (
                      <div key={cat} className="text-center py-2 border border-border">
                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{cat}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </FadeIn>

              {/* Music Card */}
              <FadeIn delay={0.2} className="h-full">
                <div className="border-2 border-border p-8 md:p-10 relative group hover:border-[var(--music)]/30 transition-colors duration-500 h-full">
                  <div className="absolute top-0 left-0 w-full h-[2px]" style={{ background: "var(--music)" }} />
                  <div className="flex items-start justify-between mb-6">
                    <Disc3 className="w-8 h-8" style={{ color: "var(--music)" }} />
                    <WaveformViz />
                  </div>
                  <h3 className="font-display text-2xl md:text-3xl font-bold mb-3">Albums & Tracks</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed mb-8">
                    Rate lyrics, production, vocals, melody, replay value, and energy.
                    Connect Spotify to pull in album art and metadata automatically.
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    {["Lyrics", "Production", "Vocals", "Melody", "Replay", "Energy"].map((cat) => (
                      <div key={cat} className="text-center py-2 border border-border">
                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{cat}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </FadeIn>
            </div>
          </div>
        </section>

        {/* ── AI Section ─────────────────────────────────────── */}
        <section className="w-full border-t-2 border-border relative">
          {/* Subtle purple glow */}
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] pointer-events-none"
            style={{
              background: "radial-gradient(ellipse 60% 40% at 50% 0%, hsla(280,60%,65%,0.06) 0%, transparent 70%)",
            }}
          />

          <div className="max-w-6xl mx-auto px-6 py-20 md:py-28 relative">
            <FadeIn>
              <div className="text-center mb-16">
                <div className="flex items-center justify-center gap-3 text-muted-foreground mb-6">
                  <div className="w-12 h-[1px] bg-border" />
                  <span className="text-xs uppercase tracking-widest font-medium">AI-Powered</span>
                  <div className="w-12 h-[1px] bg-border" />
                </div>
                <h2 className="font-display text-4xl md:text-5xl font-bold mb-4">
                  Your taste, <span className="italic" style={{ color: "hsl(280 60% 65%)" }}>decoded</span>
                </h2>
                <p className="text-muted-foreground text-base max-w-lg mx-auto">
                  AI analyzes your ratings and reviews to build a living portrait of your preferences.
                </p>
              </div>
            </FadeIn>

            <div className="grid md:grid-cols-3 gap-6">
              {/* Taste DNA */}
              <FadeIn delay={0.1} className="h-full">
                <div className="border-2 border-border p-8 relative group h-full">
                  <div
                    className="absolute top-0 left-0 w-full h-[2px]"
                    style={{ background: "linear-gradient(90deg, var(--film), hsl(280 60% 65%), var(--music))" }}
                  />
                  <Brain className="w-7 h-7 mb-5" style={{ color: "hsl(280 60% 65%)" }} />
                  <h3 className="font-display text-xl font-bold mb-2">Taste DNA</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                    A deep profile of what you love and why — patterns in your ratings, blind spots,
                    guilty pleasures, and the hidden thread connecting your film and music taste.
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <div className="w-1.5 h-1.5" style={{ background: "var(--film)" }} />
                      Film Identity
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <div className="w-1.5 h-1.5" style={{ background: "var(--music)" }} />
                      Music Identity
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <div className="w-1.5 h-1.5" style={{ background: "hsl(280 60% 65%)" }} />
                      Cross-Domain Connections
                    </div>
                  </div>
                </div>
              </FadeIn>

              {/* Smart Recs */}
              <FadeIn delay={0.2} className="h-full">
                <div className="border-2 border-border p-8 relative group h-full">
                  <div
                    className="absolute top-0 left-0 w-full h-[2px]"
                    style={{ background: "linear-gradient(90deg, var(--film), var(--film))" }}
                  />
                  <Sparkles className="w-7 h-7 mb-5" style={{ color: "var(--film)" }} />
                  <h3 className="font-display text-xl font-bold mb-2">Smart Recommendations</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                    ML-generated film picks verified and enriched by AI. Music recs built from your
                    listening patterns. Every suggestion explains why it fits your taste.
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <div className="w-1.5 h-1.5" style={{ background: "var(--film)" }} />
                      ML + AI Film Picks
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <div className="w-1.5 h-1.5" style={{ background: "var(--music)" }} />
                      Personalized Music Recs
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <div className="w-1.5 h-1.5 bg-muted-foreground" />
                      Explained Reasoning
                    </div>
                  </div>
                </div>
              </FadeIn>

              {/* Vibe Search */}
              <FadeIn delay={0.3} className="h-full">
                <div className="border-2 border-border p-8 relative group h-full">
                  <div
                    className="absolute top-0 left-0 w-full h-[2px]"
                    style={{ background: "linear-gradient(90deg, var(--music), var(--music))" }}
                  />
                  <Zap className="w-7 h-7 mb-5" style={{ color: "var(--music)" }} />
                  <h3 className="font-display text-xl font-bold mb-2">Vibe Search</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                    Search by mood, not title. Describe a feeling — &ldquo;rainy Sunday melancholy&rdquo;
                    or &ldquo;heist energy&rdquo; — and get films and albums that match.
                  </p>
                  <div className="border border-border px-4 py-3">
                    <span className="text-xs text-muted-foreground italic">
                      &ldquo;something that feels like driving alone at 2am&rdquo;
                    </span>
                  </div>
                </div>
              </FadeIn>
            </div>
          </div>
        </section>

        {/* ── Features Grid ──────────────────────────────────── */}
        <section className="w-full border-t-2 border-border">
          <div className="max-w-6xl mx-auto px-6 py-20 md:py-28">
            <FadeIn>
              <div className="text-center mb-16">
                <h2 className="font-display text-4xl md:text-5xl font-bold mb-4">
                  Everything else
                </h2>
                <p className="text-muted-foreground text-base italic">
                  The tools you&apos;d expect, built with care
                </p>
              </div>
            </FadeIn>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {[
                { icon: BookOpen, title: "Full Library", desc: "Every film, show, and album you've logged — organized with posters, ratings, and reviews.", color: "var(--film)" },
                { icon: Clock, title: "Watchlist & Queue", desc: "Save films to watch later and albums to listen to. Add from search or discover.", color: "var(--film)" },
                { icon: TrendingUp, title: "Trending & Discover", desc: "Browse what's trending today. Explore by genre, mood, or just curiosity.", color: "var(--film)" },
                { icon: BarChart3, title: "Stats & Analytics", desc: "Charts, streaks, genre breakdowns, rating distributions. See your habits over time.", color: "var(--film)" },
                { icon: Headphones, title: "Spotify Connect", desc: "Link your Spotify to auto-fill album art, metadata, and listening history.", color: "var(--music)" },
                { icon: Star, title: "Category Ratings", desc: "Go beyond a single score. Six dimensions for film, six for music.", color: "var(--mode-accent)" },
                { icon: Search, title: "TMDB & Spotify Search", desc: "Search millions of movies, shows, and albums. Details pulled in automatically.", color: "var(--mode-accent)" },
                { icon: Music, title: "Bring Your Own Key", desc: "Use your own AI API key — OpenAI, Anthropic, or Gemini. Your data stays yours.", color: "hsl(280 60% 65%)" },
              ].map((f, i) => (
                <FadeIn key={f.title} delay={0.05 * i}>
                  <div className="border-2 border-border p-6 space-y-3 h-full hover:border-[var(--border-hover)] transition-colors">
                    <f.icon className="w-5 h-5" style={{ color: f.color }} />
                    <h3 className="font-semibold text-sm">{f.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* ── How It Works ───────────────────────────────────── */}
        <section className="w-full border-t-2 border-border bg-[var(--surface)]">
          <div className="max-w-6xl mx-auto px-6 py-20 md:py-28">
            <FadeIn>
              <div className="text-center mb-16">
                <div className="flex items-center justify-center gap-3 text-muted-foreground mb-6">
                  <div className="w-12 h-[1px] bg-border" />
                  <span className="text-xs uppercase tracking-widest font-medium">How It Works</span>
                  <div className="w-12 h-[1px] bg-border" />
                </div>
                <h2 className="font-display text-4xl md:text-5xl font-bold">Three steps</h2>
              </div>
            </FadeIn>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                { n: "1", icon: Search, title: "Find It", desc: "Search any movie, show, album, or track. We pull in details, posters, and metadata." },
                { n: "2", icon: Star, title: "Log It", desc: "Rate it, review it, break it down by category. Add context — where you watched, who you were with." },
                { n: "3", icon: Sparkles, title: "Discover", desc: "Your library powers AI insights, personalized recommendations, and taste analytics." },
              ].map((s, i) => (
                <FadeIn key={s.n} delay={0.1 * i} className="h-full">
                  <div className="relative border-2 border-border bg-background p-8 text-center h-full">
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground w-8 h-8 flex items-center justify-center font-bold text-sm">
                      {s.n}
                    </div>
                    <s.icon className="w-7 h-7 text-primary mx-auto mb-4 mt-2" />
                    <h3 className="font-display text-xl font-bold mb-2">{s.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">{s.desc}</p>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ─────────────────────────────────────────────── */}
        <section className="w-full border-t-2 border-border">
          <div className="max-w-4xl mx-auto px-6 py-20 md:py-28">
            <FadeIn>
              <div className="border-2 border-border p-12 md:p-16 text-center space-y-6 relative overflow-hidden">
                {/* Gradient top bar */}
                <div
                  className="absolute top-0 left-0 w-full h-[2px]"
                  style={{ background: "linear-gradient(90deg, var(--film), hsl(280 60% 65%), var(--music))" }}
                />

                <div className="flex items-center justify-center">
                  <img src="/images/logo.png" alt="TrackEfron" className="h-12 w-12 object-contain" />
                </div>
                <h2 className="font-display text-4xl md:text-5xl font-bold">
                  Start <span className="italic" style={{ color: "var(--film)" }}>tracking</span>
                </h2>
                <p className="text-muted-foreground text-base max-w-md mx-auto">
                  Free to use. No ads. Your films, your music, your data.
                </p>
                <div className="pt-4">
                  <Button asChild size="lg" className="group font-semibold text-base px-10 py-6 h-auto border-2">
                    <Link href="/auth/sign-up" className="flex items-center gap-2">
                      Create Free Account
                      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </Button>
                </div>
              </div>
            </FadeIn>
          </div>
        </section>

        {/* ── Footer ──────────────────────────────────────────── */}
        <footer className="w-full border-t-2 border-border py-8">
          <div className="max-w-6xl mx-auto px-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex items-center gap-3">
                <img src="/images/logo.png" alt="TrackEfron" className="h-7 w-auto object-contain" />
              </div>
              <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8">
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground">Data & images provided by</span>
                  <img src="/images/tmdb.svg" alt="TMDB Logo" className="h-4" />
                </div>
                <p className="text-sm text-muted-foreground">&copy; 2026 TrackEfron. All rights reserved.</p>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
