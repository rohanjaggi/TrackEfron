"use client";

import { useState, useEffect, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Clock,
  Film,
  List,
  Lock,
  Music2,
  Disc3,
  Tv,
  UserCheck,
  UserMinus,
  UserPlus,
  UserX,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { RowListSkeleton, Skeleton } from "@/components/ui/loading";
import { MediaCard, MediaGrid } from "@/components/ui/media-card";
import { Avatar, EmptyState, SectionHeader, StatBlock } from "@/components/ui/page";
import { Stars } from "@/components/ui/stars";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";

type Profile = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  profile_color: string | null;
  created_at: string;
};

type WatchLog = {
  id: string;
  title: string;
  media_type: "movie" | "tv";
  rating: number;
  review: string | null;
  poster_url: string | null;
  tmdb_id: number | null;
  created_at: string;
};

type WatchlistItem = {
  id: string;
  title: string;
  media_type: "movie" | "tv";
  poster_url: string | null;
  tmdb_id: number;
};

type UserList = {
  id: string;
  name: string;
  emoji: string | null;
  description: string | null;
  list_type: string | null;
  list_items: { count: number }[];
};

type ListenLog = {
  id: string;
  title: string;
  artist: string | null;
  media_type: "album" | "track";
  rating: number;
  image_url: string | null;
  spotify_id: string | null;
  created_at: string;
};

type QueueItem = {
  id: string;
  title: string;
  artist: string | null;
  media_type: "album" | "track";
  image_url: string | null;
  spotify_id: string;
};

type RelationshipStatus = "self" | "friends" | "pending_sent" | "pending_received" | "none";

type FriendshipRow = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: string;
};

function upscalePoster(url: string | null, size = "w185"): string | null {
  if (!url) return null;
  return url.replace(/\/w\d+\//, `/${size}/`);
}

/** "14 Nov 2026", or "November 2026" when only the month matters. */
function formatDate(value: string, style: "day" | "month" = "day"): string {
  return new Date(value).toLocaleDateString(
    "en-GB",
    style === "month"
      ? { month: "long", year: "numeric" }
      : { day: "numeric", month: "short", year: "numeric" },
  );
}

function relationshipFrom(row: FriendshipRow, viewerId: string): RelationshipStatus {
  if (row.status === "accepted") return "friends";
  return row.requester_id === viewerId ? "pending_sent" : "pending_received";
}

function BackLink({ solid = false }: { solid?: boolean }) {
  return (
    <Button asChild variant={solid ? "default" : "ghost"} size={solid ? "default" : "sm"}>
      <Link href="/protected/friends">
        <ArrowLeft aria-hidden="true" /> Back to Friends
      </Link>
    </Button>
  );
}

/** Placeholder in the shape of the page: portrait and name, figures, then rows. */
function ProfileSkeleton() {
  return (
    <div role="status" aria-label="Loading profile" className="flex flex-col gap-16">
      <div>
        <Skeleton className="mb-6 h-8 w-36" />
        <div className="flex items-center gap-5 sm:gap-6">
          <Skeleton className="h-[88px] w-[88px] shrink-0" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-10 w-2/3 max-w-xs" />
            <Skeleton className="mt-3 h-3 w-1/2 max-w-[220px]" />
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-12 gap-y-6">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-14 w-20" />
        ))}
      </div>
      <RowListSkeleton count={3} />
    </div>
  );
}

