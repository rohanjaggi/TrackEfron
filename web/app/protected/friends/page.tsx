"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Users,
  Search,
  UserPlus,
  UserCheck,
  UserX,
  Clock,
  Check,
  X,
  Loader2,
  Mail,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type ActiveTab = "friends" | "requests" | "find";

type Profile = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
};

type Friendship = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: string;
  created_at: string;
  profile: Profile;
};

type SearchResultUser = Profile & {
  relationshipStatus: "none" | "pending_sent" | "pending_received" | "friends";
  friendshipId?: string;
};

export default function FriendsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActiveTab>("friends");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Friends state
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(true);
  const [unfriendingId, setUnfriendingId] = useState<string | null>(null);
  const [confirmUnfriendId, setConfirmUnfriendId] = useState<string | null>(null);

  // Requests state
  const [incoming, setIncoming] = useState<Friendship[]>([]);
  const [sent, setSent] = useState<Friendship[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResultUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        fetchFriends(user.id);
        fetchRequests(user.id);
      }
    }
    init();
  }, []);

  async function fetchFriends(userId: string) {
    try {
      setFriendsLoading(true);
      const supabase = createClient();

      // Get accepted friendships where I'm requester
      const { data: asRequester } = await supabase
        .from("friendships")
        .select("id, requester_id, addressee_id, status, created_at")
        .eq("requester_id", userId)
        .eq("status", "accepted");

      // Get accepted friendships where I'm addressee
      const { data: asAddressee } = await supabase
        .from("friendships")
        .select("id, requester_id, addressee_id, status, created_at")
        .eq("addressee_id", userId)
        .eq("status", "accepted");

      const allFriendships = [...(asRequester || []), ...(asAddressee || [])];

      // Get friend profile ids
      const friendIds = allFriendships.map((f) =>
        f.requester_id === userId ? f.addressee_id : f.requester_id
      );

      if (friendIds.length === 0) {
        setFriends([]);
        setFriendsLoading(false);
        return;
      }

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url")
        .in("id", friendIds);

      const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

      const result: Friendship[] = allFriendships.map((f) => {
        const friendId = f.requester_id === userId ? f.addressee_id : f.requester_id;
        return {
          ...f,
          profile: profileMap.get(friendId) || { id: friendId, username: "unknown", full_name: null, avatar_url: null },
        };
      });

      setFriends(result);
    } catch {
      // silently fail
    } finally {
      setFriendsLoading(false);
    }
  }

  async function fetchRequests(userId: string) {
    try {
      setRequestsLoading(true);
      const supabase = createClient();

      // Incoming
      const { data: incomingData } = await supabase
        .from("friendships")
        .select("id, requester_id, addressee_id, status, created_at")
        .eq("addressee_id", userId)
        .eq("status", "pending");

      const incomingIds = (incomingData || []).map((f) => f.requester_id);

      let incomingProfiles: Profile[] = [];
      if (incomingIds.length > 0) {
        const { data } = await supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url")
          .in("id", incomingIds);
        incomingProfiles = data || [];
      }

      const inMap = new Map(incomingProfiles.map((p) => [p.id, p]));
      setIncoming(
        (incomingData || []).map((f) => ({
          ...f,
          profile: inMap.get(f.requester_id) || { id: f.requester_id, username: "unknown", full_name: null, avatar_url: null },
        }))
      );

      // Sent
      const { data: sentData } = await supabase
        .from("friendships")
        .select("id, requester_id, addressee_id, status, created_at")
        .eq("requester_id", userId)
        .eq("status", "pending");

      const sentIds = (sentData || []).map((f) => f.addressee_id);

      let sentProfiles: Profile[] = [];
      if (sentIds.length > 0) {
        const { data } = await supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url")
          .in("id", sentIds);
        sentProfiles = data || [];
      }

      const sentMap = new Map(sentProfiles.map((p) => [p.id, p]));
      setSent(
        (sentData || []).map((f) => ({
          ...f,
          profile: sentMap.get(f.addressee_id) || { id: f.addressee_id, username: "unknown", full_name: null, avatar_url: null },
        }))
      );
    } catch {
      // silently fail
    } finally {
      setRequestsLoading(false);
    }
  }

  // Debounced search
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q || !currentUserId) {
      setSearchResults([]);
      return;
    }

    const t = setTimeout(async () => {
      try {
        setIsSearching(true);
        const supabase = createClient();

        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url")
          .or(`username.ilike.%${q}%,full_name.ilike.%${q}%`)
          .neq("id", currentUserId)
          .limit(20);

        if (!profiles || profiles.length === 0) {
          setSearchResults([]);
          return;
        }

        // Check relationship status for each result
        const resultIds = profiles.map((p) => p.id);

        const { data: friendships } = await supabase
          .from("friendships")
          .select("id, requester_id, addressee_id, status")
          .or(
            `and(requester_id.eq.${currentUserId},addressee_id.in.(${resultIds.join(",")})),and(addressee_id.eq.${currentUserId},requester_id.in.(${resultIds.join(",")}))`
          );

        const friendshipMap = new Map<string, { status: string; friendshipId: string; direction: "sent" | "received" }>();
        for (const f of friendships || []) {
          const otherId = f.requester_id === currentUserId ? f.addressee_id : f.requester_id;
          const direction = f.requester_id === currentUserId ? "sent" : "received";
          friendshipMap.set(otherId, { status: f.status, friendshipId: f.id, direction });
        }

        const results: SearchResultUser[] = profiles.map((p) => {
          const rel = friendshipMap.get(p.id);
          let relationshipStatus: SearchResultUser["relationshipStatus"] = "none";
          if (rel) {
            if (rel.status === "accepted") relationshipStatus = "friends";
            else if (rel.direction === "sent") relationshipStatus = "pending_sent";
            else relationshipStatus = "pending_received";
          }
          return {
            ...p,
            relationshipStatus,
            friendshipId: rel?.friendshipId,
          };
        });

        setSearchResults(results);
      } catch {
        // silently fail
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => clearTimeout(t);
  }, [searchQuery, currentUserId]);

  async function handleSendRequest(targetId: string) {
    if (!currentUserId) return;
    setSendingTo(targetId);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("friendships").insert({
        requester_id: currentUserId,
        addressee_id: targetId,
      });
      if (error && error.code !== "23505") throw error;

      // Update search results
      setSearchResults((prev) =>
        prev.map((r) =>
          r.id === targetId ? { ...r, relationshipStatus: "pending_sent" } : r
        )
      );
      // Refresh sent requests
      fetchRequests(currentUserId);
    } catch {
      // silently fail
    } finally {
      setSendingTo(null);
    }
  }

  async function handleAcceptRequest(friendshipId: string) {
    if (!currentUserId) return;
    setActioningId(friendshipId);
    try {
      const supabase = createClient();
      await supabase
        .from("friendships")
        .update({ status: "accepted" })
        .eq("id", friendshipId);

      fetchFriends(currentUserId);
      fetchRequests(currentUserId);
    } catch {
      // silently fail
    } finally {
      setActioningId(null);
    }
  }

  async function handleDeclineOrCancel(friendshipId: string) {
    if (!currentUserId) return;
    setActioningId(friendshipId);
    try {
      const supabase = createClient();
      await supabase.from("friendships").delete().eq("id", friendshipId);
      fetchRequests(currentUserId);
    } catch {
      // silently fail
    } finally {
      setActioningId(null);
    }
  }

  async function handleUnfriend(friendshipId: string) {
    if (!currentUserId) return;
    setUnfriendingId(friendshipId);
    try {
      const supabase = createClient();
      await supabase.from("friendships").delete().eq("id", friendshipId);
      setFriends(friends.filter((f) => f.id !== friendshipId));
      setConfirmUnfriendId(null);
    } catch {
      // silently fail
    } finally {
      setUnfriendingId(null);
    }
  }

  const pendingCount = incoming.length;

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">Friends</h1>
        <p className="text-muted-foreground">
          Connect with other movie lovers
        </p>
      </div>

      {/* Tab Bar */}
      <div className="flex items-center gap-1 border-2 border-border p-1 w-fit">
        <button
          onClick={() => setActiveTab("friends")}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "friends"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users className="w-4 h-4" />
          Friends
          {friends.length > 0 && (
            <span className="ml-1 text-xs opacity-70">({friends.length})</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("requests")}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium transition-colors relative ${
            activeTab === "requests"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Mail className="w-4 h-4" />
          Requests
          {pendingCount > 0 && (
            <span className="ml-1 min-w-[20px] h-5 flex items-center justify-center text-xs font-bold bg-destructive text-destructive-foreground rounded-full px-1.5">
              {pendingCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("find")}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "find"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Search className="w-4 h-4" />
          Find Friends
        </button>
      </div>

      {/* ============ FRIENDS TAB ============ */}
      {activeTab === "friends" && (
        <>
          {friendsLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : friends.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 rounded-full bg-card/50 flex items-center justify-center mb-6">
                <Users className="w-10 h-10 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-semibold mb-2">No friends yet</h2>
              <p className="text-muted-foreground mb-6 max-w-md">
                Search for people by username to start connecting.
              </p>
              <Button onClick={() => setActiveTab("find")}>
                <Search className="w-4 h-4 mr-2" /> Find Friends
              </Button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {friends.map((f) => (
                <div
                  key={f.id}
                  className="group border-2 border-border p-5 hover:border-primary transition-all duration-300 cursor-pointer relative"
                  onClick={() => router.push(`/protected/user/${f.profile.username}`)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full overflow-hidden bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center shrink-0">
                      {f.profile.avatar_url ? (
                        <img src={f.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="font-display text-xl font-bold text-primary">
                          {(f.profile.full_name || f.profile.username).charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate group-hover:text-primary transition-colors">
                        {f.profile.full_name || f.profile.username}
                      </h3>
                      <p className="text-sm text-muted-foreground">@{f.profile.username}</p>
                    </div>
                  </div>

                  {/* Unfriend button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirmUnfriendId === f.id) {
                        handleUnfriend(f.id);
                      } else {
                        setConfirmUnfriendId(f.id);
                        setTimeout(() => setConfirmUnfriendId(null), 3000);
                      }
                    }}
                    className={`absolute top-3 right-3 p-2 rounded-lg transition-colors ${
                      confirmUnfriendId === f.id
                        ? "bg-destructive text-destructive-foreground"
                        : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    }`}
                    title={confirmUnfriendId === f.id ? "Click to confirm" : "Unfriend"}
                  >
                    {unfriendingId === f.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <UserX className="w-4 h-4" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ============ REQUESTS TAB ============ */}
      {activeTab === "requests" && (
        <>
          {requestsLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-8">
              {/* Incoming */}
              <div>
                <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-primary" />
                  Incoming Requests
                  {incoming.length > 0 && (
                    <span className="text-sm font-normal text-muted-foreground">({incoming.length})</span>
                  )}
                </h2>
                {incoming.length === 0 ? (
                  <div className="border-2 border-border p-6 text-center">
                    <p className="text-muted-foreground text-sm">No pending requests</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {incoming.map((req) => (
                      <div
                        key={req.id}
                        className="border-2 border-border p-4 flex items-center gap-4"
                      >
                        <div
                          className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center shrink-0 cursor-pointer"
                          onClick={() => router.push(`/protected/user/${req.profile.username}`)}
                        >
                          {req.profile.avatar_url ? (
                            <img src={req.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="font-display text-lg font-bold text-primary">
                              {(req.profile.full_name || req.profile.username).charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold truncate">
                            {req.profile.full_name || req.profile.username}
                          </h3>
                          <p className="text-sm text-muted-foreground">@{req.profile.username}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleAcceptRequest(req.id)}
                            disabled={actioningId === req.id}
                          >
                            {actioningId === req.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <><Check className="w-4 h-4 mr-1" /> Accept</>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-2"
                            onClick={() => handleDeclineOrCancel(req.id)}
                            disabled={actioningId === req.id}
                          >
                            <X className="w-4 h-4 mr-1" /> Decline
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Sent */}
              <div>
                <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-muted-foreground" />
                  Sent Requests
                  {sent.length > 0 && (
                    <span className="text-sm font-normal text-muted-foreground">({sent.length})</span>
                  )}
                </h2>
                {sent.length === 0 ? (
                  <div className="border-2 border-border p-6 text-center">
                    <p className="text-muted-foreground text-sm">No sent requests</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sent.map((req) => (
                      <div
                        key={req.id}
                        className="border-2 border-border p-4 flex items-center gap-4"
                      >
                        <div
                          className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center shrink-0 cursor-pointer"
                          onClick={() => router.push(`/protected/user/${req.profile.username}`)}
                        >
                          {req.profile.avatar_url ? (
                            <img src={req.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="font-display text-lg font-bold text-primary">
                              {(req.profile.full_name || req.profile.username).charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold truncate">
                            {req.profile.full_name || req.profile.username}
                          </h3>
                          <p className="text-sm text-muted-foreground">@{req.profile.username}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground">Pending</span>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-2"
                            onClick={() => handleDeclineOrCancel(req.id)}
                            disabled={actioningId === req.id}
                          >
                            {actioningId === req.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <><X className="w-4 h-4 mr-1" /> Cancel</>
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ============ FIND FRIENDS TAB ============ */}
      {activeTab === "find" && (
        <>
          <div className="relative max-w-xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Search by username or name..."
              className="pl-12 py-6 text-lg bg-card border-2 border-border"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {isSearching && (
              <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-muted-foreground" />
            )}
          </div>

          {searchQuery.trim() && !isSearching && searchResults.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No users found matching &ldquo;{searchQuery}&rdquo;</p>
            </div>
          )}

          {searchResults.length > 0 && (
            <div className="space-y-3">
              {searchResults.map((user) => (
                <div
                  key={user.id}
                  className="border-2 border-border p-4 flex items-center gap-4 hover:border-primary/50 transition-colors"
                >
                  <div
                    className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center shrink-0 cursor-pointer"
                    onClick={() => router.push(`/protected/user/${user.username}`)}
                  >
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-display text-lg font-bold text-primary">
                        {(user.full_name || user.username).charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => router.push(`/protected/user/${user.username}`)}
                  >
                    <h3 className="font-semibold truncate">{user.full_name || user.username}</h3>
                    <p className="text-sm text-muted-foreground">@{user.username}</p>
                  </div>
                  <div>
                    {user.relationshipStatus === "friends" ? (
                      <span className="flex items-center gap-1.5 text-sm text-primary font-medium px-3 py-1.5 border-2 border-primary/30 rounded-md">
                        <UserCheck className="w-4 h-4" /> Friends
                      </span>
                    ) : user.relationshipStatus === "pending_sent" ? (
                      <span className="flex items-center gap-1.5 text-sm text-muted-foreground px-3 py-1.5 border border-border rounded-md">
                        <Clock className="w-4 h-4" /> Pending
                      </span>
                    ) : user.relationshipStatus === "pending_received" ? (
                      <Button
                        size="sm"
                        onClick={() => {
                          if (user.friendshipId) handleAcceptRequest(user.friendshipId);
                        }}
                        disabled={actioningId === user.friendshipId}
                      >
                        <Check className="w-4 h-4 mr-1" /> Accept
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-2"
                        onClick={() => handleSendRequest(user.id)}
                        disabled={sendingTo === user.id}
                      >
                        {sendingTo === user.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <><UserPlus className="w-4 h-4 mr-1" /> Add Friend</>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!searchQuery.trim() && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-20 h-20 rounded-full bg-card/50 flex items-center justify-center mb-6">
                <Search className="w-10 h-10 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Find Friends</h2>
              <p className="text-muted-foreground max-w-md">
                Search by username or name to find and connect with other users.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
