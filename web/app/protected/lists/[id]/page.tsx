"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Disc3,
  Film,
  ListX,
  Music2,
  Pencil,
  Plus,
  Search,
  Star,
  Tv,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Input, Textarea } from "@/components/ui/input";
import { LoadingLine, MediaGridSkeleton, Skeleton } from "@/components/ui/loading";
import { MediaCard, MediaGrid } from "@/components/ui/media-card";
import { EmptyState, Field, Notice, PageHeader, SectionHeader } from "@/components/ui/page";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { useSyncMode } from "@/lib/mode-context";
import type { MediaSearchResult } from "@/lib/types";
import type { SpotifySearchResult } from "@/lib/spotify/spotify";
import { resizePoster } from "@/lib/tmdb/poster";
import { useClickOutside } from "@/hooks/use-click-outside";
import { useDebouncedSearch } from "@/hooks/use-debounced-search";

type ListMeta = {
  id: string;
  user_id: string;
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

type LoadStatus = "loading" | "ready" | "missing" | "failed";

const LISTS_HREF = "/protected/watchlist?tab=lists";
const RETRY_HINT = "Check your connection and try again.";

// PostgREST "no rows" (the list does not exist, or row-level security hides it)
// and Postgres "invalid uuid" (a mangled link) both mean there is no list to show.
const MISSING_CODES = new Set(["PGRST116", "22P02"]);

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function isMusicType(mediaType: string): boolean {
  return mediaType === "album" || mediaType === "track";
}

function typeLabel(mediaType: string): string {
  if (mediaType === "album") return "Album";
  if (mediaType === "track") return "Track";
  return mediaType === "movie" ? "Film" : "TV show";
}

/** Key for "already on the list" checks: film ids are only unique per media type. */
function itemKey(mediaType: string, tmdbId: number | string | null, spotifyId?: string | null): string {
  if (isMusicType(mediaType)) return `spotify:${spotifyId || tmdbId}`;
  return `${mediaType}:${tmdbId}`;
}

/** "3 films and shows", "1 album or track". */
function countLabel(count: number, music: boolean): string {
  const noun = music
    ? count === 1 ? "album or track" : "albums and tracks"
    : count === 1 ? "film or show" : "films and shows";
  return `${count} ${noun}`;
}

function BackLink() {
  return (
    <Button asChild variant="ghost" size="sm" className="-ml-3 mb-6">
      <Link href={LISTS_HREF}>
        <ArrowLeft aria-hidden="true" /> Back to my lists
      </Link>
    </Button>
  );
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
  const toast = useToast();
  const listId = params.id as string;
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [list, setList] = useState<ListMeta | null>(null);
  const [items, setItems] = useState<ListItem[]>([]);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [isOwner, setIsOwner] = useState(false);

  const isMusic = list?.list_type === "music";
  useSyncMode(list ? list.list_type : null);

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);

  // Add items search state
  const [showAddDropdown, setShowAddDropdown] = useState(false);
  const {
    query: addQuery,
    setQuery: setAddQuery,
    results: addResults,
    loading: isSearching,
    error: searchError,
  } = useDebouncedSearch<MediaSearchResult>(async (q) => {
    if (isMusic) {
      const res = await fetch(`/api/spotify?action=search&q=${encodeURIComponent(q)}&type=album,track`);
      if (!res.ok) throw new Error("Search failed");
      const raw: unknown = await res.json();
      const data: MediaSearchResult[] = Array.isArray(raw)
        ? (raw as SpotifySearchResult[]).map((r) => ({
            id: r.id,
            spotify_id: r.id,
            name: r.name,
            artist: r.artist,
            album_name: r.album_name,
            media_type: r.type,
            release_date: r.release_date,
            image_url: r.image_url,
          }))
        : [];
      setShowAddDropdown(true);
      return data;
    }
    const res = await fetch(`/api?action=search&q=${encodeURIComponent(q)}`);
    if (!res.ok) throw new Error("Search failed");
    const data: unknown = await res.json();
    setShowAddDropdown(true);
    return Array.isArray(data) ? (data as MediaSearchResult[]) : [];
  }, [isMusic]);
  const searchFailed = searchError !== null;
  const [addingId, setAddingId] = useState<number | string | null>(null);

  /** Loads the list and its items. Returns false (and sets the page state) when it could not. */
  const fetchListData = useCallback(async (): Promise<boolean> => {
    try {
      const supabase = createClient();

      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) {
        setStatus("missing");
        return false;
      }

      const [listRes, itemsRes] = await Promise.all([
        supabase.from("lists").select("*").eq("id", listId).single(),
        supabase
          .from("list_items")
          .select("*")
          .eq("list_id", listId)
          .order("position", { ascending: true })
          .order("added_at", { ascending: false }),
      ]);

      if (listRes.error) {
        setStatus(MISSING_CODES.has(listRes.error.code) ? "missing" : "failed");
        return false;
      }
      if (itemsRes.error) {
        setStatus("failed");
        return false;
      }
      setList(listRes.data);
      setIsOwner(listRes.data.user_id === user.id);
      setEditName(listRes.data.name);
      setEditDescription(listRes.data.description || "");
      setItems(itemsRes.data || []);
      setStatus("ready");
      return true;
    } catch {
      setStatus("failed");
      return false;
    }
  }, [listId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads the list on mount and when the id changes; state is only set after the awaited requests
    fetchListData();
  }, [fetchListData]);

  function retryLoad() {
    setStatus("loading");
    fetchListData();
  }

  useClickOutside(searchRef, () => setShowAddDropdown(false));

  async function handleAddItem(result: MediaSearchResult) {
    if (!isOwner) return;
    const label = result.title || result.name || "Untitled";
    setAddingId(result.spotify_id || result.id);
    try {
      const supabase = createClient();

      const { error } = isMusic
        ? await supabase.from("list_items").insert({
            list_id: listId,
            spotify_id: result.spotify_id || String(result.id),
            title: result.name || result.title || "Untitled",
            artist: result.artist || null,
            media_type: result.media_type,
            image_url: result.image_url || null,
            position: items.length,
          })
        : await supabase.from("list_items").insert({
            list_id: listId,
            tmdb_id: result.id,
            title: result.title || result.name || "Untitled",
            media_type: result.media_type,
            poster_url: result.poster_url || null,
            position: items.length,
          });
      // 23505 = already on the list, which is the outcome the user asked for.
      const alreadyOnList = error?.code === "23505";
      if (error && !alreadyOnList) throw error;

      // Bumps the list's "last updated" time. Only its place in the lists overview
      // depends on this, so a failure here is not worth interrupting the user for.
      await supabase
        .from("lists")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", listId);

      setAddQuery("");
      setShowAddDropdown(false);
      const refreshed = await fetchListData();
      if (refreshed) {
        toast(
          alreadyOnList
            ? { mark: "Added", title: `${label} is already on this list`, tone: "info" }
            : { mark: "Added", title: `${label} added to ${list?.name ?? "this list"}` },
        );
      }
    } catch {
      toast({ mark: "Failed", tone: "error", title: `Couldn't add ${label}`, description: RETRY_HINT });
    } finally {
      setAddingId(null);
    }
  }

  async function handleRemoveItem(item: ListItem) {
    if (!isOwner) return;
    let failed = false;
    try {
      const supabase = createClient();
      const { error } = await supabase.from("list_items").delete().eq("id", item.id);
      failed = Boolean(error);
    } catch {
      failed = true;
    }

    if (failed) {
      toast({
        mark: "Failed",
        tone: "error",
        title: `Couldn't remove ${item.title}`,
        description: `It is still on this list. ${RETRY_HINT}`,
      });
      return;
    }

    setItems((prev) => prev.filter((i) => i.id !== item.id));
    toast({ mark: "Removed", title: `${item.title} removed from this list`, tone: "info" });
  }

  function cancelEdit() {
    if (!list) return;
    setIsEditing(false);
    setEditName(list.name);
    setEditDescription(list.description || "");
  }

  async function handleSaveEdit() {
    if (!isOwner || !editName.trim()) return;
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
      toast({ mark: "Saved", title: "List details updated" });
    } catch {
      toast({
        mark: "Failed",
        tone: "error",
        title: "Couldn't save your changes",
        description: `Your edits are still here. ${RETRY_HINT}`,
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteList() {
    if (!isOwner) return;
    let failed = false;
    try {
      const supabase = createClient();
      const { error } = await supabase.from("lists").delete().eq("id", listId);
      failed = Boolean(error);
    } catch {
      failed = true;
    }

    if (failed) {
      toast({ mark: "Failed", tone: "error", title: "Couldn't delete this list", description: RETRY_HINT });
      return;
    }

    toast({ mark: "Removed", title: `${list?.name ?? "List"} deleted`, tone: "info" });
    router.push(LISTS_HREF);
  }

  const existingKeys = new Set(items.map((i) => itemKey(i.media_type, i.tmdb_id, i.spotify_id)));

  if (status === "loading") {
    return (
      <div>
        <Skeleton className="mb-6 h-8 w-36" />
        <Skeleton className="h-10 w-2/3 max-w-md" />
        <Skeleton className="mb-10 mt-4 h-3 w-48" />
        <MediaGridSkeleton />
      </div>
    );
  }

  if (status === "missing") {
    return (
      <EmptyState
        icon={ListX}
        title="This list isn't here"
        description="It may have been deleted, or it belongs to someone else and isn't yours to open."
        action={
          <Button asChild variant="outline">
            <Link href={LISTS_HREF}>
              <ArrowLeft aria-hidden="true" /> Back to my lists
            </Link>
          </Button>
        }
      />
    );
  }

  if (status === "failed" || !list) {
    return (
      <div>
        <BackLink />
        <Notice tone="error" title="Couldn't load this list">
          <p>{RETRY_HINT}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={retryLoad}>
            Try again
          </Button>
        </Notice>
      </div>
    );
  }

  const query = addQuery.trim();

  return (
    <div>
      <BackLink />

      <PageHeader
        title={
          <>
            {list.emoji && <span aria-hidden="true">{list.emoji} </span>}
            {list.name}
          </>
        }
        description={
          <>
            {list.description && <span className="mb-2 block">{list.description}</span>}
            <span className="t-label">
              {countLabel(items.length, isMusic)} · Created {formatDate(list.created_at)}
            </span>
            {!isOwner && (
              <span className="mt-2 block">
                <Badge variant="outline">Shared list</Badge>
              </span>
            )}
          </>
        }
        actions={
          isOwner &&
          !isEditing && (
            <>
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                <Pencil aria-hidden="true" /> Edit details
              </Button>
              <ConfirmButton
                size="default"
                label="Delete list"
                confirmLabel="Confirm delete"
                onConfirm={handleDeleteList}
              />
            </>
          )
        }
      />

      {isOwner && isEditing && (
        <form
          className="frame drawer-in mb-12 flex max-w-xl flex-col gap-5 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            handleSaveEdit();
          }}
        >
          <Field label="Name" htmlFor="list-name">
            <Input
              id="list-name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              required
              autoFocus
            />
          </Field>
          <Field label="Description" htmlFor="list-description">
            <Textarea
              id="list-description"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={2}
              className="min-h-[72px]"
            />
          </Field>
          <div className="flex flex-wrap gap-2.5">
            <Button type="submit" disabled={saving || !editName.trim()}>
              <Check aria-hidden="true" /> {saving ? "Saving" : "Save"}
            </Button>
            <Button variant="outline" onClick={cancelEdit} disabled={saving}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {/* Add items search */}
      {isOwner && (
        <div
          ref={searchRef}
          className="relative max-w-xl"
          onKeyDown={(e) => {
            if (e.key === "Escape") setShowAddDropdown(false);
          }}
        >
          <Field label="Add to this list" htmlFor="list-add-search">
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                ref={searchInputRef}
                id="list-add-search"
                type="search"
                autoComplete="off"
                placeholder={isMusic ? "Search for an album or track" : "Search for a film or TV show"}
                value={addQuery}
                onChange={(e) => {
                  setAddQuery(e.target.value);
                  if (!e.target.value.trim()) setShowAddDropdown(false);
                }}
                onFocus={() => addResults.length > 0 && setShowAddDropdown(true)}
                className="pl-9"
              />
            </div>
          </Field>

          {isSearching && <LoadingLine label="Searching" className="mt-3" />}

          {searchFailed && !isSearching && (
            <Notice tone="error" className="mt-3">
              Search isn&apos;t responding right now. Try again in a moment.
            </Notice>
          )}

          {showAddDropdown && !searchFailed && !isSearching && query && addResults.length === 0 && (
            <p className="t-meta mt-3" role="status">
              Nothing found for &ldquo;{query}&rdquo;. Try a different spelling.
            </p>
          )}

          {showAddDropdown && !searchFailed && addResults.length > 0 && (
            <ul className="drawer-in absolute inset-x-0 top-full z-50 mt-1 max-h-80 overflow-auto border border-border-strong bg-popover">
              {addResults.slice(0, 8).map((result) => {
                const label = result.title || result.name || "Untitled";
                const year = (result.release_date || result.first_air_date || "").slice(0, 4);
                const resultKey = result.spotify_id || String(result.id);
                const alreadyAdded = existingKeys.has(itemKey(result.media_type, result.id, result.spotify_id));
                const resultIsMusic = isMusicType(result.media_type);
                const art = resultIsMusic ? result.image_url || result.poster_url : resizePoster(result.poster_url, "w185");
                const adding = addingId === (result.spotify_id || result.id);
                const FallbackIcon = resultIsMusic ? Disc3 : result.media_type === "movie" ? Film : Tv;
                return (
                  <li key={`${result.media_type}-${resultKey}`} className="row-item flex items-center gap-3 px-3 py-2.5">
                    <div
                      className={`flex shrink-0 items-center justify-center overflow-hidden border border-border bg-surface-2 ${
                        resultIsMusic ? "h-10 w-10" : "h-12 w-8"
                      }`}
                    >
                      {art ? (
                         
                        <img src={art} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <FallbackIcon className="size-4 text-dim" aria-hidden="true" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">{label}</p>
                      <p className="t-meta flex items-center gap-2">
                        <span className="shrink-0">{typeLabel(result.media_type)}</span>
                        {resultIsMusic
                          ? result.artist && <span className="truncate">· {result.artist}</span>
                          : year && <span className="shrink-0">· {year}</span>}
                        {!resultIsMusic && result.vote_average != null && result.vote_average > 0 && (
                          <span className="flex shrink-0 items-center gap-1">
                            ·
                            <Star className="size-3 fill-primary text-primary" aria-hidden="true" />
                            <span className="sr-only">Average score</span>
                            {result.vote_average.toFixed(1)}
                          </span>
                        )}
                      </p>
                    </div>
                    {alreadyAdded ? (
                      <Badge variant="outline">Added</Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0"
                        disabled={adding}
                        aria-label={`Add ${label}`}
                        onClick={() => handleAddItem(result)}
                      >
                        <Plus aria-hidden="true" /> {adding ? "Adding" : "Add"}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Items */}
      <section className="mt-16">
        <SectionHeader
          title="On this list"
          meta={countLabel(items.length, isMusic)}
        />
        {items.length === 0 ? (
          <EmptyState
            icon={isMusic ? Music2 : Film}
            title={isOwner ? "This list is empty" : "Nothing on this list yet."}
            description={
              isOwner
                ? isMusic
                  ? "Use the search above to add albums and tracks."
                  : "Use the search above to add films and TV shows."
                : undefined
            }
            action={
              isOwner ? (
                <Button variant="outline" onClick={() => searchInputRef.current?.focus()}>
                  <Search aria-hidden="true" /> Find something to add
                </Button>
              ) : undefined
            }
          />
        ) : (
          <MediaGrid dense={isMusic}>
            {items.map((item) => {
              const itemIsMusic = isMusicType(item.media_type);
              const href =
                itemIsMusic && item.spotify_id
                  ? `/protected/media/${item.media_type}/${item.spotify_id}`
                  : item.tmdb_id
                    ? `/protected/media/${item.media_type}/${item.tmdb_id}`
                    : undefined;
              return (
                <MediaCard
                  key={item.id}
                  title={item.title}
                  subtitle={
                    itemIsMusic && item.artist
                      ? `${typeLabel(item.media_type)} · ${item.artist}`
                      : typeLabel(item.media_type)
                  }
                  image={itemIsMusic ? item.image_url : resizePoster(item.poster_url, "w342")}
                  aspect={itemIsMusic ? "square" : "poster"}
                  href={href}
                  fallbackIcon={itemIsMusic ? Disc3 : item.media_type === "movie" ? Film : Tv}
                  actions={
                    isOwner ? (
                    <ConfirmButton
                      iconOnly
                      label={`Remove ${item.title} from this list`}
                      confirmLabel="Remove"
                      className="bg-surface-2"
                      onConfirm={() => handleRemoveItem(item)}
                    />
                    ) : undefined
                  }
                />
              );
            })}
          </MediaGrid>
        )}
      </section>
    </div>
  );
}
