export type FriendshipRow = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: string;
};

export type RelationshipStatus = "self" | "friends" | "pending_sent" | "pending_received" | "none";

/** How the viewer stands with the other person on this row. */
export function relationshipFrom(row: FriendshipRow, viewerId: string): RelationshipStatus {
  if (row.status === "accepted") return "friends";
  return row.requester_id === viewerId ? "pending_sent" : "pending_received";
}

/** The person on the row who is not the viewer. */
export function otherParty(row: FriendshipRow, viewerId: string): string {
  return row.requester_id === viewerId ? row.addressee_id : row.requester_id;
}

/** Stand-in shown when a friendship's profile row could not be found. */
export function fallbackProfile(id: string) {
  return { id, username: "unknown", full_name: null, avatar_url: null };
}

/** PostgREST `or` filter matching a friendship between two people in either direction. */
export function pairFilter(a: string, b: string): string {
  return `and(requester_id.eq.${a},addressee_id.eq.${b}),and(requester_id.eq.${b},addressee_id.eq.${a})`;
}

/**
 * Splits one list of the viewer's friendship rows into accepted friends (rows the viewer sent
 * first, then rows they received), incoming requests and sent requests. Rows keep their order.
 */
export function splitFriendships<R extends FriendshipRow>(rows: R[], viewerId: string) {
  const accepted = rows.filter((r) => r.status === "accepted");
  const pending = rows.filter((r) => r.status === "pending");
  return {
    friends: [
      ...accepted.filter((r) => r.requester_id === viewerId),
      ...accepted.filter((r) => r.addressee_id === viewerId),
    ],
    incoming: pending.filter((r) => r.addressee_id === viewerId),
    sent: pending.filter((r) => r.requester_id === viewerId),
  };
}
