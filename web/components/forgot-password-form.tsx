"use client";

import Link from "next/link";
import { useState } from "react";

import { AuthLink, AuthShell, authErrorMessage } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, Notice } from "@/components/ui/page";
import { createClient } from "@/lib/supabase/client";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const fallback = "We couldn't send the reset email. Try again in a moment.";
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      // The url which will be included in the email. This URL needs to be configured in your redirect URLs in the Supabase dashboard at https://supabase.com/dashboard/project/_/auth/url-configuration
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      });
      if (error) {
        setError(authErrorMessage(error, fallback));
        return;
      }
      setSuccess(true);
    } catch (err: unknown) {
      setError(authErrorMessage(err, fallback));
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <AuthShell
        title="Check your inbox"
        description="A reset link is on its way."
        footer={
          <>
            Wrong address?{" "}
            <Button
              variant="link"
              className="text-[12px] underline hover:text-foreground"
              onClick={() => setSuccess(false)}
            >
              Try another email
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-6">
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            If an account exists for <span className="break-all text-foreground">{email}</span>,
            we&apos;ve sent it a link to choose a new password. It can take a minute to arrive;
            check your spam folder if it doesn&apos;t.
          </p>
          <Button asChild size="lg" className="w-full">
            <Link href="/auth/login">Back to sign in</Link>
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Reset your password"
      description="Tell us your email and we'll send a link to choose a new one."
      footer={
        <>
          Remembered it? <AuthLink href="/auth/login">Sign in</AuthLink>
        </>
      }
    >
      <form onSubmit={handleForgotPassword} className="flex flex-col gap-5">
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        {error && <Notice tone="error">{error}</Notice>}
        <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
          {isLoading ? "Sending…" : "Send reset link"}
        </Button>
      </form>
    </AuthShell>
  );
}
