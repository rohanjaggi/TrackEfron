"use client";

import Link from "next/link";
import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";

import { Boundary } from "@/components/ui/boundary";
import { Button } from "@/components/ui/button";

export default function GlobalError({
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
    <Boundary
      fullPage
      icon={TriangleAlert}
      title="The projector jammed."
      description={
        <>
          Something went wrong while loading this page. Nothing you&apos;ve logged is lost. Try
          again, and if it keeps happening, head home and come back in a minute.
        </>
      }
      actions={
        <>
          <Button onClick={() => reset()}>Try again</Button>
          <Button asChild variant="outline">
            <Link href="/">Go home</Link>
          </Button>
        </>
      }
    />
  );
}
