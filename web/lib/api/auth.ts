import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

type Authed = { supabase: ServerSupabase; user: { id: string }; response?: undefined };
type Denied = { response: NextResponse; supabase?: undefined; user?: undefined };

/** The signed-in user and their Supabase client, or the 401 response to return. */
export async function requireUser(): Promise<Authed | Denied> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { supabase, user };
}
