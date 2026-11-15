import { beforeEach, describe, expect, it, vi } from "vitest";

const insert = vi.fn();
const getUser = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { getUser }, from: () => ({ insert }) }),
}));

import { saveToQueue, saveToWatchlist, titleKey } from "./saved-items";

const film = { tmdb_id: 1, title: "T", media_type: "movie", poster_url: null };

describe("titleKey", () => {
  it("pairs type and id, defaulting a missing type to movie", () => {
    expect(titleKey("tv", 5)).toBe("tv:5");
    expect(titleKey(null, 5)).toBe("movie:5");
  });
});

describe("saving", () => {
  beforeEach(() => {
    insert.mockReset();
    getUser.mockReset();
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  });

  it("writes the caller's row with the user id", async () => {
    insert.mockResolvedValue({ error: null });
    expect(await saveToWatchlist(film)).toBe("added");
    expect(insert).toHaveBeenCalledWith({ user_id: "u1", ...film });
  });

  it("reports signed out without writing", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect(await saveToWatchlist(film)).toBe("signed_out");
    expect(insert).not.toHaveBeenCalled();
  });

  it("maps a unique violation to duplicate and other errors to failed", async () => {
    const row = { spotify_id: "s", media_type: "album", title: "A", artist: "B", image_url: null };
    insert.mockResolvedValue({ error: { code: "23505" } });
    expect(await saveToQueue(row)).toBe("duplicate");
    insert.mockResolvedValue({ error: { code: "42501" } });
    expect(await saveToQueue(row)).toBe("failed");
  });

  it("reports unreachable when the request throws", async () => {
    insert.mockRejectedValue(new Error("offline"));
    expect(await saveToWatchlist(film)).toBe("unreachable");
  });
});
