import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileClient } from "@/components/profile-client";

async function getUserProfile() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/auth/login");
  }

  return {
    id: user.id,
    email: user.email || "",
    fullName: user.user_metadata?.full_name || "",
    username: user.user_metadata?.username || "",
    avatarUrl: user.user_metadata?.avatar_url || "",
    profileColor: user.user_metadata?.profile_color || "",
    createdAt: user.created_at,
  };
}

export default async function ProfilePage() {
  const profile = await getUserProfile();

  return <ProfileClient profile={profile} />;
}
