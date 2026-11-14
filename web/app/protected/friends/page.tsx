"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Check, Mail, Search, UserPlus, Users, UserX, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Input } from "@/components/ui/input";
import { LoadingLine, RowListSkeleton } from "@/components/ui/loading";
import {
  Avatar,
  EmptyState,
  Field,
  Notice,
  PageHeader,
  SectionHeader,
} from "@/components/ui/page";
import { TabBar } from "@/components/ui/segmented-control";
import { useToast } from "@/components/ui/toast";
import { useMode } from "@/lib/mode-context";
import { escapeIlike } from "@/lib/postgrest";
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

const TAB_ID_BASE = "friends";

const displayName = (profile: Profile) => profile.full_name || profile.username;

/** One person in a ruled list: square avatar, name linking to their page, then the row's action. */
function PersonRow({ profile, children }: { profile: Profile; children?: React.ReactNode }) {
  const name = displayName(profile);
  return (
    <li className="row-item flex flex-wrap items-center gap-x-4 gap-y-2 px-1 py-3.5">
      <Avatar src={profile.avatar_url} name={name} size={44} />
      <div className="min-w-0 flex-1 basis-40">
        <Link
          href={`/protected/user/${profile.username}`}
          className="t-card block truncate transition-colors duration-cut ease-mech hover:text-primary focus-visible:text-primary"
        >
          {name}
        </Link>
        <p className="t-meta truncate">@{profile.username}</p>
      </div>
      {children && <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>}
    </li>
  );
}

