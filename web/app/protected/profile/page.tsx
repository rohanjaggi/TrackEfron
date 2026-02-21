import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { syncProfile } from "@/lib/sync-profile";
import { ProfileClient } from "@/components/profile-client";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";

async function ProfileLoader() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/auth/login");
  }

  // Keep profiles table in sync with auth metadata
  await syncProfile(supabase);

  const profile = {
    id: user.id,
    email: user.email || "",
    fullName: user.user_metadata?.full_name || "",
    username: user.user_metadata?.username || "",
    avatarUrl: user.user_metadata?.avatar_url || "",
    profileColor: user.user_metadata?.profile_color || "",
    createdAt: user.created_at,
  };

  return <ProfileClient profile={profile} />;
}

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <ProfileLoader />
    </Suspense>
  );
}
