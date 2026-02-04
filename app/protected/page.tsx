import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardClient } from "@/components/dashboard-client";
import { Suspense } from "react";

async function getUserName() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect("/auth/login");
  }

  const email = data.claims.email as string;
  return email.split("@")[0];
}

export default async function ProtectedPage() {
  const userName = await getUserName();

  return (
    <div className="flex-1 flex flex-col gap-8 py-8">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab("home")}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === "home"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Home
        </button>
        <button
          onClick={() => setActiveTab("library")}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === "library"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Library
        </button>
      </div>

      {/* Home Tab */}
      {activeTab === "home" && (
        <div className="flex flex-col gap-12">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
              Welcome back, {userName}!
            </h1>
            <p className="text-muted-foreground">
              Track, review, and discover your next favorite show or movie
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Continue Watching */}
            <div className="bg-card rounded-lg border border-border p-6">
              <h2 className="font-semibold text-lg mb-4">Continue Watching</h2>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground mb-4">
                  You haven't added any shows or movies yet
                </p>
                <Button
                  onClick={() => setActiveTab("library")}
                  className="w-full bg-primary hover:bg-primary/90"
                >
                  Add to Your Library
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
                <Button
                  onClick={() => setActiveTab("library")}
                  variant="outline"
                  className="w-full"
                >
                  Browse Library
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
      )}

      {/* Library Tab */}
      {activeTab === "library" && (
        <div className="flex flex-col gap-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold mb-1">Your Library</h2>
              <p className="text-muted-foreground">
                {mockItems.length} item{mockItems.length !== 1 ? "s" : ""} watched
              </p>
            </div>

            <div className="flex gap-2 bg-card border border-border rounded-lg p-1">
              <button
                onClick={() => setViewType("grid")}
                className={`p-2 rounded transition-colors ${
                  viewType === "grid"
                    ? "bg-primary/20 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Grid view"
              >
                <LayoutGrid size={16} />
              </button>
              <button
                onClick={() => setViewType("list")}
                className={`p-2 rounded transition-colors ${
                  viewType === "list"
                    ? "bg-primary/20 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="List view"
              >
                <List size={16} />
              </button>
            </div>
          </div>

          {mockItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="text-4xl mb-4">📺</div>
              <h2 className="text-xl font-semibold mb-2">No items yet</h2>
              <p className="text-muted-foreground mb-6">
                Start adding movies and shows to your library
              </p>
              <Button className="bg-primary hover:bg-primary/90">
                Add Your First Item
              </Button>
            </div>
          ) : viewType === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {mockItems.map((item) => (
                <div
                  key={item.id}
                  className="group bg-card rounded-lg border border-border overflow-hidden hover:border-primary/50 transition-colors cursor-pointer"
                >
                  <div className="aspect-[2/3] bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center group-hover:from-primary/40 group-hover:to-accent/40 transition-colors">
                    <span className="text-4xl">🎬</span>
                  </div>
                  <div className="p-4 space-y-2">
                    <h3 className="font-semibold line-clamp-2">{item.title}</h3>
                    <p className="text-xs text-muted-foreground">
                      {item.type} • {item.year}
                    </p>
                    <div className="flex items-center gap-2 pt-2 border-t border-border">
                      <span className="text-sm font-medium">★ {item.rating}</span>
                      {item.reviewed && (
                        <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded">
                          Reviewed
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {mockItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-4 p-4 bg-card rounded-lg border border-border hover:border-primary/50 transition-colors cursor-pointer"
                >
                  <div className="w-16 h-24 bg-gradient-to-br from-primary/30 to-accent/30 rounded flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl">🎬</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold mb-1">{item.title}</h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      {item.type} • {item.year}
                    </p>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-sm font-medium">★ {item.rating}</span>
                      {item.reviewed && (
                        <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded">
                          Reviewed
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      View
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
