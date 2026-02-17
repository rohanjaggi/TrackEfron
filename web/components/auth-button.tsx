import Link from "next/link";
import { Button } from "./ui/button";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "./logout-button";
import { User } from "lucide-react";

export async function AuthButton() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  // Get user metadata for name
  const fullName = user?.user_metadata?.full_name;
  const displayName = fullName || user?.email?.split("@")[0] || "User";

  return user ? (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground hidden sm:inline">
        Hey, <span className="text-foreground font-medium">{displayName}</span>!
      </span>
      <Link 
        href="/protected/profile"
        className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center hover:from-primary/30 hover:to-accent/30 transition-colors"
        title="View Profile"
      >
        <User className="w-4 h-4" />
      </Link>
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
