"use client";

import { PG_UNIQUE_VIOLATION } from "@/lib/postgrest";
import { useState, useEffect, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
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
import { Avatar, EmptyState, Notice, SectionHeader, StatBlock } from "@/components/ui/page";
import { Stars } from "@/components/ui/stars";
import { useToast } from "@/components/ui/toast";
import { pairFilter, relationshipFrom, type FriendshipRow, type RelationshipStatus } from "@/lib/friendships";
import { resizePoster } from "@/lib/tmdb/poster";
import { createClient } from "@/lib/supabase/client";
import { averageRating, countLabel, countReviews, formatDay, hasReview, mediaHref } from "@/lib/media";
import type { WatchLog, WatchlistItem } from "@/lib/types";

type Profile = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
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

/** "14 Nov 2026", or "November 2026" when only the month matters. */
function formatDate(value: string, style: "day" | "month" = "day"): string {
  if (style === "month") {
    return new Date(value).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  }
  return formatDay(value);
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

const PREVIEW_LIMIT = 12;

/** One recent log: artwork, title and stars, a meta line, an optional extra line; a link when `href` is set. */
function ActivityRow({
  href,
  align,
  thumbClass,
  image,
  FallbackIcon,
  title,
  rating,
  meta,
  extra,
}: {
  href?: string;
  align: "items-start" | "items-center";
  thumbClass: string;
  image: string | null;
  FallbackIcon: LucideIcon;
  title: string;
  rating: number;
  meta: React.ReactNode;
  extra?: React.ReactNode;
}) {
  const row = (
    <>
      <span
        className={`flex ${thumbClass} shrink-0 items-center justify-center overflow-hidden border border-border bg-surface-2`}
      >
        {image ? (
          <img src={image} alt="" className="h-full w-full object-cover" />
        ) : (
          <FallbackIcon className="size-5 text-dim" aria-hidden="true" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="t-card min-w-0 truncate">{title}</span>
          <Stars value={rating} />
        </span>
        <span className="t-meta mt-1 block">{meta}</span>
        {extra}
      </span>
    </>
  );
  const className = `flex ${align} gap-4 px-2 py-4`;
  return (
    <li className="row-item">
      {href ? (
        <Link href={href} className={className}>
          {row}
        </Link>
      ) : (
        <div className={className}>{row}</div>
      )}
    </li>
  );
}

/** A titled grid of the first dozen cards, with a "+N more" note beneath when there are more. */
function PreviewGrid<T>({
  title,
  meta,
  items,
  renderCard,
}: {
  title: string;
  meta: string;
  items: T[];
  renderCard: (item: T) => React.ReactNode;
}) {
  return (
    <section>
      <SectionHeader title={title} as="h3" meta={meta} />
      <MediaGrid dense>{items.slice(0, PREVIEW_LIMIT).map(renderCard)}</MediaGrid>
      {items.length > PREVIEW_LIMIT && (
        <p className="t-meta mt-8">+{items.length - PREVIEW_LIMIT} more</p>
      )}
    </section>
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
          const label = countLabel(count, noun === "music");
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
                <span className="t-label shrink-0">{label}</span>
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
  // A failed film read must not look like an empty library.
  const [filmDataFailed, setFilmDataFailed] = useState(false);
  const [fingerprint, setFingerprint] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProfile() {
      try {
        setLoading(true);
        setLoadFailed(false);
        const supabase = createClient();

        // The current user does not depend on the profile, so start both together.
        // A rejection only matters once the profile has loaded, as before.
        const userRequest = supabase.auth.getUser();
        userRequest.catch(() => {});

        // Get target user's profile
        const { data: profileData, error } = await supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url, created_at")
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
        const { data: { user } } = await userRequest;
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
        const { data: friendships, error: friendshipsError } = await supabase
          .from("friendships")
          .select("id, requester_id, addressee_id, status")
          .or(pairFilter(user.id, profileData.id));
        // Without this the page cannot tell "no friendship" from "couldn't check", so it shows no actions.
        if (friendshipsError) throw friendshipsError;

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
      setFilmDataFailed(false);
      try {
        const supabase = createClient();

        const [logsRes, watchlistRes, listsRes, listensRes, queueRes, dnaRes] = await Promise.all([
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
          supabase.from("taste_dna").select("fingerprint").eq("user_id", profile!.id).maybeSingle(),
        ]);

        if (logsRes.error || watchlistRes.error || listsRes.error) {
          console.error("Failed to fetch friend film data:", logsRes.error ?? watchlistRes.error ?? listsRes.error);
          setFilmDataFailed(true);
        }
        setWatchLogs(logsRes.error ? [] : (logsRes.data as WatchLog[]) || []);
        setWatchlist(watchlistRes.error ? [] : (watchlistRes.data as WatchlistItem[]) || []);
        setLists(listsRes.error ? [] : (listsRes.data as UserList[]) || []);
        // Music reads may be refused by database rules; that just means nothing to show.
        setListenLogs(listensRes.error ? [] : ((listensRes.data as ListenLog[]) ?? []));
        setMusicQueue(queueRes.error ? [] : ((queueRes.data as QueueItem[]) ?? []));

        // A failed taste_dna read is ignored: there is just no fingerprint to show.
        if (dnaRes.data?.fingerprint) setFingerprint(dnaRes.data.fingerprint);
      } catch (err) {
        console.error("Failed to fetch friend data:", err);
        setFilmDataFailed(true);
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

      if (error && error.code !== PG_UNIQUE_VIOLATION) {
        console.error("Failed to send friend request:", error);
        actionFailed(`Couldn't send your request to ${displayName}`);
        return;
      }

      if (data) {
        setFriendshipId(data.id);
        setRelationship("pending_sent");
      } else {
        // 23505: a friendship row already exists. Read it so the page shows where things really stand.
        const { data: existing, error: existingError } = await supabase
          .from("friendships")
          .select("id, requester_id, addressee_id, status")
          .or(pairFilter(user.id, profile.id));
        if (existingError) {
          console.error("Failed to read existing friendship:", existingError);
          actionFailed(`Couldn't confirm your friendship status with ${displayName}`);
          return;
        }
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
    reviews: countReviews(watchLogs),
    avgRating: averageRating(
      watchLogs.map((i) => i.rating),
      { includeUnrated: true },
    ),
  };

  const filmLists = lists.filter((l) => l.list_type !== "music");
  const musicLists = lists.filter((l) => l.list_type === "music");
  const filmEmpty = watchLogs.length === 0 && watchlist.length === 0 && filmLists.length === 0;
  const musicEmpty = listenLogs.length === 0 && musicQueue.length === 0 && musicLists.length === 0;

  const musicStats = {
    listens: listenLogs.length,
    albums: listenLogs.filter((i) => i.media_type === "album").length,
    tracks: listenLogs.filter((i) => i.media_type === "track").length,
    avgRating: averageRating(
      listenLogs.map((i) => i.rating),
      { includeUnrated: true },
    ),
  };

  const recentReviews = watchLogs
    .filter((l) => hasReview(l.review))
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

              {filmDataFailed ? (
                <Notice tone="error" title="Couldn't load their films and shows">
                  Reload the page to try again.
                </Notice>
              ) : filmEmpty ? (
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
                        {recentReviews.map((log) => (
                          <ActivityRow
                            key={log.id}
                            href={log.tmdb_id ? `/protected/media/${log.media_type}/${log.tmdb_id}` : undefined}
                            align="items-start"
                            thumbClass="h-[72px] w-12"
                            image={resizePoster(log.poster_url, "w185")}
                            FallbackIcon={log.media_type === "movie" ? Film : Tv}
                            title={log.title}
                            rating={Number(log.rating)}
                            meta={formatDate(log.created_at)}
                            extra={<span className="t-prose mt-2 line-clamp-2">{log.review}</span>}
                          />
                        ))}
                      </ul>
                    </section>
                  )}

                  {watchlist.length > 0 && (
                    <PreviewGrid
                      title="Watchlist"
                      meta={countLabel(watchlist.length, false)}
                      items={watchlist}
                      renderCard={(item) => (
                        <MediaCard
                          key={item.id}
                          title={item.title}
                          subtitle={item.media_type === "movie" ? "Film" : "TV"}
                          image={resizePoster(item.poster_url, "w342")}
                          aspect="poster"
                          href={mediaHref(item.media_type, { tmdbId: item.tmdb_id })}
                          fallbackIcon={item.media_type === "movie" ? Film : Tv}
                        />
                      )}
                    />
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
                        {listenLogs.slice(0, 5).map((log) => (
                          <ActivityRow
                            key={log.id}
                            href={log.spotify_id ? `/protected/media/${log.media_type}/${log.spotify_id}` : undefined}
                            align="items-center"
                            thumbClass="h-14 w-14"
                            image={log.image_url}
                            FallbackIcon={Music2}
                            title={log.title}
                            rating={Number(log.rating)}
                            meta={
                              <>
                                {log.artist ? `${log.artist} · ` : ""}
                                {formatDate(log.created_at)}
                              </>
                            }
                          />
                        ))}
                      </ul>
                    </section>
                  )}

                  {musicQueue.length > 0 && (
                    <PreviewGrid
                      title="Queue"
                      meta={countLabel(musicQueue.length, true)}
                      items={musicQueue}
                      renderCard={(item) => (
                        <MediaCard
                          key={item.id}
                          title={item.title}
                          subtitle={item.artist ?? (item.media_type === "album" ? "Album" : "Track")}
                          image={item.image_url}
                          aspect="square"
                          href={`/protected/media/${item.media_type}/${item.spotify_id}`}
                          fallbackIcon={item.media_type === "album" ? Disc3 : Music2}
                        />
                      )}
                    />
                  )}

                  <ProfileLists title="Music lists" lists={musicLists} noun="music" />
                </>
              )}
            </div>

            {/* Nothing in either domain */}
            {filmEmpty && musicEmpty && !filmDataFailed && (
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
