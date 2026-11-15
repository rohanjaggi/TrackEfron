import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardClient } from "@/components/dashboard-client";
import { PageLoading } from "@/components/ui/loading";
import { Suspense } from "react";

async function DashboardLoader() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/auth/login");
  }

  const fullName = user.user_metadata?.full_name;
  const userName = fullName || user.email?.split("@")[0] || "User";

  return <DashboardClient userName={userName} />;
}

export default function ProtectedPage() {
  return (
    <Suspense fallback={<PageLoading label="Loading your diary" />}>
      <DashboardLoader />
    </Suspense>
  );
}
