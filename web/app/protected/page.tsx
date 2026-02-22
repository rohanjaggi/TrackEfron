import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardClient } from "@/components/dashboard-client";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";

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
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <DashboardLoader />
    </Suspense>
  );
}
