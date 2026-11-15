"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  AuthLink,
  AuthShell,
  PASSWORD_HINT,
  PASSWORD_MIN,
  authErrorMessage,
} from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/input";
import { Field, Notice } from "@/components/ui/page";
import { createClient } from "@/lib/supabase/client";

export function UpdatePasswordForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const fallback = "We couldn't save your new password. Try again in a moment.";
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setError(authErrorMessage(error, fallback));
        return;
      }
      // The user already has an active session, so go straight in.
      router.push("/protected");
    } catch (err: unknown) {
      setError(authErrorMessage(err, fallback));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell
      title="Choose a new password"
      description="Save it and you'll go straight back to your diary."
      footer={
        <>
          Link expired? <AuthLink href="/auth/forgot-password">Request a new one</AuthLink>
        </>
      }
    >
      <form onSubmit={handleUpdatePassword} className="flex flex-col gap-5">
        <Field label="New password" htmlFor="password" hint={PASSWORD_HINT}>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            required
            minLength={PASSWORD_MIN}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {error && <Notice tone="error">{error}</Notice>}
        <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
          {isLoading ? "Saving…" : "Save new password"}
        </Button>
      </form>
    </AuthShell>
  );
}
