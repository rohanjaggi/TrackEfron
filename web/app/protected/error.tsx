"use client";

import Link from "next/link";
import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function ProtectedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center px-4 py-16 text-center">
      <div className="frame mb-5 flex h-14 w-14 items-center justify-center">
        <TriangleAlert className="size-6 text-muted-foreground" aria-hidden="true" />
      </div>
      <h1 className="t-voice-lg">
        This page didn&apos;t load.
      </h1>
      <p className="t-meta mx-auto mt-3 max-w-[46ch]">
        Something went wrong on our side. Nothing you&apos;ve logged is lost. Try again, and if
        it keeps happening, go back to your dashboard and come back in a minute.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-2.5">
        <Button onClick={() => reset()}>Try again</Button>
        <Button asChild variant="outline">
          <Link href="/protected">Go home</Link>
        </Button>
      </div>
    </div>
  );
}
