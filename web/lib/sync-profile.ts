import { SupabaseClient } from "@supabase/supabase-js";

export async function syncProfile(supabase: SupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("profiles").upsert(
    {
      id: user.id,
      username: user.user_metadata?.username || "",
      full_name: user.user_metadata?.full_name || "",
      avatar_url: user.user_metadata?.avatar_url || null,
      profile_color: user.user_metadata?.profile_color || null,
    },
    { onConflict: "id" }
  );
}
