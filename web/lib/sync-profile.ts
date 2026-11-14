import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Copies the signed-in user's account details into the public `profiles` row
 * that friend search and profile pages read. Returns whether it worked, so a
 * caller that just saved can tell the user if their public profile is stale.
 */
export async function syncProfile(supabase: SupabaseClient): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      username: user.user_metadata?.username || "",
      full_name: user.user_metadata?.full_name || "",
      avatar_url: user.user_metadata?.avatar_url || null,
      profile_color: user.user_metadata?.profile_color || null,
    },
    { onConflict: "id" }
  );
  return !error;
}
