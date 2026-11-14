import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { callAI } from "@/lib/ai/provider";
import { tasteDNATool } from "@/lib/ai/tools";
import { TASTE_DNA_SYSTEM, buildTasteDNAUserPrompt } from "@/lib/ai/prompts";
import type { TasteDNA } from "@/lib/ai/types";
import { validateObservations, limitTasteDNA } from "@/lib/taste/validate";

export const maxDuration = 300;

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [watchRes, listenRes, watchlistRes, queueRes] = await Promise.all([
    supabase.from("watch_logs").select("title, rating, review, media_type, plot_rating, cinematography_rating, acting_rating, soundtrack_rating, pacing_rating, casting_rating, rewatchability").eq("user_id", user.id),
    supabase.from("listen_logs").select("title, artist, rating, review, media_type, lyrics_rating, production_rating, vocals_rating, melody_rating, replay_rating, energy_rating").eq("user_id", user.id),
    supabase.from("watchlist").select("title, media_type").eq("user_id", user.id),
    supabase.from("music_queue").select("title, artist").eq("user_id", user.id),
  ]);

  const watchLogs = watchRes.data || [];
  const listenLogs = listenRes.data || [];
  const watchlist = watchlistRes.data || [];
  const musicQueue = queueRes.data || [];

  if (watchLogs.length === 0 && listenLogs.length === 0) {
    return NextResponse.json(
      { error: "Not enough data to generate Taste DNA. Log some films or music first." },
      { status: 400 }
    );
  }

  const userPrompt = buildTasteDNAUserPrompt({ watchLogs, listenLogs, watchlist, musicQueue });

  const result = await callAI({
    supabase,
    userId: user.id,
    tier: "powerful",
    maxTokens: 2000,
    system: TASTE_DNA_SYSTEM,
    tool: tasteDNATool,
    toolName: "generate_taste_dna",
    userMessage: userPrompt,
  });

  if ("error" in result) {
    const status = result.code === "NO_API_KEY" ? 402 : 500;
    return NextResponse.json({ error: result.error, code: result.code }, { status });
  }

  const limited = limitTasteDNA(result.data as TasteDNA);
  if (!limited) {
    return NextResponse.json(
      { error: "The model returned an incomplete Taste DNA. Try again.", code: "PROVIDER_ERROR" },
      { status: 500 }
    );
  }

  const loggedTitles = [...watchLogs, ...listenLogs].map((l) => l.title);
  const observations = validateObservations(limited.observations, loggedTitles);
  if (observations.length === 0) {
    return NextResponse.json(
      { error: "The model returned no observations that match your logs. Try again.", code: "PROVIDER_ERROR" },
      { status: 500 }
    );
  }
  const dna: TasteDNA = { ...limited, observations };

  const { error: upsertError } = await supabase.from("taste_dna").upsert(
    {
      user_id: user.id,
      generated_at: new Date().toISOString(),
      model_version: result.model,
      fingerprint: dna.fingerprint,
      pulse: dna.pulse,
      observations: dna.observations,
      film_profile: dna.film_identity,
      music_profile: dna.music_identity,
      cross_domain: null,
      blind_spots: dna.blind_spots,
      guilty_pleasures: null,
      film_log_count: watchLogs.length,
      music_log_count: listenLogs.length,
    },
    { onConflict: "user_id" }
  );

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  return NextResponse.json(dna);
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [dnaRes, watchRes, listenRes] = await Promise.all([
    supabase.from("taste_dna").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("watch_logs").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("listen_logs").select("id", { count: "exact", head: true }).eq("user_id", user.id),
  ]);

  if (dnaRes.error) {
    console.error("taste_dna read failed:", dnaRes.error.message);
    return NextResponse.json({ error: dnaRes.error.message }, { status: 500 });
  }

  const data = dnaRes.data;
  if (!data) {
    return NextResponse.json(null);
  }

  const filmCount = data.film_log_count ?? 0;
  const musicCount = data.music_log_count ?? 0;
  const logsSince = Math.max(0, (watchRes.count ?? 0) + (listenRes.count ?? 0) - filmCount - musicCount);
  const pulse = Array.isArray(data.pulse) ? data.pulse : null;

  return NextResponse.json({
    fingerprint: data.fingerprint,
    pulse: pulse ?? [],
    observations: Array.isArray(data.observations) ? data.observations : [],
    generated_at: data.generated_at,
    film_log_count: filmCount,
    music_log_count: musicCount,
    logs_since: logsSince,
    needs_regenerate: !pulse || pulse.length === 0 || !Array.isArray(data.observations),
  });
}
