import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";

export async function POST() {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { supabase, user } = auth;

  const { error: deleteError } = await supabase.from("spotify_tokens").delete().eq("user_id", user.id);
  if (deleteError) {
    console.error("spotify disconnect failed:", deleteError.message);
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
