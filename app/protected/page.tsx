import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardClient } from "@/components/dashboard-client";
import { Suspense } from "react";

async function getUserName() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect("/auth/login");
  }

  const email = data.claims.email as string;
  return email.split("@")[0];
}

export default async function ProtectedPage() {
  const userName = await getUserName();

  return (
    <Suspense>
      <DashboardClient userName={userName} />
    </Suspense>
  );
}
