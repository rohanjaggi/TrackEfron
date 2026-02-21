import Link from "next/link";
import { Button } from "./ui/button";
import { createClient } from "@/lib/supabase/server";
import { AuthButtonClient } from "./auth-button-client";

export async function AuthButton() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="flex gap-2">
        <Button asChild size="sm" variant={"outline"}>
          <Link href="/auth/login">Sign in</Link>
        </Button>
        <Button asChild size="sm" variant={"default"}>
          <Link href="/auth/sign-up">Sign up</Link>
        </Button>
      </div>
    );
  }

  const fullName = user.user_metadata?.full_name;
  const displayName = fullName || user.email?.split("@")[0] || "User";
  const avatarUrl = user.user_metadata?.avatar_url;

  return (
    <AuthButtonClient
      displayName={displayName}
      avatarUrl={avatarUrl || null}
    />
  );
}
