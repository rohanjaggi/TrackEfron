"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LayoutGrid, List } from "lucide-react";

type ViewType = "grid" | "list";

const mockItems = [
  {
    id: 1,
    title: "Breaking Bad",
    type: "TV Show",
    year: 2008,
    rating: 9.5,
    reviewed: true,
  },
  {
    id: 2,
    title: "Inception",
    type: "Movie",
    year: 2010,
    rating: 9,
    reviewed: true,
  },
  {
    id: 3,
    title: "The Office",
    type: "TV Show",
    year: 2005,
    rating: 8.5,
    reviewed: false,
  },
];

export default function LibraryPage() {
  const [viewType, setViewType] = useState<ViewType>("grid");

  return (
    <div className="flex-1 flex flex-col gap-8 py-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">Your Library</h1>
          <p className="text-muted-foreground">
            {mockItems.length} item{mockItems.length !== 1 ? "s" : ""} watched
          </p>
        </div>

        <div className="flex gap-2 bg-card border border-border rounded-lg p-1">
          <Button
            variant={viewType === "grid" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewType("grid")}
            className="gap-2"
          >
            <LayoutGrid size={16} />
            <span className="hidden sm:inline">Grid</span>
          </Button>
          <Button
            variant={viewType === "list" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewType("list")}
            className="gap-2"
          >
            <List size={16} />
            <span className="hidden sm:inline">List</span>
          </Button>
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
  );
}
