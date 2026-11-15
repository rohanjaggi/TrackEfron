"use client";

import Link from "next/link";
import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";

import { Boundary } from "@/components/ui/boundary";
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
    <Boundary
      icon={TriangleAlert}
      title="This page didn't load."
      description={
        <>
          Something went wrong on our side. Nothing you&apos;ve logged is lost. Try again, and if
          it keeps happening, go back to your dashboard and come back in a minute.
        </>
      }
      actions={
        <>
          <Button onClick={() => reset()}>Try again</Button>
          <Button asChild variant="outline">
            <Link href="/protected">Go home</Link>
          </Button>
        </>
      }
    />
  );
}
