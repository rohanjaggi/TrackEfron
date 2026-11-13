import Link from "next/link";

import { AuthLink, AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";

export default function Page() {
  return (
    <AuthShell
      title="Check your inbox"
      description="One more step and your diary is open."
      footer={
        <>
          Used the wrong email? <AuthLink href="/auth/sign-up">Sign up again</AuthLink>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          Your account is created. We&apos;ve sent a confirmation link to your email: open it to
          confirm your address, then sign in. It can take a minute to arrive; check your spam
          folder if it doesn&apos;t.
        </p>
        <Button asChild size="lg" className="w-full">
          <Link href="/auth/login">Sign in</Link>
        </Button>
      </div>
    </AuthShell>
  );
}
