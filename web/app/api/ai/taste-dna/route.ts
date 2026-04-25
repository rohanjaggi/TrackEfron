import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { callAI } from "@/lib/ai/provider";
import { tasteDNATool } from "@/lib/ai/tools";
import { TASTE_DNA_SYSTEM, buildTasteDNAUserPrompt } from "@/lib/ai/prompts";
import type { TasteDNA } from "@/lib/ai/types";

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

  const dna = result.data as TasteDNA;

  const { error: upsertError } = await supabase.from("taste_dna").upsert(
    {
      user_id: user.id,
      generated_at: new Date().toISOString(),
      model_version: result.model,
      fingerprint: dna.fingerprint,
      film_profile: dna.film_identity,
      music_profile: dna.music_identity,
      cross_domain: dna.cross_domain,
      blind_spots: dna.blind_spots,
      guilty_pleasures: dna.guilty_pleasures,
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

  const { data } = await supabase
    .from("taste_dna")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!data) {
    return NextResponse.json(null);
  }

  return NextResponse.json({
    fingerprint: data.fingerprint,
    film_identity: data.film_profile,
    music_identity: data.music_profile,
    cross_domain: data.cross_domain,
    blind_spots: data.blind_spots,
    guilty_pleasures: data.guilty_pleasures,
    generated_at: data.generated_at,
    film_log_count: data.film_log_count,
    music_log_count: data.music_log_count,
  });
}
