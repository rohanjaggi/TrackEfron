"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { AuthLink, AuthShell, EmailField, authErrorMessage } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/input";
import { Field, Notice } from "@/components/ui/page";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const fallback = "We couldn't sign you in. Try again in a moment.";
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(authErrorMessage(error, fallback));
        return;
      }
      router.push("/protected");
    } catch (err: unknown) {
      setError(authErrorMessage(err, fallback));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell
      title="Sign in"
      description="Pick up your diary where you left it."
      footer={
        <>
          New to TrackEfron? <AuthLink href="/auth/sign-up">Sign up</AuthLink>
        </>
      }
    >
      <form onSubmit={handleLogin} className="flex flex-col gap-5">
        <EmailField value={email} onChange={setEmail} />
        <Field label="Password" htmlFor="password">
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="t-meta">
            <AuthLink href="/auth/forgot-password">Forgot your password?</AuthLink>
          </p>
        </Field>
        {error && <Notice tone="error">{error}</Notice>}
        <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
          {isLoading ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthShell>
  );
}