/** A person's lists for one domain, counted in that domain's own nouns. */
function ProfileLists({
  title,
  lists,
  noun,
}: {
  title: string;
  lists: UserList[];
  noun: "film" | "music";
}) {
  if (lists.length === 0) return null;
  return (
    <section>
      <SectionHeader title={title} as="h3" />
      <ul>
        {lists.map((list) => {
          const count = list.list_items?.[0]?.count ?? 0;
          const countLabel =
            noun === "film"
              ? count === 1 ? "1 film or show" : `${count} films and shows`
              : count === 1 ? "1 album or track" : `${count} albums and tracks`;
          return (
            <li key={list.id} className="row-item">
              <Link href={`/protected/lists/${list.id}`} className="flex items-center gap-4 px-2 py-4">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center border border-border bg-surface-2 text-[18px] leading-none"
                  aria-hidden="true"
                >
                  {list.emoji || <List className="size-4 text-dim" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="t-card block truncate">{list.name}</span>
                  {list.description && (
                    <span className="t-meta mt-1 line-clamp-1 block">{list.description}</span>
                  )}
                </span>
                <span className="label-upper shrink-0">{countLabel}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function UserProfilePage() {
  return (
    <Suspense>
      <UserProfileContent />
    </Suspense>
  );
}

function UserProfileContent() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const targetUsername = params.username as string;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [relationship, setRelationship] = useState<RelationshipStatus>("none");
  const [friendshipId, setFriendshipId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Friend-visible data
  const [watchLogs, setWatchLogs] = useState<WatchLog[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [lists, setLists] = useState<UserList[]>([]);
  const [listenLogs, setListenLogs] = useState<ListenLog[]>([]);
  const [musicQueue, setMusicQueue] = useState<QueueItem[]>([]);
  const [friendDataLoading, setFriendDataLoading] = useState(false);
  const [fingerprint, setFingerprint] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProfile() {
      try {
        setLoading(true);
        setLoadFailed(false);
        const supabase = createClient();

        // Get target user's profile
        const { data: profileData, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("username", targetUsername)
          .single();

        if (error || !profileData) {
          // PGRST116 is "no such row": a real not-found. Anything else is a failed request.
          if (error && error.code !== "PGRST116") setLoadFailed(true);
          setProfile(null);
          setLoading(false);
          return;
        }

        setProfile(profileData);

        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }

        // Check if viewing own profile
        if (user.id === profileData.id) {
          setRelationship("self");
          setLoading(false);
          // Redirect to own profile
          router.replace("/protected/profile");
          return;
        }

        // Check friendship status
        const { data: friendships } = await supabase
          .from("friendships")
          .select("id, requester_id, addressee_id, status")
          .or(
            `and(requester_id.eq.${user.id},addressee_id.eq.${profileData.id}),and(requester_id.eq.${profileData.id},addressee_id.eq.${user.id})`
          );

        if (friendships && friendships.length > 0) {
          const f = friendships[0] as FriendshipRow;
          setFriendshipId(f.id);
          setRelationship(relationshipFrom(f, user.id));
        } else {
          setFriendshipId(null);
          setRelationship("none");
        }
      } catch (err) {
        console.error("Failed to fetch profile:", err);
        setLoadFailed(true);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, [targetUsername, router]);

  // Fetch friend data when relationship is "friends"
  useEffect(() => {
    if (relationship !== "friends" || !profile) return;

    async function fetchFriendData() {
      setFriendDataLoading(true);
      try {
        const supabase = createClient();

        const [logsRes, watchlistRes, listsRes, listensRes, queueRes] = await Promise.all([
          supabase
            .from("watch_logs")
            .select("id, title, media_type, rating, review, poster_url, tmdb_id, created_at")
            .eq("user_id", profile!.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("watchlist")
            .select("id, title, media_type, poster_url, tmdb_id")
            .eq("user_id", profile!.id)
            .order("added_at", { ascending: false }),
          supabase
            .from("lists")
            .select("id, name, emoji, description, list_type, list_items(count)")
            .eq("user_id", profile!.id)
            .order("updated_at", { ascending: false }),
          supabase
            .from("listen_logs")
            .select("id, title, artist, media_type, rating, image_url, spotify_id, created_at")
            .eq("user_id", profile!.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("music_queue")
            .select("id, title, artist, media_type, image_url, spotify_id")
            .eq("user_id", profile!.id)
            .order("added_at", { ascending: false }),
        ]);

        setWatchLogs(logsRes.data || []);
        setWatchlist(watchlistRes.data || []);
        setLists((listsRes.data as UserList[]) || []);
        // Music reads may be refused by database rules; that just means nothing to show.
        setListenLogs(listensRes.error ? [] : ((listensRes.data as ListenLog[]) ?? []));
        setMusicQueue(queueRes.error ? [] : ((queueRes.data as QueueItem[]) ?? []));

        // Fetch friend's taste fingerprint
        const { data: dnaData } = await supabase
          .from("taste_dna")
          .select("fingerprint")
          .eq("user_id", profile!.id)
          .maybeSingle();
        if (dnaData?.fingerprint) setFingerprint(dnaData.fingerprint);
      } catch (err) {
        console.error("Failed to fetch friend data:", err);
      } finally {
        setFriendDataLoading(false);
      }
    }
    fetchFriendData();
  }, [relationship, profile]);

  const displayName = profile ? profile.full_name || profile.username : "";

  function actionFailed(title: string) {
    toast({ mark: "Failed", tone: "error", title, description: "Try again in a moment." });
  }

  async function handleSendRequest() {
    if (!profile) return;
    setActionLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ mark: "Failed", tone: "error", title: "Sign in to add friends" });
        return;
      }
      const { data, error } = await supabase
        .from("friendships")
        .insert({
          requester_id: user.id,
          addressee_id: profile.id,
          status: "pending",
        })
        .select("id")
        .single();

      if (error && error.code !== "23505") {
        console.error("Failed to send friend request:", error);
        actionFailed(`Couldn't send your request to ${displayName}`);
        return;
      }

      if (data) {
        setFriendshipId(data.id);
        setRelationship("pending_sent");
      } else {
        // 23505: a friendship row already exists. Read it so the page shows where things really stand.
        const { data: existing } = await supabase
          .from("friendships")
          .select("id, requester_id, addressee_id, status")
          .or(
            `and(requester_id.eq.${user.id},addressee_id.eq.${profile.id}),and(requester_id.eq.${profile.id},addressee_id.eq.${user.id})`
          );
        const row = existing?.[0] as FriendshipRow | undefined;
        if (row) {
          setFriendshipId(row.id);
          setRelationship(relationshipFrom(row, user.id));
        } else {
          setRelationship("pending_sent");
        }
      }
      toast({ mark: "Sent", title: `Friend request sent to ${displayName}` });
    } catch (err) {
      console.error("Failed to send friend request:", err);
      actionFailed(`Couldn't send your request to ${displayName}`);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAccept() {
    if (!friendshipId) return;
    setActionLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("friendships")
        .update({ status: "accepted" })
        .eq("id", friendshipId);
      if (error) {
        console.error("Failed to accept friend request:", error);
        actionFailed(`Couldn't accept ${displayName}'s request`);
        return;
      }
      setRelationship("friends");
      toast({ mark: "Friends", title: `You and ${displayName} are now friends` });
    } catch (err) {
      console.error("Failed to accept friend request:", err);
      actionFailed(`Couldn't accept ${displayName}'s request`);
    } finally {
      setActionLoading(false);
    }
  }

  /** Deletes the friendship row: cancels a sent request, declines a received one, or ends a friendship. */
  async function handleCancel(kind: "cancel" | "decline" | "unfriend") {
    const failTitle =
      kind === "cancel"
        ? "Couldn't cancel your request"
        : kind === "decline"
          ? `Couldn't decline ${displayName}'s request`
          : `Couldn't remove ${displayName} from your friends`;
    if (!friendshipId) {
      actionFailed(failTitle);
      return;
    }
    setActionLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("friendships").delete().eq("id", friendshipId);
      if (error) {
        console.error("Failed to cancel/decline friendship:", error);
        actionFailed(failTitle);
        return;
      }
      setRelationship("none");
      setFriendshipId(null);
      toast(
        kind === "cancel"
          ? { mark: "Cancelled", title: `Request to ${displayName} cancelled`, tone: "info" }
          : kind === "decline"
            ? { mark: "Declined", title: `Request from ${displayName} declined`, tone: "info" }
            : { mark: "Removed", title: `${displayName} removed from your friends`, tone: "info" },
      );
    } catch (err) {
      console.error("Failed to cancel/decline friendship:", err);
      actionFailed(failTitle);
    } finally {
      setActionLoading(false);
    }
  }

  // Own profile: the redirect is already under way.
  if (loading || relationship === "self") {
    return <ProfileSkeleton />;
  }

  if (!profile) {
    return (
      <EmptyState
        icon={UserX}
        title={loadFailed ? "We couldn't load this profile." : "Nobody here by that name."}
        description={
          loadFailed
            ? "Check your connection and reload the page, or head back to your friends."
            : `There's no account called @${targetUsername}. Check the spelling, or find them from your friends page.`
        }
        action={<BackLink solid />}
      />
    );
  }

  const stats = {
    watched: watchLogs.length,
    movies: watchLogs.filter((i) => i.media_type === "movie").length,
    tvShows: watchLogs.filter((i) => i.media_type === "tv").length,
    reviews: watchLogs.filter((i) => i.review && i.review.trim().length > 0).length,
    avgRating: watchLogs.length > 0
      ? (watchLogs.reduce((acc, i) => acc + Number(i.rating), 0) / watchLogs.length).toFixed(1)
      : "—",
  };

  const filmLists = lists.filter((l) => l.list_type !== "music");
  const musicLists = lists.filter((l) => l.list_type === "music");
  const filmEmpty = watchLogs.length === 0 && watchlist.length === 0 && filmLists.length === 0;
  const musicEmpty = listenLogs.length === 0 && musicQueue.length === 0 && musicLists.length === 0;

  const musicStats = {
    listens: listenLogs.length,
    albums: listenLogs.filter((i) => i.media_type === "album").length,
    tracks: listenLogs.filter((i) => i.media_type === "track").length,
    avgRating: listenLogs.length > 0
      ? (listenLogs.reduce((acc, i) => acc + Number(i.rating), 0) / listenLogs.length).toFixed(1)
      : "—",
  };

  const recentReviews = watchLogs
    .filter((l) => l.review && l.review.trim().length > 0)
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-16">
      <div>
        <div className="-ml-3 mb-6">
          <BackLink />
        </div>

        <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-6">
          <div className="flex min-w-0 items-center gap-5 sm:gap-6">
            <Avatar src={profile.avatar_url} name={displayName} size={88} />
            <div className="min-w-0">
              <h1 className="t-display break-words">{displayName}</h1>
              <p className="t-meta mt-2">
                @{profile.username} · Member since {formatDate(profile.created_at, "month")}
              </p>
            </div>
          </div>

          {/* Friendship: one solid action at most */}
          <div className="flex flex-wrap items-center gap-2.5">
            {relationship === "none" && (
              <Button onClick={handleSendRequest} disabled={actionLoading}>
                <UserPlus aria-hidden="true" /> {actionLoading ? "Sending" : "Add friend"}
              </Button>
            )}
            {relationship === "pending_sent" && (
              <>
                <Badge variant="warning">
                  <Clock className="size-3" aria-hidden="true" /> Request sent
                </Badge>
                <Button
                  variant="outline"
                  onClick={() => handleCancel("cancel")}
                  disabled={actionLoading}
                >
                  Cancel request
                </Button>
              </>
            )}
            {relationship === "pending_received" && (
              <>
                <Button onClick={handleAccept} disabled={actionLoading}>
                  <UserCheck aria-hidden="true" /> Accept request
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleCancel("decline")}
                  disabled={actionLoading}
                >
                  Decline
                </Button>
              </>
            )}
            {relationship === "friends" && (
              <>
                <Badge>
                  <UserCheck className="size-3" aria-hidden="true" /> Friends
                </Badge>
                <ConfirmButton
                  icon={UserMinus}
                  label="Remove friend"
                  confirmLabel="Confirm remove"
                  onConfirm={() => handleCancel("unfriend")}
                  disabled={actionLoading}
                />
              </>
            )}
          </div>
        </header>

        {fingerprint && (
          <p className="t-prose mt-6 italic text-muted-foreground">{fingerprint}</p>
        )}
      </div>

      {/* Friend-only content */}
      {relationship === "friends" ? (
        friendDataLoading ? (
          <>
            <div className="flex flex-wrap gap-x-12 gap-y-6">
              <StatBlock label="Watched" value={0} loading />
              <StatBlock label="Films" value={0} loading />
              <StatBlock label="TV shows" value={0} loading />
              <StatBlock label="Reviews" value={0} loading />
              <StatBlock label="Avg rating" value={0} loading />
            </div>
            <RowListSkeleton count={3} />
          </>
        ) : (
          <>
            {/* Film & TV */}
            <div className="mode-film flex flex-col gap-10">
              <SectionHeader title="Film & TV" />

              {filmEmpty ? (
                <p className="t-meta">No films or shows to show yet.</p>
              ) : (
                <>
                  <section aria-label="Film and TV figures" className="flex flex-wrap gap-x-12 gap-y-6">
                    <StatBlock label="Watched" value={stats.watched} />
                    <StatBlock label="Films" value={stats.movies} />
                    <StatBlock label="TV shows" value={stats.tvShows} />
                    <StatBlock label="Reviews" value={stats.reviews} />
                    <StatBlock label="Avg rating" value={stats.avgRating} />
                  </section>

                  {recentReviews.length > 0 && (
                    <section>
                      <SectionHeader title="Recent reviews" as="h3" />
                      <ul className="advance">
                        {recentReviews.map((log) => {
                          const poster = upscalePoster(log.poster_url);
                          const FallbackIcon = log.media_type === "movie" ? Film : Tv;
                          const row = (
                            <>
                              <span className="flex h-[72px] w-12 shrink-0 items-center justify-center overflow-hidden border border-border bg-surface-2">
                                {poster ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={poster} alt="" className="h-full w-full object-cover" />
                                ) : (
                                  <FallbackIcon className="size-5 text-dim" aria-hidden="true" />
                                )}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                  <span className="t-card min-w-0 truncate">{log.title}</span>
                                  <Stars value={Number(log.rating)} />
                                </span>
                                <span className="t-meta mt-1 block">{formatDate(log.created_at)}</span>
                                <span className="t-prose mt-2 line-clamp-2">{log.review}</span>
                              </span>
                            </>
                          );
                          return (
                            <li key={log.id} className="row-item">
                              {log.tmdb_id ? (
                                <Link
                                  href={`/protected/media/${log.media_type}/${log.tmdb_id}`}
                                  className="flex items-start gap-4 px-2 py-4"
                                >
                                  {row}
                                </Link>
                              ) : (
                                <div className="flex items-start gap-4 px-2 py-4">{row}</div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  )}

                  {watchlist.length > 0 && (
                    <section>
                      <SectionHeader
                        title="Watchlist"
                        as="h3"
                        meta={`${watchlist.length} ${watchlist.length === 1 ? "film or show" : "films and shows"}`}
                      />
                      <MediaGrid dense>
                        {watchlist.slice(0, 12).map((item) => (
                          <MediaCard
                            key={item.id}
                            title={item.title}
                            subtitle={item.media_type === "movie" ? "Film" : "TV"}
                            image={upscalePoster(item.poster_url, "w342")}
                            aspect="poster"
                            href={`/protected/media/${item.media_type}/${item.tmdb_id}`}
                            fallbackIcon={item.media_type === "movie" ? Film : Tv}
                          />
                        ))}
                      </MediaGrid>
                      {watchlist.length > 12 && (
                        <p className="t-meta mt-8">+{watchlist.length - 12} more</p>
                      )}
                    </section>
                  )}

                  <ProfileLists title="Film & TV lists" lists={filmLists} noun="film" />
                </>
              )}
            </div>

            {/* Music */}
            <div className="mode-music flex flex-col gap-10">
              <SectionHeader title="Music" />

              {musicEmpty ? (
                <p className="t-meta">No listens to show yet.</p>
              ) : (
                <>
                  <section aria-label="Music figures" className="flex flex-wrap gap-x-12 gap-y-6">
                    <StatBlock label="Listens" value={musicStats.listens} />
                    <StatBlock label="Albums" value={musicStats.albums} />
                    <StatBlock label="Tracks" value={musicStats.tracks} />
                    <StatBlock label="Avg rating" value={musicStats.avgRating} />
                  </section>

                  {listenLogs.length > 0 && (
                    <section>
                      <SectionHeader title="Recent listens" as="h3" />
                      <ul className="advance">
                        {listenLogs.slice(0, 5).map((log) => {
                          const row = (
                            <>
                              <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden border border-border bg-surface-2">
                                {log.image_url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={log.image_url} alt="" className="h-full w-full object-cover" />
                                ) : (
                                  <Music2 className="size-5 text-dim" aria-hidden="true" />
                                )}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                  <span className="t-card min-w-0 truncate">{log.title}</span>
                                  <Stars value={Number(log.rating)} />
                                </span>
                                <span className="t-meta mt-1 block">
                                  {log.artist ? `${log.artist} · ` : ""}
                                  {formatDate(log.created_at)}
                                </span>
                              </span>
                            </>
                          );
                          return (
                            <li key={log.id} className="row-item">
                              {log.spotify_id ? (
                                <Link
                                  href={`/protected/media/${log.media_type}/${log.spotify_id}`}
                                  className="flex items-center gap-4 px-2 py-4"
                                >
                                  {row}
                                </Link>
                              ) : (
                                <div className="flex items-center gap-4 px-2 py-4">{row}</div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  )}

                  {musicQueue.length > 0 && (
                    <section>
                      <SectionHeader
                        title="Queue"
                        as="h3"
                        meta={`${musicQueue.length} ${musicQueue.length === 1 ? "album or track" : "albums and tracks"}`}
                      />
                      <MediaGrid dense>
                        {musicQueue.slice(0, 12).map((item) => (
                          <MediaCard
                            key={item.id}
                            title={item.title}
                            subtitle={item.artist ?? (item.media_type === "album" ? "Album" : "Track")}
                            image={item.image_url}
                            aspect="square"
                            href={`/protected/media/${item.media_type}/${item.spotify_id}`}
                            fallbackIcon={item.media_type === "album" ? Disc3 : Music2}
                          />
                        ))}
                      </MediaGrid>
                      {musicQueue.length > 12 && (
                        <p className="t-meta mt-8">+{musicQueue.length - 12} more</p>
                      )}
                    </section>
                  )}

                  <ProfileLists title="Music lists" lists={musicLists} noun="music" />
                </>
              )}
            </div>

            {/* Nothing in either domain */}
            {filmEmpty && musicEmpty && (
              <EmptyState
                icon={Film}
                title={<>{displayName} hasn&apos;t logged anything yet.</>}
                description="Their watches, listens, reviews, watchlist, queue and lists will show up here once they do."
              />
            )}
          </>
        )
      ) : (
        /* Non-friend locked view */
        <EmptyState
          icon={Lock}
          title="This profile is private."
          description={`Add ${displayName} as a friend to see the films, shows and music they have logged, along with their reviews, watchlist, queue and lists.`}
        />
      )}
    </div>
  );
}
