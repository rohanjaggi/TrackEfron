import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { syncProfile } from "@/lib/sync-profile";
import { ProfileClient } from "@/components/profile-client";
import { PageLoading } from "@/components/ui/loading";
import { Suspense } from "react";

async function ProfileLoader() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/auth/login");
  }

  // Keep profiles table in sync with auth metadata
  await syncProfile(supabase);

  const { data: spotifyRow } = await supabase
    .from("spotify_tokens")
    .select("spotify_user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const profile = {
    id: user.id,
    email: user.email || "",
    fullName: user.user_metadata?.full_name || "",
    username: user.user_metadata?.username || "",
    avatarUrl: user.user_metadata?.avatar_url || "",
    profileColor: user.user_metadata?.profile_color || "",
    createdAt: user.created_at,
    spotifyConnected: !!spotifyRow,
  };

  return <ProfileClient profile={profile} />;
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<PageLoading label="Loading your profile" />}>
      <ProfileLoader />
    </Suspense>
  );
}