export default function FriendsPage() {
  const { mode } = useMode();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<ActiveTab>("friends");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Friends state
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(true);
  const [friendsError, setFriendsError] = useState(false);

  // Requests state
  const [incoming, setIncoming] = useState<Friendship[]>([]);
  const [sent, setSent] = useState<Friendship[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [requestsError, setRequestsError] = useState(false);
  const [actioningId, setActioningId] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResultUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        fetchFriends(user.id);
        fetchRequests(user.id);
      } else {
        setFriendsLoading(false);
        setRequestsLoading(false);
        setFriendsError(true);
        setRequestsError(true);
      }
    }
    init();
  }, []);

  async function fetchFriends(userId: string, showSkeleton = false) {
    try {
      if (showSkeleton) setFriendsLoading(true);
      setFriendsError(false);
      const supabase = createClient();

      // Get accepted friendships where I'm requester
      const { data: asRequester, error: requesterError } = await supabase
        .from("friendships")
        .select("id, requester_id, addressee_id, status, created_at")
        .eq("requester_id", userId)
        .eq("status", "accepted");
      if (requesterError) throw requesterError;

      // Get accepted friendships where I'm addressee
      const { data: asAddressee, error: addresseeError } = await supabase
        .from("friendships")
        .select("id, requester_id, addressee_id, status, created_at")
        .eq("addressee_id", userId)
        .eq("status", "accepted");
      if (addresseeError) throw addresseeError;

      const allFriendships = [...(asRequester || []), ...(asAddressee || [])];

      // Get friend profile ids
      const friendIds = allFriendships.map((f) =>
        f.requester_id === userId ? f.addressee_id : f.requester_id
      );

      if (friendIds.length === 0) {
        setFriends([]);
        return;
      }

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url")
        .in("id", friendIds);
      if (profilesError) throw profilesError;

      const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

      const result: Friendship[] = allFriendships.map((f) => {
        const friendId = f.requester_id === userId ? f.addressee_id : f.requester_id;
        return {
          ...f,
          profile: profileMap.get(friendId) || { id: friendId, username: "unknown", full_name: null, avatar_url: null },
        };
      });

      setFriends(result);
    } catch (err) {
      console.error("fetchFriends failed:", err);
      setFriendsError(true);
    } finally {
      setFriendsLoading(false);
    }
  }

  async function fetchRequests(userId: string, showSkeleton = false) {
    try {
      if (showSkeleton) setRequestsLoading(true);
      setRequestsError(false);
      const supabase = createClient();

      // Incoming
      const { data: incomingData, error: incomingError } = await supabase
        .from("friendships")
        .select("id, requester_id, addressee_id, status, created_at")
        .eq("addressee_id", userId)
        .eq("status", "pending");
      if (incomingError) throw incomingError;

      const incomingIds = (incomingData || []).map((f) => f.requester_id);

      let incomingProfiles: Profile[] = [];
      if (incomingIds.length > 0) {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url")
          .in("id", incomingIds);
        if (error) throw error;
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
      const { data: sentData, error: sentError } = await supabase
        .from("friendships")
        .select("id, requester_id, addressee_id, status, created_at")
        .eq("requester_id", userId)
        .eq("status", "pending");
      if (sentError) throw sentError;

      const sentIds = (sentData || []).map((f) => f.addressee_id);

      let sentProfiles: Profile[] = [];
      if (sentIds.length > 0) {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url")
          .in("id", sentIds);
        if (error) throw error;
        sentProfiles = data || [];
      }

      const sentMap = new Map(sentProfiles.map((p) => [p.id, p]));
      setSent(
        (sentData || []).map((f) => ({
          ...f,
          profile: sentMap.get(f.addressee_id) || { id: f.addressee_id, username: "unknown", full_name: null, avatar_url: null },
        }))
      );
    } catch (err) {
      console.error("fetchRequests failed:", err);
      setRequestsError(true);
    } finally {
      setRequestsLoading(false);
    }
  }

  // Debounced search
  useEffect(() => {
    const q = escapeIlike(searchQuery).trim();
    if (!q || !currentUserId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clears results and errors when the search box is emptied
      setSearchResults([]);
      setSearchError(false);
      setIsSearching(false);
      return;
    }

    // A slower, earlier search must never overwrite a newer one.
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        setIsSearching(true);
        setSearchError(false);
        const supabase = createClient();

        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url")
          .or(`username.ilike.%${q}%,full_name.ilike.%${q}%`)
          .neq("id", currentUserId)
          .limit(20);
        if (cancelled) return;
        if (profilesError) throw profilesError;

        if (!profiles || profiles.length === 0) {
          setSearchResults([]);
          return;
        }

        // Check relationship status for each result
        const resultIds = profiles.map((p) => p.id);

        const { data: friendships, error: friendshipsError } = await supabase
          .from("friendships")
          .select("id, requester_id, addressee_id, status")
          .or(
            `and(requester_id.eq.${currentUserId},addressee_id.in.(${resultIds.join(",")})),and(addressee_id.eq.${currentUserId},requester_id.in.(${resultIds.join(",")}))`
          );
        if (cancelled) return;
        if (friendshipsError) throw friendshipsError;

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
      } catch (err) {
        if (cancelled) return;
        console.error("Friend search failed:", err);
        setSearchResults([]);
        setSearchError(true);
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [searchQuery, currentUserId]);

  async function handleSendRequest(target: Profile) {
    if (!currentUserId) return;
    setSendingTo(target.id);
    const supabase = createClient();
    const { error } = await supabase.from("friendships").insert({
      requester_id: currentUserId,
      addressee_id: target.id,
      status: "pending",
    });
    setSendingTo(null);

    // 23505: a request between these two people already exists, which is the outcome we wanted.
    if (error && error.code !== "23505") {
      console.error("handleSendRequest failed:", error);
      toast({
        mark: "Failed",
        tone: "error",
        title: `Couldn't send a request to ${displayName(target)}`,
        description: "Check your connection and try again.",
      });
      return;
    }

    setSearchResults((prev) =>
      prev.map((r) => (r.id === target.id ? { ...r, relationshipStatus: "pending_sent" } : r))
    );
    fetchRequests(currentUserId);
    toast({ mark: "Sent", title: `Friend request sent to ${displayName(target)}` });
  }

  async function handleAcceptRequest(friendshipId: string, from: Profile) {
    if (!currentUserId) return;
    setActioningId(friendshipId);
    const previousIncoming = incoming;
    setIncoming((prev) => prev.filter((r) => r.id !== friendshipId));
    const supabase = createClient();
    const { error } = await supabase
      .from("friendships")
      .update({ status: "accepted" })
      .eq("id", friendshipId);
    setActioningId(null);

    if (error) {
      setIncoming(previousIncoming);
      console.error("handleAcceptRequest failed:", error);
      toast({
        mark: "Failed",
        tone: "error",
        title: `Couldn't accept the request from ${displayName(from)}`,
        description: "Check your connection and try again.",
      });
      return;
    }

    setSearchResults((prev) =>
      prev.map((r) => (r.friendshipId === friendshipId ? { ...r, relationshipStatus: "friends" } : r))
    );
    fetchFriends(currentUserId);
    fetchRequests(currentUserId);
    toast({ mark: "Accepted", title: `You and ${displayName(from)} are now friends` });
  }

  async function handleDeclineOrCancel(friendshipId: string, other: Profile, kind: "decline" | "cancel") {
    if (!currentUserId) return;
    const previousIncoming = incoming;
    const previousSent = sent;
    setIncoming((prev) => prev.filter((r) => r.id !== friendshipId));
    setSent((prev) => prev.filter((r) => r.id !== friendshipId));
    const supabase = createClient();
    const { error } = await supabase.from("friendships").delete().eq("id", friendshipId);

    if (error) {
      setIncoming(previousIncoming);
      setSent(previousSent);
      console.error("handleDeclineOrCancel failed:", error);
      toast({
        mark: "Failed",
        tone: "error",
        title:
          kind === "decline"
            ? `Couldn't decline the request from ${displayName(other)}`
            : `Couldn't cancel your request to ${displayName(other)}`,
        description: "Check your connection and try again.",
      });
      return;
    }

    fetchRequests(currentUserId);
    toast(
      kind === "decline"
        ? { mark: "Declined", tone: "info", title: `Request from ${displayName(other)} declined` }
        : { mark: "Cancelled", tone: "info", title: `Request to ${displayName(other)} cancelled` }
    );
  }

  async function handleUnfriend(friendshipId: string, friend: Profile) {
    if (!currentUserId) return;
    const supabase = createClient();
    const { error } = await supabase.from("friendships").delete().eq("id", friendshipId);

    if (error) {
      console.error("handleUnfriend failed:", error);
      toast({
        mark: "Failed",
        tone: "error",
        title: `Couldn't remove ${displayName(friend)}`,
        description: "Check your connection and try again.",
      });
      return;
    }

    setFriends((prev) => prev.filter((f) => f.id !== friendshipId));
    toast({ mark: "Removed", tone: "info", title: `${displayName(friend)} removed from your friends` });
  }

  const pendingCount = incoming.length;
  const trimmedQuery = searchQuery.trim();

  return (
    <div>
      <PageHeader
        title={<>Your <em>friends</em></>}
        description={
          mode === "music" ? "Connect with other music lovers" : "Connect with other film lovers"
        }
      />

      <TabBar
        label="Friends sections"
        idBase={TAB_ID_BASE}
        value={activeTab}
        onChange={setActiveTab}
        tabs={[
          { value: "friends", label: "Friends", icon: Users, count: friends.length > 0 ? friends.length : undefined },
          {
            value: "requests",
            label: "Requests",
            icon: Mail,
            count: pendingCount > 0 ? pendingCount : undefined,
            countTone: "alert",
          },
          { value: "find", label: "Find", icon: Search },
        ]}
      />

      {/* ============ FRIENDS TAB ============ */}
      {activeTab === "friends" && (
        <div
          role="tabpanel"
          id={`${TAB_ID_BASE}-panel-friends`}
          aria-labelledby={`${TAB_ID_BASE}-tab-friends`}
          className="mt-8"
        >
          {friendsLoading ? (
            <RowListSkeleton count={4} />
          ) : friendsError ? (
            <Notice tone="error" title="Couldn't load your friends">
              <p>Check your connection and try again.</p>
              {currentUserId && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => fetchFriends(currentUserId, true)}
                >
                  Try again
                </Button>
              )}
            </Notice>
          ) : friends.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No friends yet"
              description="Search for people by username to start connecting."
              action={
                <Button onClick={() => setActiveTab("find")}>
                  <Search aria-hidden="true" /> Find friends
                </Button>
              }
            />
          ) : (
            <ul className="advance">
              {friends.map((f) => (
                <PersonRow key={f.id} profile={f.profile}>
                  <ConfirmButton
                    label="Remove"
                    confirmLabel="Confirm remove"
                    icon={UserX}
                    onConfirm={() => handleUnfriend(f.id, f.profile)}
                  />
                </PersonRow>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ============ REQUESTS TAB ============ */}
      {activeTab === "requests" && (
        <div
          role="tabpanel"
          id={`${TAB_ID_BASE}-panel-requests`}
          aria-labelledby={`${TAB_ID_BASE}-tab-requests`}
          className="mt-8"
        >
          {requestsLoading ? (
            <RowListSkeleton count={3} />
          ) : requestsError ? (
            <Notice tone="error" title="Couldn't load your requests">
              <p>Check your connection and try again.</p>
              {currentUserId && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => fetchRequests(currentUserId, true)}
                >
                  Try again
                </Button>
              )}
            </Notice>
          ) : (
            <div className="flex flex-col gap-16">
              {/* Incoming */}
              <section>
                <SectionHeader
                  title="Incoming requests"
                  meta={incoming.length > 0 ? incoming.length : undefined}
                />
                {incoming.length === 0 ? (
                  <EmptyState
                    className="py-10"
                    title="No pending requests"
                    description="When someone asks to be your friend, it will show up here."
                  />
                ) : (
                  <ul className="advance">
                    {incoming.map((req) => (
                      <PersonRow key={req.id} profile={req.profile}>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAcceptRequest(req.id, req.profile)}
                          disabled={actioningId === req.id}
                        >
                          <Check aria-hidden="true" />
                          {actioningId === req.id ? "Accepting…" : "Accept"}
                        </Button>
                        <ConfirmButton
                          label="Decline"
                          confirmLabel="Confirm decline"
                          tone="neutral"
                          icon={X}
                          disabled={actioningId === req.id}
                          onConfirm={() => handleDeclineOrCancel(req.id, req.profile, "decline")}
                        />
                      </PersonRow>
                    ))}
                  </ul>
                )}
              </section>

              {/* Sent */}
              <section>
                <SectionHeader
                  title="Sent requests"
                  meta={sent.length > 0 ? sent.length : undefined}
                />
                {sent.length === 0 ? (
                  <EmptyState
                    className="py-10"
                    title="No sent requests"
                    description="Requests you send wait here until they are answered."
                    action={
                      <Button variant="outline" onClick={() => setActiveTab("find")}>
                        <Search aria-hidden="true" /> Find friends
                      </Button>
                    }
                  />
                ) : (
                  <ul className="advance">
                    {sent.map((req) => (
                      <PersonRow key={req.id} profile={req.profile}>
                        <Badge variant="outline">Pending</Badge>
                        <ConfirmButton
                          label="Cancel request"
                          confirmLabel="Confirm cancel"
                          tone="neutral"
                          icon={X}
                          onConfirm={() => handleDeclineOrCancel(req.id, req.profile, "cancel")}
                        />
                      </PersonRow>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}
        </div>
      )}

      {/* ============ FIND FRIENDS TAB ============ */}
      {activeTab === "find" && (
        <div
          role="tabpanel"
          id={`${TAB_ID_BASE}-panel-find`}
          aria-labelledby={`${TAB_ID_BASE}-tab-find`}
          className="mt-8"
        >
          <Field label="Find people" htmlFor="friend-search" className="max-w-xl">
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id="friend-search"
                type="search"
                autoComplete="off"
                placeholder="Search by username or name"
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </Field>

          <div className="mt-6">
            {isSearching && <LoadingLine label="Searching" className="mb-4" />}

            {searchError && !isSearching && (
              <Notice tone="error" title="Search didn't go through">
                Check your connection, then change the search to try again.
              </Notice>
            )}

            {trimmedQuery && !isSearching && !searchError && searchResults.length === 0 && (
              <EmptyState
                icon={Search}
                title={<>No one found matching &ldquo;{trimmedQuery}&rdquo;</>}
                description="Check the spelling, or try their username instead of their name."
              />
            )}

            {searchResults.length > 0 && (
              <ul className="drawer-in">
                {searchResults.map((user) => (
                  <PersonRow key={user.id} profile={user}>
                    {user.relationshipStatus === "friends" ? (
                      <Badge>Friends</Badge>
                    ) : user.relationshipStatus === "pending_sent" ? (
                      <Badge variant="outline">Pending</Badge>
                    ) : user.relationshipStatus === "pending_received" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (user.friendshipId) handleAcceptRequest(user.friendshipId, user);
                        }}
                        disabled={actioningId === user.friendshipId}
                      >
                        <Check aria-hidden="true" />
                        {actioningId === user.friendshipId ? "Accepting…" : "Accept"}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSendRequest(user)}
                        disabled={sendingTo === user.id}
                      >
                        <UserPlus aria-hidden="true" />
                        {sendingTo === user.id ? "Sending…" : "Add friend"}
                      </Button>
                    )}
                  </PersonRow>
                ))}
              </ul>
            )}

            {!trimmedQuery && (
              <EmptyState
                icon={Search}
                title="Find friends"
                description="Search by username or name to find and connect with other users."
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
