import { requireUser } from "@/lib/api/auth";
import { NextResponse } from "next/server";
import { detectProvider, envProvider, type Provider } from "@/lib/ai/detect-provider";

function maskKey(key: string): string {
  if (key.length <= 8) return "****";
  return key.slice(0, 7) + "..." + key.slice(-4);
}

type KeyState = { hasKey: boolean; provider: Provider | null; maskedKey: string | null; source: "byok" | "env" | "none" };

const keyState = (state: KeyState) => NextResponse.json(state);
const noKey = () => keyState({ hasKey: false, provider: null, maskedKey: null, source: "none" });

export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { supabase, user } = auth;

  const { data } = await supabase
    .from("user_ai_settings")
    .select("ai_api_key")
    .eq("user_id", user.id)
    .single();

  // Same precedence as callAI: the user's own key, then a server key.
  if (data?.ai_api_key) {
    return keyState({
      hasKey: true,
      provider: detectProvider(data.ai_api_key),
      maskedKey: maskKey(data.ai_api_key),
      source: "byok",
    });
  }

  const env = envProvider();
  if (env) {
    return keyState({ hasKey: true, provider: env.provider, maskedKey: null, source: "env" });
  }

  return noKey();
}

export async function PUT(request: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { supabase, user } = auth;

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

  return keyState({ hasKey: true, provider, maskedKey: maskKey(apiKey), source: "byok" });
}

export async function DELETE() {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { supabase, user } = auth;

  const { error } = await supabase
    .from("user_ai_settings")
    .delete()
    .eq("user_id", user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return noKey();
}
