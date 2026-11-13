import Link from "next/link";
import { Film } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-svh w-full flex-col items-center justify-center px-4 py-16 text-center">
      <div className="frame mb-5 flex h-14 w-14 items-center justify-center">
        <Film className="size-6 text-muted-foreground" aria-hidden="true" />
      </div>
      <h1 className="font-display text-[30px] font-light italic leading-[1.1] tracking-[-0.01em] text-foreground">
        This reel is missing.
      </h1>
      <p className="t-meta mx-auto mt-3 max-w-[46ch]">
        The page you asked for isn&apos;t in the archive. It may have been moved or removed, or
        the address has a typo.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-2.5">
        <Button asChild>
          <Link href="/">Go home</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/protected">Open your diary</Link>
        </Button>
      </div>
    </main>
  );
}
