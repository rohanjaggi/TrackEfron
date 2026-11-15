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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, PasswordInput } from "@/components/ui/input";
import { Field, Notice } from "@/components/ui/page";
import { createClient } from "@/lib/supabase/client";

const USERNAME_MIN = 3;

// Only lowercase letters, numbers and underscores.
const validateUsername = (value: string) => /^[a-z0-9_]+$/.test(value);

/** The rule the submit handler enforces, as a message. Null when the username passes. */
function usernameProblem(value: string, checkLength: boolean): string | null {
  if (value && !validateUsername(value)) {
    return "Use lowercase letters, numbers and underscores only.";
  }
  if (checkLength && value.trim().length < USERNAME_MIN) {
    return `Username must be at least ${USERNAME_MIN} characters.`;
  }
  return null;
}

function keyProvider(key: string): string {
  if (key.startsWith("sk-ant-")) return "Anthropic";
  if (key.startsWith("AIza")) return "Gemini";
  if (key.startsWith("sk-")) return "OpenAI";
  return "Unknown";
}

export function SignUpForm() {
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [aiApiKey, setAiApiKey] = useState("");
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [repeatTouched, setRepeatTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const nameError = submitted && !fullName.trim() ? "Enter your name." : null;
  const usernameError = usernameProblem(username, usernameTouched || submitted);
  const repeatError =
    (repeatTouched || submitted) && repeatPassword && password !== repeatPassword
      ? "These passwords don't match."
      : null;

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setError(null);

    // Field-level problems are shown at the field; send focus to the first one.
    const firstInvalid = !fullName.trim()
      ? "fullName"
      : usernameProblem(username, true)
        ? "username"
        : password !== repeatPassword
          ? "repeat-password"
          : null;
    if (firstInvalid) {
      document.getElementById(firstInvalid)?.focus();
      return;
    }

    const fallback = "We couldn't create your account. Try again in a moment.";
    setIsLoading(true);

    try {
      const supabase = createClient();
      const metadata: Record<string, string> = {
        full_name: fullName.trim(),
        username: username.toLowerCase().trim(),
      };
      if (aiApiKey.trim()) {
        metadata.ai_api_key = aiApiKey.trim();
      }
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/protected`,
          data: metadata,
        },
      });
      if (error) {
        setError(authErrorMessage(error, fallback));
        return;
      }
      router.push("/auth/sign-up-success");
    } catch (err: unknown) {
      setError(authErrorMessage(err, fallback));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell
      title="Sign up"
      description="Start a diary of the films, shows and music you love."
      footer={
        <>
          Already have an account? <AuthLink href="/auth/login">Sign in</AuthLink>
        </>
      }
    >
      <form onSubmit={handleSignUp} className="flex flex-col gap-5">
        <Field label="Name" htmlFor="fullName" error={nameError}>
          <Input
            id="fullName"
            name="name"
            type="text"
            autoComplete="name"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </Field>
        <Field
          label="Username"
          htmlFor="username"
          hint="At least 3 characters: lowercase letters, numbers and underscores."
          error={usernameError}
        >
          <Input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            onBlur={() => setUsernameTouched(true)}
          />
        </Field>
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
        <Field label="Password" htmlFor="password" hint={PASSWORD_HINT}>
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
        <Field label="Repeat password" htmlFor="repeat-password" error={repeatError}>
          <PasswordInput
            id="repeat-password"
            name="repeat-password"
            autoComplete="new-password"
            required
            value={repeatPassword}
            onChange={(e) => setRepeatPassword(e.target.value)}
            onBlur={() => setRepeatTouched(true)}
          />
        </Field>
        <Field
          label="AI API key (optional)"
          htmlFor="ai-api-key"
          hint="Paste an Anthropic, OpenAI or Gemini key to turn on AI features. You can add it later in your profile settings."
        >
          <div className="relative">
            <Input
              id="ai-api-key"
              name="ai-api-key"
              type="password"
              autoComplete="off"
              spellCheck={false}
              aria-describedby="ai-api-key-hint"
              className={aiApiKey ? "pr-28" : undefined}
              value={aiApiKey}
              onChange={(e) => setAiApiKey(e.target.value)}
            />
            {aiApiKey && (
              <Badge className="absolute right-2.5 top-1/2 -translate-y-1/2">
                {keyProvider(aiApiKey)}
              </Badge>
            )}
          </div>
        </Field>
        {error && <Notice tone="error">{error}</Notice>}
        <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
          {isLoading ? "Creating your account…" : "Sign up"}
        </Button>
      </form>
    </AuthShell>
  );
}
