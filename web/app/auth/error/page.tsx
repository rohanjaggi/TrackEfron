import Link from "next/link";
import { Suspense } from "react";

import { AuthLink, AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";

async function ErrorReference({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  if (!params?.error) return null;

  return <p className="t-meta break-words">Reference: {params.error}</p>;
}

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <AuthShell
      title="That link didn't work"
      description="Nothing is lost. Your account and diary are untouched."
      footer={
        <>
          Resetting your password?{" "}
          <AuthLink href="/auth/forgot-password">Request a new link</AuthLink>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          Email links expire after a while and only work once. If you&apos;ve already confirmed
          your address, sign in as usual. If you were resetting your password, request a new link
          below.
        </p>
        <div className="flex flex-wrap gap-2.5">
          <Button asChild className="flex-1">
            <Link href="/auth/login">Sign in</Link>
          </Button>
          <Button asChild variant="outline" className="flex-1">
            <Link href="/">Go home</Link>
          </Button>
        </div>
        <Suspense>
          <ErrorReference searchParams={searchParams} />
        </Suspense>
      </div>
    </AuthShell>
  );
}
