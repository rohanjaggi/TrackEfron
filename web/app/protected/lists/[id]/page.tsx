"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Search,
  Plus,
  Star,
  Film,
  Tv,
  Trash2,
  Pencil,
  Check,
  X,
  Loader2,
  Disc3,
  Music2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type ListMeta = {
  id: string;
  name: string;
  description: string | null;
  emoji: string | null;
  list_type: "film" | "music";
  created_at: string;
  updated_at: string;
};

type ListItem = {
  id: string;
  tmdb_id: number | null;
  spotify_id: string | null;
  artist: string | null;
  title: string;
  media_type: string;
  poster_url: string | null;
  image_url: string | null;
  added_at: string;
  position: number;
};

type SearchResult = {
  id: number | string;
  spotify_id?: string;
  artist?: string;
  album_name?: string;
  title?: string;
  name?: string;
  media_type: "movie" | "tv" | "album" | "track";
  release_date?: string;
  first_air_date?: string;
  poster_url?: string | null;
  image_url?: string | null;
  vote_average?: number;
};

function upscalePoster(url: string | null, size = "w500"): string | null {
  if (!url) return null;
  return url.replace(/\/w\d+\//, `/${size}/`);
}

export default function ListDetailPage() {
  return (
    <Suspense>
      <ListDetailContent />
    </Suspense>
  );
}

function ListDetailContent() {
  const router = useRouter();
  const params = useParams();
  const listId = params.id as string;
  const searchRef = useRef<HTMLDivElement>(null);

  const [list, setList] = useState<ListMeta | null>(null);
  const [items, setItems] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const isMusic = list?.list_type === "music";

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete list state
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Add items search state
  const [addQuery, setAddQuery] = useState("");
  const [addResults, setAddResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showAddDropdown, setShowAddDropdown] = useState(false);
  const [addingId, setAddingId] = useState<number | string | null>(null);

  useEffect(() => {
    fetchListData();
  }, [listId]);

  async function fetchListData() {
    try {
      setLoading(true);
      const supabase = createClient();

      const [listRes, itemsRes] = await Promise.all([
        supabase.from("lists").select("*").eq("id", listId).single(),
        supabase
          .from("list_items")
          .select("*")
          .eq("list_id", listId)
          .order("position", { ascending: true })
          .order("added_at", { ascending: false }),
      ]);

      if (listRes.error) throw listRes.error;
      setList(listRes.data);
      setEditName(listRes.data.name);
      setEditDescription(listRes.data.description || "");
      setItems(itemsRes.data || []);
    } catch {
      router.push("/protected/watchlist?tab=lists");
    } finally {
      setLoading(false);
    }
  }

  // Debounced search
  useEffect(() => {
    const q = addQuery.trim();
    if (!q) {
      setAddResults([]);
      setShowAddDropdown(false);
      return;
    }

    const t = setTimeout(async () => {
      try {
        setIsSearching(true);
        if (isMusic) {
          const res = await fetch(`/api/spotify?action=search&q=${encodeURIComponent(q)}&type=album,track`);
          const raw = await res.json();
          const data: SearchResult[] = Array.isArray(raw)
            ? raw.map((r: any) => ({
                id: r.id,
                spotify_id: r.id,
                name: r.name,
                artist: r.artist,
                album_name: r.album_name,
                media_type: r.type as "album" | "track",
                release_date: r.release_date,
                image_url: r.image_url,
              }))
            : [];
          setAddResults(data);
        } else {
          const res = await fetch(`/api?action=search&q=${encodeURIComponent(q)}`);
          const data = await res.json();
          if (Array.isArray(data)) {
            setAddResults(data);
          }
        }
        setShowAddDropdown(true);
      } catch {
        // silently fail
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => clearTimeout(t);
  }, [addQuery, isMusic]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowAddDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleAddItem(result: SearchResult) {
    setAddingId(result.spotify_id || result.id);
    try {
      const supabase = createClient();

      if (isMusic) {
        const { error } = await supabase.from("list_items").insert({
          list_id: listId,
          spotify_id: result.spotify_id || String(result.id),
          title: result.name || result.title || "Untitled",
          artist: result.artist || null,
          media_type: result.media_type,
          image_url: result.image_url || null,
          position: items.length,
        });
        if (error && error.code !== "23505") throw error;
      } else {
        const { error } = await supabase.from("list_items").insert({
          list_id: listId,
          tmdb_id: result.id,
          title: result.title || result.name || "Untitled",
          media_type: result.media_type,
          poster_url: result.poster_url || null,
          position: items.length,
        });
        if (error && error.code !== "23505") throw error;
      }

      await supabase
        .from("lists")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", listId);

      setAddQuery("");
      setShowAddDropdown(false);
      await fetchListData();
    } catch {
      // silently fail
    } finally {
      setAddingId(null);
    }
  }

  async function handleRemoveItem(itemId: string) {
    const prev = items;
    setItems(items.filter((i) => i.id !== itemId));
    try {
      const supabase = createClient();
      await supabase.from("list_items").delete().eq("id", itemId);
    } catch {
      setItems(prev);
    }
  }

  async function handleSaveEdit() {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("lists")
        .update({
          name: editName.trim(),
          description: editDescription.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", listId);

      if (error) throw error;
      setList((prev) =>
        prev ? { ...prev, name: editName.trim(), description: editDescription.trim() || null } : prev
      );
      setIsEditing(false);
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteList() {
    setDeleting(true);
    try {
      const supabase = createClient();
      await supabase.from("lists").delete().eq("id", listId);
      router.push("/protected/watchlist?tab=lists");
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  const existingIds = new Set(
    items.map((i) => i.spotify_id || String(i.tmdb_id))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!list) return null;

  return (
    <div className="flex flex-col gap-8">
      {/* Back Link */}
      <button
        onClick={() => router.push("/protected/watchlist?tab=lists")}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to My Lists
      </button>

      {/* List Header */}
      <div className="border-2 border-border p-6">
        {isEditing ? (
          <div className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Name</label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="bg-card border-2 border-border text-lg font-semibold"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Description</label>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={2}
                className="flex w-full rounded-md border-2 border-border bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveEdit} disabled={saving || !editName.trim()}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Check className="w-4 h-4 mr-1" />}
                Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setIsEditing(false);
                  setEditName(list.name);
                  setEditDescription(list.description || "");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <span className="text-4xl">{list.emoji || (isMusic ? "🎵" : "🎬")}</span>
              <div>
                <h1 className="font-display text-2xl md:text-3xl font-bold">{list.name}</h1>
                {list.description && (
                  <p className="text-muted-foreground mt-1">{list.description}</p>
                )}
                <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    {isMusic ? <Music2 className="w-3.5 h-3.5" /> : <Film className="w-3.5 h-3.5" />}
                    {items.length} {items.length === 1 ? "title" : "titles"}
                  </span>
                  <span>Created {new Date(list.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="text-muted-foreground hover:text-foreground"
              >
                <Pencil className="w-4 h-4" />
              </Button>
              {confirmDelete ? (
                <div className="flex items-center gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDeleteList}
                    disabled={deleting}
                  >
                    {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Trash2 className="w-4 h-4 mr-1" />}
                    Confirm
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmDelete(false)}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmDelete(true)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add Items Search */}
      <div ref={searchRef} className="relative border-2 border-primary/30 bg-primary/5 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Plus className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-primary">Add to List</span>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={isMusic ? "Search for an album or track..." : "Search for a movie or TV show..."}
            value={addQuery}
            onChange={(e) => setAddQuery(e.target.value)}
            onFocus={() => addResults.length > 0 && setShowAddDropdown(true)}
            className="pl-10 py-5 text-base bg-card border-2 border-border"
          />
          {isSearching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
          )}
        </div>

        {showAddDropdown && addResults.length > 0 && (
          <div className="absolute left-5 right-5 z-50 border-2 border-border bg-card max-h-72 overflow-auto shadow-lg">
            {addResults.slice(0, 8).map((result) => {
              const label = result.title || result.name || "Untitled";
              const year = (result.release_date || result.first_air_date || "").slice(0, 4);
              const resultKey = result.spotify_id || String(result.id);
              const alreadyAdded = existingIds.has(resultKey);
              const resultIsMusic = result.media_type === "album" || result.media_type === "track";
              return (
                <div
                  key={`${result.media_type}-${resultKey}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors"
                >
                  {(result.poster_url || result.image_url) ? (
                    <img
                      src={resultIsMusic ? (result.image_url || result.poster_url)! : result.poster_url!}
                      alt={label}
                      className={`${resultIsMusic ? "w-10 h-10 rounded" : "w-8 h-12 rounded"} object-cover shrink-0`}
                    />
                  ) : (
                    <div className={`${resultIsMusic ? "w-10 h-10" : "w-8 h-12"} bg-muted/50 rounded flex items-center justify-center shrink-0`}>
                      {resultIsMusic
                        ? <Disc3 className="w-4 h-4 text-muted-foreground" />
                        : result.media_type === "movie"
                          ? <Film className="w-4 h-4 text-muted-foreground" />
                          : <Tv className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{label}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      {resultIsMusic ? (
                        <>
                          <span>{result.media_type === "album" ? "Album" : "Track"}</span>
                          {result.artist && <><span>·</span><span className="truncate">{result.artist}</span></>}
                        </>
                      ) : (
                        <>
                          <span>{result.media_type === "movie" ? "Movie" : "TV Show"}</span>
                          {year && <><span>·</span><span>{year}</span></>}
                          {result.vote_average != null && result.vote_average > 0 && (
                            <>
                              <span>·</span>
                              <span className="flex items-center gap-1">
                                <Star className="w-3 h-3 text-accent fill-accent" />
                                {result.vote_average.toFixed(1)}
                              </span>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  {alreadyAdded ? (
                    <span className="text-xs text-muted-foreground px-3 py-1.5 border border-border rounded-md">
                      Added
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      disabled={addingId === (result.spotify_id || result.id)}
                      onClick={() => handleAddItem(result)}
                    >
                      {addingId === (result.spotify_id || result.id) ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <><Plus className="w-4 h-4 mr-1" /> Add</>
                      )}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Items Grid */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-card/50 flex items-center justify-center mb-6">
            {isMusic ? <Music2 className="w-10 h-10 text-muted-foreground" /> : <Film className="w-10 h-10 text-muted-foreground" />}
          </div>
          <h2 className="text-xl font-semibold mb-2">This list is empty</h2>
          <p className="text-muted-foreground max-w-md">
            {isMusic
              ? "Use the search bar above to add albums and tracks."
              : "Use the search bar above to add movies and TV shows."}
          </p>
        </div>
      ) : (
        <div className={`grid ${isMusic ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6" : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"} gap-4`}>
          {items.map((item) => {
            const itemIsMusic = item.media_type === "album" || item.media_type === "track";
            const artUrl = itemIsMusic ? item.image_url : upscalePoster(item.poster_url);
            return (
              <div
                key={item.id}
                className="group border-2 border-border overflow-hidden hover:border-primary transition-all duration-300 cursor-pointer relative"
                onClick={() => {
                  if (itemIsMusic && item.spotify_id) {
                    router.push(`/protected/media/${item.media_type}/${item.spotify_id}`);
                  } else if (item.tmdb_id) {
                    router.push(`/protected/media/${item.media_type}/${item.tmdb_id}`);
                  }
                }}
              >
                <div className={`${itemIsMusic ? "aspect-square" : "aspect-[2/3]"} bg-gradient-to-br from-primary/20 via-accent/10 to-secondary/20 flex items-center justify-center relative overflow-hidden`}>
                  {artUrl ? (
                    <img
                      src={artUrl}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                  ) : itemIsMusic ? (
                    <Disc3 className="w-12 h-12 text-white/50" />
                  ) : item.media_type === "movie" ? (
                    <Film className="w-12 h-12 text-white/50" />
                  ) : (
                    <Tv className="w-12 h-12 text-white/50" />
                  )}
                  {/* Remove button on hover */}
                  <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveItem(item.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Remove
                    </Button>
                  </div>
                </div>
                <div className="p-4 space-y-1">
                  <h3 className="font-semibold line-clamp-1 group-hover:text-primary transition-colors">
                    {item.title}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {itemIsMusic ? (
                      <>
                        <span>{item.media_type === "album" ? "Album" : "Track"}</span>
                        {item.artist && <><span>·</span><span className="truncate">{item.artist}</span></>}
                      </>
                    ) : (
                      <span>{item.media_type === "movie" ? "Movie" : "TV Show"}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
