import Link from "next/link";
import { Button } from "./ui/button";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "./logout-button";
import { User } from "lucide-react";

export async function AuthButton() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  // Get user metadata for name and avatar
  const fullName = user?.user_metadata?.full_name;
  const displayName = fullName || user?.email?.split("@")[0] || "User";
  const avatarUrl = user?.user_metadata?.avatar_url;

  return user ? (
    <div className="flex items-center gap-2">
      <Link
        href="/protected/profile"
        className="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-muted transition-colors"
        title="View Profile"
      >
        <div className="w-7 h-7 rounded-full overflow-hidden bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <User className="w-3.5 h-3.5" />
          )}
        </div>
        <span className="text-sm font-medium hidden sm:inline">{displayName}</span>
      </Link>
      <div className="w-px h-5 bg-border" />
      <LogoutButton />
    </div>
  ) : (
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
