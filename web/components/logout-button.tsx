"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();
  const toast = useToast();

  const logout = async () => {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        tone: "error",
        title: "We couldn't sign you out. Check your connection and try again.",
      });
      return;
    }
    router.push("/auth/login");
  };

  return (
    <Button onClick={logout} variant="outline">
      Sign out
    </Button>
  );
}
