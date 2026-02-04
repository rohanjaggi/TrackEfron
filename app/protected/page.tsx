import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardClient } from "@/components/dashboard-client";
import { Suspense } from "react";

async function getUserName() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/auth/login");
  }

  // Get name from user metadata, fallback to email prefix
  const fullName = user.user_metadata?.full_name;
  return fullName || user.email?.split("@")[0] || "User";
}

export default async function ProtectedPage() {
  const userName = await getUserName();

  return (
    <Suspense>
      <DashboardClient userName={userName} />
    </Suspense>
  );
}
