import { describe, expect, it } from "vitest";
import {
  fallbackProfile,
  otherParty,
  pairFilter,
  relationshipFrom,
  splitFriendships,
} from "./friendships";

const row = (id: string, requester_id: string, addressee_id: string, status: string) => ({
  id,
  requester_id,
  addressee_id,
  status,
});

describe("relationshipFrom", () => {
  it("is friends when accepted, whoever asked", () => {
    expect(relationshipFrom(row("1", "me", "you", "accepted"), "me")).toBe("friends");
    expect(relationshipFrom(row("1", "you", "me", "accepted"), "me")).toBe("friends");
  });
  it("tells sent from received while pending", () => {
    expect(relationshipFrom(row("1", "me", "you", "pending"), "me")).toBe("pending_sent");
    expect(relationshipFrom(row("1", "you", "me", "pending"), "me")).toBe("pending_received");
  });
});

describe("otherParty / fallbackProfile / pairFilter", () => {
  it("picks the other person", () => {
    expect(otherParty(row("1", "me", "you", "pending"), "me")).toBe("you");
    expect(otherParty(row("1", "you", "me", "pending"), "me")).toBe("you");
  });
  it("builds the placeholder profile", () => {
    expect(fallbackProfile("x")).toEqual({ id: "x", username: "unknown", full_name: null, avatar_url: null });
  });
  it("matches both directions", () => {
    expect(pairFilter("a", "b")).toBe(
      "and(requester_id.eq.a,addressee_id.eq.b),and(requester_id.eq.b,addressee_id.eq.a)",
    );
  });
});

describe("splitFriendships", () => {
  const rows = [
    row("r1", "u", "a", "accepted"),
    row("q1", "b", "u", "accepted"),
    row("r2", "u", "c", "accepted"),
    row("i1", "d", "u", "pending"),
    row("s1", "u", "e", "pending"),
    row("i2", "f", "u", "pending"),
    row("x", "p", "q", "accepted"),
  ];
  const out = splitFriendships(rows, "u");

  it("lists friends the viewer asked before those who asked the viewer", () => {
    expect(out.friends.map((r) => r.id)).toEqual(["r1", "r2", "q1"]);
  });
  it("splits pending rows by direction, keeping order", () => {
    expect(out.incoming.map((r) => r.id)).toEqual(["i1", "i2"]);
    expect(out.sent.map((r) => r.id)).toEqual(["s1"]);
  });
  it("returns empty lists for no rows", () => {
    expect(splitFriendships([], "u")).toEqual({ friends: [], incoming: [], sent: [] });
  });
});
