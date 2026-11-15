import Link from "next/link";
import { Film } from "lucide-react";

import { Boundary } from "@/components/ui/boundary";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <Boundary
      fullPage
      icon={Film}
      title="This reel is missing."
      description={
        <>
          The page you asked for isn&apos;t in the archive. It may have been moved or removed, or
          the address has a typo.
        </>
      }
      actions={
        <>
          <Button asChild>
            <Link href="/">Go home</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/protected">Open your diary</Link>
          </Button>
        </>
      }
    />
  );
}
