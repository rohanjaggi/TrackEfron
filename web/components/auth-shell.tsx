"use client";

import * as React from "react";
import Link from "next/link";

import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/page";
import { cn } from "@/lib/utils";

/** The shortest password the sign-up and reset forms accept, and the hint that says so. */
export const PASSWORD_MIN = 6;
export const PASSWORD_HINT = `At least ${PASSWORD_MIN} characters.`;

/**
 * The one composition every auth page shares: wordmark linking home, then a
 * single raised panel holding the title, a one-line description, the form
 * (or message) and a footer line with the alternate action.
 */
export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main className="flex min-h-svh w-full flex-col items-center justify-center px-4 py-12 sm:py-16">
      <Link href="/" className="mb-8 flex items-center gap-3">
        { }
        <img src="/images/logo.png" alt="" className="h-9 w-9 object-contain" />
        <span className="wordmark text-[24px]">
          TrackEfron
        </span>
      </Link>

      <div className="frame frame-accent frame-raised w-full max-w-[420px] px-5 py-8 sm:px-8">
        <h1 className="t-voice-lg">
          {title}
        </h1>
        {description && <p className="t-meta mt-2.5">{description}</p>}
        <div className="mt-7">{children}</div>
        {footer && (
          <p className="t-meta mt-7 border-t border-border pt-5 text-center">{footer}</p>
        )}
      </div>
    </main>
  );
}

/** Text link used in auth footers and beside fields. */
export function AuthLink({
  className,
  ...props
}: React.ComponentProps<typeof Link>) {
  return (
    <Link
      className={cn(
        "text-primary underline transition-colors duration-cut ease-mech hover:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

/** The email row shared by the sign-in and reset forms. */
export function EmailField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
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
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

function readString(source: unknown, key: string): string {
  if (typeof source !== "object" || source === null) return "";
  const value = (source as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

/**
 * Turn a Supabase auth error into a plain sentence with a next step.
 * Never returns the raw message or code; unknown errors get `fallback`.
 */
export function authErrorMessage(error: unknown, fallback: string): string {
  const code = readString(error, "code");
  const name = readString(error, "name");
  const message = readString(error, "message").toLowerCase();
  const status =
    typeof error === "object" && error !== null
      ? (error as Record<string, unknown>).status
      : undefined;

  if (
    name === "AuthRetryableFetchError" ||
    status === 0 ||
    message.includes("failed to fetch") ||
    message.includes("network") ||
    message.includes("load failed")
  ) {
    return "We couldn't reach TrackEfron. Check your connection and try again.";
  }
  if (
    status === 429 ||
    code.startsWith("over_") ||
    message.includes("rate limit") ||
    message.includes("for security purposes")
  ) {
    return "Too many attempts. Wait a minute, then try again.";
  }
  if (code === "invalid_credentials" || message.includes("invalid login credentials")) {
    return "That email and password don't match. Try again or reset your password.";
  }
  if (code === "email_not_confirmed" || message.includes("email not confirmed")) {
    return "Your email isn't confirmed yet. Open the confirmation link we sent you, then sign in.";
  }
  if (
    code === "user_already_exists" ||
    code === "email_exists" ||
    message.includes("already registered")
  ) {
    return "An account with this email already exists. Sign in instead.";
  }
  if (code === "weak_password" || message.includes("password should be")) {
    return "That password is too short or too easy to guess. Choose a longer one.";
  }
  if (code === "same_password" || message.includes("different from the old password")) {
    return "That's your current password. Choose a different one.";
  }
  if (
    code === "session_not_found" ||
    code === "otp_expired" ||
    name === "AuthSessionMissingError" ||
    message.includes("session missing")
  ) {
    return "This reset link has expired or was already used. Request a new one.";
  }
  if (
    code === "email_address_invalid" ||
    code === "email_address_not_authorized" ||
    message.includes("invalid email") ||
    (message.includes("email address") && message.includes("invalid"))
  ) {
    return "That email address doesn't look right. Check it and try again.";
  }
  if (code === "signup_disabled" || message.includes("signups not allowed")) {
    return "New accounts are closed for the moment. Try again later.";
  }
  return fallback;
}
