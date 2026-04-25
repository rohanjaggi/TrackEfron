import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

function detectProvider(key: string): "anthropic" | "openai" | "gemini" | null {
  if (key.startsWith("sk-ant-")) return "anthropic";
  if (key.startsWith("AIza")) return "gemini";
  if (key.startsWith("sk-")) return "openai";
  return null;
}

function maskKey(key: string): string {
  if (key.length <= 8) return "****";
  return key.slice(0, 7) + "..." + key.slice(-4);
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY) {
    const provider = process.env.OPENAI_API_KEY ? "openai" : process.env.ANTHROPIC_API_KEY ? "anthropic" : "gemini";
    return NextResponse.json({
      hasKey: true,
      provider,
      maskedKey: null,
      source: "env",
    });
  }

  const { data } = await supabase
    .from("user_ai_settings")
    .select("ai_api_key")
    .eq("user_id", user.id)
    .single();

  if (data?.ai_api_key) {
    return NextResponse.json({
      hasKey: true,
      provider: detectProvider(data.ai_api_key),
      maskedKey: maskKey(data.ai_api_key),
      source: "byok",
    });
  }

  return NextResponse.json({
    hasKey: false,
    provider: null,
    maskedKey: null,
    source: "none",
  });
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { apiKey } = await request.json();
  if (!apiKey || typeof apiKey !== "string" || apiKey.length < 10) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 400 });
  }

  const provider = detectProvider(apiKey);
  if (!provider) {
    return NextResponse.json(
      { error: "Unrecognized key format. Use an Anthropic (sk-ant-...), OpenAI (sk-...), or Gemini (AIza...) key." },
      { status: 400 }
    );
  }

  const { error } = await supabase.from("user_ai_settings").upsert(
    {
      user_id: user.id,
      ai_api_key: apiKey,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    hasKey: true,
    provider,
    maskedKey: maskKey(apiKey),
    source: "byok",
  });
}

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await supabase
    .from("user_ai_settings")
    .delete()
    .eq("user_id", user.id);

  return NextResponse.json({
    hasKey: false,
    provider: null,
    maskedKey: null,
    source: "none",
  });
}
