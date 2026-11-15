import { PG_UNIQUE_VIOLATION } from "@/lib/postgrest";
import { createClient } from "@/lib/supabase/client";

/**
 * How a save ended. Callers map each to their own toast:
 * - `added`: a new row was written.
 * - `duplicate`: the unique constraint said it was already there.
 * - `signed_out`: there is no signed-in user.
 * - `failed`: the database rejected the row.
 * - `unreachable`: the request itself threw (network, client setup).
 */
export type SaveStatus = "added" | "duplicate" | "signed_out" | "failed" | "unreachable";

/** What gets written to `watchlist`, besides the user id. The caller decides every value. */
export type WatchlistRow = {
  tmdb_id: number;
  title: string;
  media_type: string;
  poster_url: string | null | undefined;
};

/** What gets written to `music_queue`, besides the user id. The caller decides every value. */
export type QueueRow = {
  spotify_id: string;
  media_type: string;
  title: string;
  artist: string | null;
  image_url: string | null | undefined;
};

/** TMDB movie and TV ids are separate namespaces, so a title is always the pair. */
export function titleKey(mediaType: string | null | undefined, id: number) {
  return `${mediaType ?? "movie"}:${id}`;
}

async function insertForUser(table: "watchlist" | "music_queue", row: object): Promise<SaveStatus> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return "signed_out";
    const { error } = await supabase.from(table).insert({ user_id: user.id, ...row });
    if (!error) return "added";
    return error.code === PG_UNIQUE_VIOLATION ? "duplicate" : "failed";
  } catch {
    return "unreachable";
  }
}

export function saveToWatchlist(row: WatchlistRow): Promise<SaveStatus> {
  return insertForUser("watchlist", row);
}

export function saveToQueue(row: QueueRow): Promise<SaveStatus> {
  return insertForUser("music_queue", row);
}
