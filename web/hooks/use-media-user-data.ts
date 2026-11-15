"use client";

import { useEffect, useState } from "react";

import type { MediaDetail, MusicDetail, UserLogRow } from "@/components/media/media-info";
import { useToast } from "@/components/ui/toast";
import { PG_UNIQUE_VIOLATION } from "@/lib/postgrest";
import { logSelect } from "@/lib/rating-categories";
import { createClient } from "@/lib/supabase/client";

export type UserListInfo = {
  id: string;
  name: string;
  emoji: string | null;
  hasItem: boolean;
};

/**
 * The signed-in user's own data for one title: their log, whether it is on their watchlist (film)
 * or queue (music), and which of their lists contain it, plus the handlers that change them.
 */
export function useMediaUserData({
  type,
  id,
  isMusic,
  displayTitle,
  detail,
  musicDetail,
}: {
  type: string;
  id: string;
  isMusic: boolean;
  displayTitle: string;
  detail: MediaDetail | null;
  musicDetail: MusicDetail | null;
}) {
  const toast = useToast();

  // The user's own log: a watch for film and TV, a listen for albums and tracks.
  const [watchLog, setWatchLog] = useState<UserLogRow | null>(null);
  const [listenLog, setListenLog] = useState<UserLogRow | null>(null);
  const [userDataLoading, setUserDataLoading] = useState(true);
  // The user's own rows could not be read, so "logged", "saved" and list state are unknown.
  const [userDataFailed, setUserDataFailed] = useState(false);

  // Watchlist (film) or queue (music) membership.
  const [isSaved, setIsSaved] = useState(false);
  const [savedItemId, setSavedItemId] = useState<string | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);

  // Lists
  const [userLists, setUserLists] = useState<UserListInfo[]>([]);
  const [togglingListId, setTogglingListId] = useState<string | null>(null);

  const savedPlace = isMusic ? "queue" : "watchlist";

  // Fetch user data
  useEffect(() => {
    async function fetchUserData() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setUserDataLoading(false); return; }

        const listMode = isMusic ? "music" : "film";
        const tmdbId = Number(id);

        // The three reads do not depend on each other, so they run together.
        const [logRes, savedRes, listsRes] = await Promise.all([
          isMusic
            ? supabase
                .from("listen_logs")
                .select(logSelect(true))
                .eq("user_id", user.id)
                .eq("spotify_id", id)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle()
            : supabase
                .from("watch_logs")
                .select(logSelect(false))
                .eq("user_id", user.id)
                .eq("tmdb_id", tmdbId)
                .eq("media_type", type)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle(),
          isMusic
            ? supabase
                .from("music_queue")
                .select("id")
                .eq("user_id", user.id)
                .eq("spotify_id", id)
                .limit(1)
                .maybeSingle()
            : supabase
                .from("watchlist")
                .select("id")
                .eq("user_id", user.id)
                .eq("tmdb_id", tmdbId)
                .eq("media_type", type)
                .limit(1)
                .maybeSingle(),
          // Lists filtered by mode
          supabase
            .from("lists")
            .select("id, name, emoji")
            .eq("user_id", user.id)
            .eq("list_type", listMode)
            .order("updated_at", { ascending: false }),
        ]);

        if (logRes.error) throw logRes.error;
        if (savedRes.error) throw savedRes.error;
        const logRow = logRes.data as unknown as UserLogRow | null;
        if (logRow) (isMusic ? setListenLog : setWatchLog)(logRow);
        if (savedRes.data) {
          setIsSaved(true);
          setSavedItemId(savedRes.data.id);
        }

        const { data: allLists, error: listsError } = listsRes;
        if (listsError) throw listsError;
        if (allLists) {
          // Check which lists already contain this item
          const listIds = allLists.map((l) => l.id);
          let itemQuery = supabase
            .from("list_items")
            .select("list_id, media_type, tmdb_id, spotify_id")
            .in("list_id", listIds);
          itemQuery = isMusic
            ? itemQuery.eq("spotify_id", id)
            : itemQuery.eq("tmdb_id", Number(id)).eq("media_type", type);
          const { data: listItemsData, error: listItemsError } =
            listIds.length > 0 ? await itemQuery : { data: [], error: null };
          if (listItemsError) throw listItemsError;

          // Membership is keyed on the full identity of the item, never a bare id.
          const itemKey = isMusic ? `${type}:${id}` : `${type}:${Number(id)}`;
          const listsWithItem = new Set(
            (listItemsData || [])
              .filter(
                (li: { media_type: string; tmdb_id: number | null; spotify_id: string | null }) =>
                  `${li.media_type}:${isMusic ? li.spotify_id : li.tmdb_id}` === itemKey
              )
              .map((li: { list_id: string }) => li.list_id)
          );

          setUserLists(
            allLists.map((l) => ({
              id: l.id,
              name: l.name,
              emoji: l.emoji,
              hasItem: listsWithItem.has(l.id),
            }))
          );
        }
      } catch {
        // The page still works without the user's own data, but say so: the buttons below depend on it.
        setUserDataFailed(true);
      } finally {
        setUserDataLoading(false);
      }
    }
    fetchUserData();
  }, [id, type, isMusic]);

  // Add to the watchlist (film) or the queue (music)
  async function handleSave() {
    if (isMusic ? !musicDetail : !detail) return;
    setSaveBusy(true);
    const failed = () =>
      toast({
        mark: "Failed",
        tone: "error",
        title: `Couldn't add ${displayTitle} to your ${savedPlace}`,
        description: "Check your connection and try again.",
      });
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ mark: "Failed", tone: "error", title: `Sign in to add this to your ${savedPlace}` });
        return;
      }
      const { data, error } = isMusic
        ? await supabase
            .from("music_queue")
            .insert({
              user_id: user.id,
              spotify_id: id,
              media_type: type,
              title: musicDetail!.name,
              artist: musicDetail!.artist,
              image_url: musicDetail!.image_url,
            })
            .select("id")
            .single()
        : await supabase
            .from("watchlist")
            .insert({
              user_id: user.id,
              tmdb_id: Number(id),
              title: displayTitle,
              media_type: type,
              poster_url: detail!.poster_url,
            })
            .select("id")
            .single();

      // 23505: it was already there. Anything else is a real failure.
      if (error && error.code !== PG_UNIQUE_VIOLATION) {
        failed();
        return;
      }

      let itemId: string | null = data?.id ?? null;
      if (!itemId) {
        const existing = isMusic
          ? await supabase
              .from("music_queue")
              .select("id")
              .eq("user_id", user.id)
              .eq("spotify_id", id)
              .limit(1)
              .maybeSingle()
          : await supabase
              .from("watchlist")
              .select("id")
              .eq("user_id", user.id)
              .eq("tmdb_id", Number(id))
              .eq("media_type", type)
              .limit(1)
              .maybeSingle();
        itemId = existing.data?.id ?? null;
      }
      setIsSaved(true);
      setSavedItemId(itemId);
      toast({
        mark: "Added",
        title: isMusic ? `${displayTitle} is in your queue` : `${displayTitle} is on your watchlist`,
      });
    } catch {
      failed();
    } finally {
      setSaveBusy(false);
    }
  }

  async function handleUnsave() {
    const failed = () =>
      toast({
        mark: "Failed",
        tone: "error",
        title: `Couldn't remove ${displayTitle} from your ${savedPlace}`,
        description: "Try again in a moment.",
      });
    if (!savedItemId) {
      failed();
      return;
    }
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        failed();
        return;
      }
      const { error } = await supabase
        .from(isMusic ? "music_queue" : "watchlist")
        .delete()
        .eq("user_id", user.id)
        .eq("id", savedItemId);
      if (error) {
        failed();
        return;
      }
      setIsSaved(false);
      setSavedItemId(null);
      toast({ mark: "Removed", title: `${displayTitle} removed from your ${savedPlace}` });
    } catch {
      failed();
    }
  }

  // Delete log
  async function handleDeleteLog() {
    const logId = isMusic ? listenLog?.id : watchLog?.id;
    if (!logId) return;
    const failed = () =>
      toast({
        mark: "Failed",
        tone: "error",
        title: "Couldn't delete your log",
        description: "Nothing was removed. Try again in a moment.",
      });
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        failed();
        return;
      }
      const { error } = await supabase
        .from(isMusic ? "listen_logs" : "watch_logs")
        .delete()
        .eq("user_id", user.id)
        .eq("id", logId);
      if (error) {
        failed();
        return;
      }
      if (isMusic) setListenLog(null);
      else setWatchLog(null);
      toast({ mark: "Removed", title: `Your log of ${displayTitle} was deleted` });
    } catch {
      failed();
    }
  }

  async function handleToggleList(list: UserListInfo) {
    setTogglingListId(list.id);
    const failed = () =>
      toast({
        mark: "Failed",
        tone: "error",
        title: list.hasItem
          ? `Couldn't remove ${displayTitle} from ${list.name}`
          : `Couldn't add ${displayTitle} to ${list.name}`,
        description: "Try again in a moment.",
      });
    try {
      const supabase = createClient();
      if (list.hasItem) {
        const { error } = isMusic
          ? await supabase
              .from("list_items")
              .delete()
              .eq("list_id", list.id)
              .eq("spotify_id", id)
          : await supabase
              .from("list_items")
              .delete()
              .eq("list_id", list.id)
              .eq("tmdb_id", Number(id))
              .eq("media_type", type);
        if (error) {
          failed();
          return;
        }
      } else {
        const { error } = isMusic
          ? await supabase.from("list_items").insert({
              list_id: list.id,
              spotify_id: id,
              title: musicDetail?.name || "Unknown",
              artist: musicDetail?.artist || null,
              media_type: type,
              image_url: musicDetail?.image_url || null,
            })
          : await supabase.from("list_items").insert({
              list_id: list.id,
              tmdb_id: Number(id),
              title: displayTitle,
              media_type: type,
              poster_url: detail?.poster_url || null,
            });
        if (error && error.code !== PG_UNIQUE_VIOLATION) {
          failed();
          return;
        }
      }
      setUserLists((prev) =>
        prev.map((l) => (l.id === list.id ? { ...l, hasItem: !list.hasItem } : l))
      );
      toast(
        list.hasItem
          ? { mark: "Removed", title: `${displayTitle} removed from ${list.name}` }
          : { mark: "Added", title: `${displayTitle} added to ${list.name}` }
      );
    } catch {
      failed();
    } finally {
      setTogglingListId(null);
    }
  }

  return {
    watchLog,
    listenLog,
    userDataLoading,
    userDataFailed,
    isSaved,
    savedPlace,
    saveBusy,
    userLists,
    togglingListId,
    handleSave,
    handleUnsave,
    handleDeleteLog,
    handleToggleList,
  };
}
