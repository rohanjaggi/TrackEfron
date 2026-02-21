"use client";

import { useState, useEffect, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Film,
  Tv,
  Star,
  BookOpen,
  Clock,
  Calendar,
  Users,
  UserPlus,
  UserCheck,
  Loader2,
  Lock,
  ListMusic,
} from "lucide-react";
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
  list_items: { count: number }[];
};

type RelationshipStatus = "self" | "friends" | "pending_sent" | "pending_received" | "none";

function upscalePoster(url: string | null, size = "w185"): string | null {
  if (!url) return null;
  return url.replace(/\/w\d+\//, `/${size}/`);
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
  const targetUsername = params.username as string;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [relationship, setRelationship] = useState<RelationshipStatus>("none");
  const [friendshipId, setFriendshipId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Friend-visible data
  const [watchLogs, setWatchLogs] = useState<WatchLog[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [lists, setLists] = useState<UserList[]>([]);
  const [friendDataLoading, setFriendDataLoading] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, [targetUsername]);

  async function fetchProfile() {
    try {
      setLoading(true);
      const supabase = createClient();

      // Get target user's profile
      const { data: profileData, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("username", targetUsername)
        .single();

      if (error || !profileData) {
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
        const f = friendships[0];
        setFriendshipId(f.id);
        if (f.status === "accepted") {
          setRelationship("friends");
        } else if (f.requester_id === user.id) {
          setRelationship("pending_sent");
        } else {
          setRelationship("pending_received");
        }
      } else {
        setRelationship("none");
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  // Fetch friend data when relationship is "friends"
  useEffect(() => {
    if (relationship !== "friends" || !profile) return;

    async function fetchFriendData() {
      setFriendDataLoading(true);
      try {
        const supabase = createClient();

        const [logsRes, watchlistRes, listsRes] = await Promise.all([
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
            .select("id, name, emoji, description, list_items(count)")
            .eq("user_id", profile!.id)
            .order("updated_at", { ascending: false }),
        ]);

        setWatchLogs(logsRes.data || []);
        setWatchlist(watchlistRes.data || []);
        setLists((listsRes.data as UserList[]) || []);
      } catch {
        // silently fail — RLS will block if not friends
      } finally {
        setFriendDataLoading(false);
      }
    }
    fetchFriendData();
  }, [relationship, profile]);

  async function handleSendRequest() {
    if (!profile) return;
    setActionLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase.from("friendships").insert({
        requester_id: user.id,
        addressee_id: profile.id,
      });
      if (error && error.code !== "23505") throw error;
      setRelationship("pending_sent");
    } catch {
      // silently fail
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAccept() {
    if (!friendshipId) return;
    setActionLoading(true);
    try {
      const supabase = createClient();
      await supabase
        .from("friendships")
        .update({ status: "accepted" })
        .eq("id", friendshipId);
      setRelationship("friends");
    } catch {
      // silently fail
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCancel() {
    if (!friendshipId) return;
    setActionLoading(true);
    try {
      const supabase = createClient();
      await supabase.from("friendships").delete().eq("id", friendshipId);
      setRelationship("none");
      setFriendshipId(null);
    } catch {
      // silently fail
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col gap-4 max-w-3xl mx-auto">
        <Link
          href="/protected/friends"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Friends
        </Link>
        <div className="border-2 border-destructive bg-destructive/10 p-6 text-destructive text-center">
          User not found
        </div>
      </div>
    );
  }

  const memberSince = new Date(profile.created_at).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const stats = {
    watched: watchLogs.length,
    movies: watchLogs.filter((i) => i.media_type === "movie").length,
    tvShows: watchLogs.filter((i) => i.media_type === "tv").length,
    reviews: watchLogs.filter((i) => i.review && i.review.trim().length > 0).length,
    avgRating: watchLogs.length > 0
      ? (watchLogs.reduce((acc, i) => acc + Number(i.rating), 0) / watchLogs.length).toFixed(1)
      : "—",
  };

  const recentReviews = watchLogs
    .filter((l) => l.review && l.review.trim().length > 0)
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-8 max-w-4xl mx-auto w-full">
      {/* Back link */}
      <Link
        href="/protected/friends"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Friends
      </Link>

      {/* Backdrop Banner */}
      <div className="relative -mb-20 h-44 w-screen left-1/2 -translate-x-1/2">
        <div
          className="absolute inset-0"
          style={{
            background: profile.profile_color
              ? `radial-gradient(ellipse 80% 100% at 50% 0%, ${profile.profile_color}40 0%, ${profile.profile_color}18 50%, transparent 100%)`
              : "radial-gradient(ellipse 80% 100% at 50% 0%, hsl(var(--primary) / 0.15) 0%, hsl(var(--primary) / 0.05) 50%, transparent 100%)",
          }}
        />
      </div>

      {/* Profile Header */}
      <div className="flex flex-col items-center text-center gap-6 pb-8 border-b-2 border-border">
        {/* Avatar */}
        <div className="w-28 h-28 border-4 border-primary p-1 bg-card">
          <div className="w-full h-full bg-card flex items-center justify-center overflow-hidden">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.full_name || profile.username}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="font-display text-4xl font-bold text-primary">
                {(profile.full_name || profile.username).charAt(0).toUpperCase()}
              </span>
            )}
          </div>
        </div>

        {/* Name & Username */}
        <div>
          <h1 className="font-display text-3xl font-bold mb-1">
            {profile.full_name || profile.username}
          </h1>
          <p className="text-muted-foreground">@{profile.username}</p>
        </div>

        {/* Member Since */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="w-4 h-4" />
          <span>Member since {memberSince}</span>
        </div>

        {/* Friendship Action */}
        {relationship === "none" && (
          <Button onClick={handleSendRequest} disabled={actionLoading}>
            {actionLoading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <UserPlus className="w-4 h-4 mr-2" />
            )}
            Add Friend
          </Button>
        )}
        {relationship === "pending_sent" && (
          <Button variant="outline" className="border-2" onClick={handleCancel} disabled={actionLoading}>
            <Clock className="w-4 h-4 mr-2" />
            Request Sent — Cancel
          </Button>
        )}
        {relationship === "pending_received" && (
          <div className="flex gap-2">
            <Button onClick={handleAccept} disabled={actionLoading}>
              <UserCheck className="w-4 h-4 mr-2" /> Accept Request
            </Button>
            <Button variant="outline" className="border-2" onClick={handleCancel} disabled={actionLoading}>
              Decline
            </Button>
          </div>
        )}
        {relationship === "friends" && (
          <span className="flex items-center gap-2 text-sm text-primary font-medium px-4 py-2 border-2 border-primary/30 rounded-md">
            <UserCheck className="w-4 h-4" /> Friends
          </span>
        )}
      </div>

      {/* Friend-only content */}
      {relationship === "friends" ? (
        friendDataLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 md:grid-cols-5 gap-4">
              <div className="border-2 border-border p-5 text-center">
                <Film className="w-5 h-5 text-primary mx-auto mb-2" />
                <div className="text-2xl font-bold">{stats.watched}</div>
                <p className="text-xs text-muted-foreground">Watched</p>
              </div>
              <div className="border-2 border-border p-5 text-center">
                <Film className="w-5 h-5 text-accent mx-auto mb-2" />
                <div className="text-2xl font-bold">{stats.movies}</div>
                <p className="text-xs text-muted-foreground">Movies</p>
              </div>
              <div className="border-2 border-border p-5 text-center">
                <Tv className="w-5 h-5 text-secondary mx-auto mb-2" />
                <div className="text-2xl font-bold">{stats.tvShows}</div>
                <p className="text-xs text-muted-foreground">TV Shows</p>
              </div>
              <div className="border-2 border-border p-5 text-center">
                <BookOpen className="w-5 h-5 text-accent mx-auto mb-2" />
                <div className="text-2xl font-bold">{stats.reviews}</div>
                <p className="text-xs text-muted-foreground">Reviews</p>
              </div>
              <div className="border-2 border-border p-5 text-center">
                <Star className="w-5 h-5 text-accent fill-accent mx-auto mb-2" />
                <div className="text-2xl font-bold">{stats.avgRating}</div>
                <p className="text-xs text-muted-foreground">Avg Rating</p>
              </div>
            </div>

            {/* Recent Reviews */}
            {recentReviews.length > 0 && (
              <div className="border-2 border-border p-6">
                <h2 className="font-display text-xl font-bold mb-4 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-primary" />
                  Recent Reviews
                </h2>
                <div className="space-y-4">
                  {recentReviews.map((log) => (
                    <Link
                      key={log.id}
                      href={log.tmdb_id ? `/protected/media/${log.media_type}/${log.tmdb_id}` : "#"}
                      className="flex items-start gap-4 p-3 -mx-3 hover:bg-muted/20 transition-colors rounded-lg"
                    >
                      <div className="w-12 h-16 border border-primary/30 flex items-center justify-center shrink-0 bg-primary/5 overflow-hidden">
                        {log.poster_url ? (
                          <img
                            src={upscalePoster(log.poster_url)!}
                            alt={log.title}
                            className="w-full h-full object-cover"
                          />
                        ) : log.media_type === "movie" ? (
                          <Film className="w-5 h-5 text-primary" />
                        ) : (
                          <Tv className="w-5 h-5 text-primary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold truncate">{log.title}</h3>
                          <span className="flex items-center gap-1 text-sm shrink-0">
                            <Star className="w-3.5 h-3.5 text-accent fill-accent" />
                            {log.rating}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">{log.review}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Watchlist */}
            {watchlist.length > 0 && (
              <div className="border-2 border-border p-6">
                <h2 className="font-display text-xl font-bold mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  Watchlist
                  <span className="text-sm font-normal text-muted-foreground">({watchlist.length})</span>
                </h2>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                  {watchlist.slice(0, 12).map((item) => (
                    <Link
                      key={item.id}
                      href={`/protected/media/${item.media_type}/${item.tmdb_id}`}
                      className="group border border-border overflow-hidden hover:border-primary transition-colors"
                    >
                      <div className="aspect-[2/3] bg-gradient-to-br from-primary/20 via-accent/10 to-secondary/20 flex items-center justify-center overflow-hidden">
                        {item.poster_url ? (
                          <img
                            src={upscalePoster(item.poster_url)!}
                            alt={item.title}
                            className="w-full h-full object-cover"
                          />
                        ) : item.media_type === "movie" ? (
                          <Film className="w-8 h-8 text-white/50" />
                        ) : (
                          <Tv className="w-8 h-8 text-white/50" />
                        )}
                      </div>
                      <div className="p-2">
                        <p className="text-xs font-medium truncate group-hover:text-primary transition-colors">
                          {item.title}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
                {watchlist.length > 12 && (
                  <p className="text-sm text-muted-foreground text-center mt-4">
                    +{watchlist.length - 12} more
                  </p>
                )}
              </div>
            )}

            {/* Lists */}
            {lists.length > 0 && (
              <div className="border-2 border-border p-6">
                <h2 className="font-display text-xl font-bold mb-4 flex items-center gap-2">
                  <ListMusic className="w-5 h-5 text-primary" />
                  Lists
                </h2>
                <div className="grid sm:grid-cols-2 gap-3">
                  {lists.map((list) => {
                    const itemCount = list.list_items?.[0]?.count ?? 0;
                    return (
                      <div
                        key={list.id}
                        className="border border-border p-4 flex items-start gap-3"
                      >
                        <span className="text-2xl">{list.emoji || "🎬"}</span>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold truncate">{list.name}</h3>
                          {list.description && (
                            <p className="text-sm text-muted-foreground line-clamp-1">{list.description}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {itemCount} {itemCount === 1 ? "title" : "titles"}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* No activity */}
            {watchLogs.length === 0 && watchlist.length === 0 && lists.length === 0 && (
              <div className="border-2 border-border p-8 text-center">
                <p className="text-muted-foreground">
                  {profile.full_name || profile.username} hasn&apos;t logged any activity yet.
                </p>
              </div>
            )}
          </>
        )
      ) : relationship !== "self" ? (
        /* Non-friend locked view */
        <div className="border-2 border-border p-12 text-center">
          <Lock className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Private Profile</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Add {profile.full_name || profile.username} as a friend to see their watched movies, reviews, watchlist, and lists.
          </p>
        </div>
      ) : null}
    </div>
  );
}
