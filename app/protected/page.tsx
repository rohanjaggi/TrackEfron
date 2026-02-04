import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Suspense } from "react";

async function UserGreeting() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect("/auth/login");
  }

  const email = data.claims.email as string;
  const userName = email.split("@")[0];

  return (
    <>
      <div className="space-y-2 mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
          Welcome back, {userName}!
        </h1>
        <p className="text-muted-foreground">
          Track, review, and discover your next favorite show or movie
        </p>
      </div>
    </>
  );
}

export default function ProtectedPage() {
  return (
    <div className="flex-1 flex flex-col gap-12 py-8">
      <Suspense>
        <UserGreeting />
      </Suspense>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Continue Watching */}
        <div className="bg-card rounded-lg border border-border p-6">
          <h2 className="font-semibold text-lg mb-4">Continue Watching</h2>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground mb-4">
              You haven't added any shows or movies yet
            </p>
            <Button asChild className="w-full bg-primary hover:bg-primary/90">
              <Link href="/protected/library">Add to Your Library</Link>
            </Button>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-card rounded-lg border border-border p-6">
          <h2 className="font-semibold text-lg mb-4">Recent Reviews</h2>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground mb-4">
              No reviews yet. Start watching and sharing your thoughts!
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/protected/library">Browse Library</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-card rounded-lg border border-border p-4">
          <div className="text-2xl font-bold text-primary">0</div>
          <p className="text-sm text-muted-foreground mt-1">Watched</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-4">
          <div className="text-2xl font-bold text-accent">0</div>
          <p className="text-sm text-muted-foreground mt-1">Reviews</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-4">
          <div className="text-2xl font-bold text-secondary">0</div>
          <p className="text-sm text-muted-foreground mt-1">Rating</p>
        </div>
      </div>
    </div>
  );
}
