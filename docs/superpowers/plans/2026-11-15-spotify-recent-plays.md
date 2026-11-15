# Spotify Recent Plays Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A connected Spotify user can start a log from what they recently played, and music recommendations stop suggesting what they already play.

**Architecture:** One new pure module (`web/lib/spotify/recent.ts`) fetches and groups the last 50 plays. A new action on `/api/spotify/me` serves the grouped list to the log page; the recommend route passes the raw plays into `buildMusicRecs`, which widens its exclude set and prompt. Nothing is stored.

**Tech Stack:** Next.js App Router, TypeScript, Supabase, Vitest, Spotify Web API (development mode).

**Spec:** `docs/superpowers/specs/2026-11-15-spotify-recent-plays-design.md`

## Global Constraints

- All commands run from `web/`. After every task: `npm test`, `npm run lint`, `npx tsc --noEmit` all pass.
- No new Spotify scopes. Only `user-top-read user-read-recently-played` exist.
- Spotify data is optional: any Spotify failure degrades to today's behaviour, never an error shown to the user.
- Users who have not connected Spotify see no change at all.
- Recent plays are read live and never written to the database.
- Recent plays never create a log automatically; they only prefill the form.
- UI uses the existing primitives and tokens in `DESIGN.md` (`row-item`, `t-label`, `SectionHeader`, `Avatar`); no new colours, fonts or component styles.
- Commit messages follow the repo style (`feat:`, `fix:`, `docs:`) and carry **no** `Co-Authored-By` trailer.
- **Precondition:** the working tree must be clean before Task 1 (it had uncommitted edits to `recommend/route.ts`, `prompts.ts` and `app/page.tsx`, which this plan also touches). Do not start until the owner has committed or set those aside.

## Execution Notes (models and checks)

- Implementers: `sonnet` for Tasks 1, 3, 4; `haiku` for Task 2 (mechanical).
- Per-task reviewer: `sonnet`, fresh context, given the task text, the spec and the diff. It must run the three check commands itself and report their output.
- Task 5 whole-branch audit: one reviewer on the session's top model, given the spec, this plan and `git diff <base>..HEAD`.
- No parallel fan-out: tasks run one at a time, in order.

## Review Focus

1. Spotify answers recently-played with 204 or an empty body (new or idle account): the list is empty, nothing throws. (Task 1)
2. A play with a `null` track or a track with no `id` (local files): skipped, not crashed on. (Task 1)
3. A user who connected before the recently-played scope existed gets 403: the log page shows nothing and recs still generate. (Tasks 1, 3)
4. An album that is already logged and has 3+ recent tracks: the album row is dropped and its tracks do not come back as track rows. (Task 1)
5. A play just after local midnight: the prefilled listened date is the user's local day, not the UTC day. (Task 4)

## File Structure

- Create `web/lib/spotify/recent.ts` — fetch, group and label recent plays (pure except `fetchRecentPlays`).
- Create `web/lib/spotify/recent.test.ts`
- Create `web/components/log/recent-plays.tsx` — the list on the log page.
- Modify `web/app/api/spotify/me/route.ts` — `recently-played` action.
- Modify `web/app/api/spotify/route.ts`, `web/lib/spotify/spotify.ts` — remove new-releases.
- Modify `web/lib/ai/types.ts`, `web/lib/recs/music/tops.ts`, `web/lib/recs/music/build.ts`, `web/lib/ai/prompts.ts`, `web/app/api/ai/recommend/route.ts` — recs.
- Modify `web/app/protected/log/page.tsx`, `web/app/page.tsx` — UI and copy.

---

### Task 1: Recent plays module

**Files:**
- Create: `web/lib/spotify/recent.ts`
- Test: `web/lib/spotify/recent.test.ts`

**Interfaces:**
- Consumes: `RawTrack` from `@/lib/spotify/spotify` (`{ id, name, artists?, album?: RawAlbum }`).
- Produces:

```ts
export type RawPlay = { track: RawTrack | null; played_at: string };
export type RecentCandidate = {
  type: "album" | "track";
  id: string;              // Spotify track id or album id
  name: string;
  artist: string;          // artist names joined with ", "
  album_name: string;
  image_url: string | null;
  plays: number;           // track: times played; album: distinct tracks played
  last_played_at: string;  // ISO, the newest play in the group
};
export const ALBUM_THRESHOLD = 3;
/** null when Spotify rejects the token (401) or scope (403); [] on 204 or an empty body. Throws on other failures. */
export async function fetchRecentPlays(accessToken: string): Promise<RawPlay[] | null>;
export function groupRecentPlays(plays: RawPlay[], loggedIds: Set<string>, max?: number): RecentCandidate[]; // max defaults to 12
/** Local calendar day of an ISO timestamp as YYYY-MM-DD. */
export function localDay(iso: string): string;
/** "today", "yesterday", else e.g. "12 Nov". */
export function playedLabel(iso: string, now: Date): string;
```

- [ ] **Step 1: Write the failing tests** in `recent.test.ts`. Use a helper `play(trackId, albumId, at, over?)` building a `RawPlay` whose track is named `T-<trackId>`, artist `Artist`, album `{ id: albumId, name: "A-<albumId>" }`.

```ts
describe("groupRecentPlays", () => {
  test("one candidate per distinct track, newest first, counting plays", () => {
    const out = groupRecentPlays(
      [play("t1", "a1", "2026-11-15T10:00:00Z"), play("t2", "a2", "2026-11-15T09:00:00Z"), play("t1", "a1", "2026-11-14T10:00:00Z")],
      new Set(),
    );
    expect(out.map((c) => [c.type, c.id, c.plays])).toEqual([["track", "t1", 2], ["track", "t2", 1]]);
    expect(out[0].last_played_at).toBe("2026-11-15T10:00:00Z");
  });
  test("3 distinct tracks of one album fold into an album candidate", () => {
    const out = groupRecentPlays(
      [play("t1", "a1", "2026-11-15T10:00:00Z"), play("t2", "a1", "2026-11-15T09:00:00Z"), play("t3", "a1", "2026-11-15T08:00:00Z"), play("t1", "a1", "2026-11-15T07:00:00Z")],
      new Set(),
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ type: "album", id: "a1", name: "A-a1", plays: 3, last_played_at: "2026-11-15T10:00:00Z" });
  });
  test("2 distinct tracks of one album stay as tracks", () => { /* expect two track candidates */ });
  test("logged track ids are dropped", () => { /* loggedIds = new Set(["t1"]) → only t2 */ });
  test("a logged album with 3+ tracks is dropped and its tracks do not reappear", () => {
    /* three a1 tracks + one a2 track, loggedIds = new Set(["a1"]) → only the a2 track */
  });
  test("plays with a null track or a track without an id are skipped", () => {
    /* [{ track: null, played_at }, play with id "" ] → [] */
  });
  test("caps at max, default 12", () => { /* 15 distinct tracks → 12; max=2 → 2 */ });
  test("empty input gives an empty list", () => { expect(groupRecentPlays([], new Set())).toEqual([]); });
});

describe("fetchRecentPlays", () => { // vi.stubGlobal("fetch", ...)
  test("requests /v1/me/player/recently-played?limit=50 with the bearer token and returns items", ...);
  test("204 gives []", ...);
  test("200 with an empty body gives []", ...);
  test("401 and 403 give null", ...);
  test("500 throws", ...);
});

describe("localDay / playedLabel", () => {
  test("localDay uses local date parts", () => {
    const d = new Date(2026, 10, 15, 0, 5); // local 00:05 on 15 Nov
    expect(localDay(d.toISOString())).toBe("2026-11-15");
  });
  test("labels", () => {
    const now = new Date(2026, 10, 15, 12);
    expect(playedLabel(new Date(2026, 10, 15, 1).toISOString(), now)).toBe("today");
    expect(playedLabel(new Date(2026, 10, 14, 23).toISOString(), now)).toBe("yesterday");
    expect(playedLabel(new Date(2026, 10, 12, 9).toISOString(), now)).toBe("12 Nov");
  });
});
```

- [ ] **Step 2: Run** `npx vitest run lib/spotify/recent.test.ts` — expected: FAIL, module not found.
- [ ] **Step 3: Implement `recent.ts`** to the Interfaces block. Album grouping keys on `track.album.id`; a track with no album id is never folded. Album candidate fields come from the album (`album.name`, album artists, `album.images[0]`). Image for a track is `album.images[0]`. `playedLabel` compares local calendar days.
- [ ] **Step 4: Run** the test file — expected: PASS. Then `npm test && npm run lint && npx tsc --noEmit`.
- [ ] **Step 5: Commit** `feat: group recent Spotify plays into log candidates`

### Task 2: Recently-played endpoint and housekeeping

**Files:**
- Modify: `web/app/api/spotify/me/route.ts`
- Modify: `web/app/api/spotify/route.ts` (remove the `new-releases` action and import)
- Modify: `web/lib/spotify/spotify.ts` (remove `getNewReleases`)
- Modify: `web/app/page.tsx` (Spotify line, ~line 53)

**Interfaces:**
- Consumes: `fetchRecentPlays`, `groupRecentPlays`, `RecentCandidate` from Task 1.
- Produces: `GET /api/spotify/me?action=recently-played` → `RecentCandidate[]` (200), or `{ connected: false }` when there is no valid token or Spotify returns 401/403, or `{ error }` 500 — the same shapes `top-tracks` uses.

- [ ] **Step 1:** Add the `recently-played` branch: `fetchRecentPlays(accessToken)`; `null` → `{ connected: false, reason: "token_invalid" }`; otherwise read the user's `listen_logs.spotify_id` (filter `user_id`, drop nulls) into a `Set` and return `groupRecentPlays(plays, logged)`. A failed `listen_logs` read falls into the existing 500 path.
- [ ] **Step 2:** Delete `getNewReleases` and the `new-releases` action. Confirm with `grep -rn "new-releases\|getNewReleases" app lib components` → no matches.
- [ ] **Step 3:** In `app/page.tsx` set the Spotify detail to exactly: `Connect your account to log from your recent plays and sharpen your music picks.`
- [ ] **Step 4: Run** `npm test && npm run lint && npx tsc --noEmit` — all pass.
- [ ] **Step 5: Commit** `feat: recently-played endpoint; drop removed new-releases call`

### Task 3: Recommendations use recent plays

**Files:**
- Modify: `web/lib/ai/types.ts` (`SpotifyTops.tracks`)
- Modify: `web/lib/recs/music/tops.ts`
- Modify: `web/lib/recs/music/build.ts`, test `web/lib/recs/music/build.test.ts`
- Modify: `web/lib/ai/prompts.ts`
- Modify: `web/app/api/ai/recommend/route.ts` (`musicRecs`)

**Interfaces:**
- Consumes: `RawPlay`, `fetchRecentPlays`, `groupRecentPlays`, `ALBUM_THRESHOLD` from Task 1.
- Produces:
  - `SpotifyTops.tracks: Record<SpotifyRange, { id: string; name: string; artist: string }[]>`
  - `buildMusicRecs` deps gain `recent: RawPlay[] | null`
  - `buildMusicRecommendUserPrompt` data gains `recent?: { name: string; artist: string }[]`

- [ ] **Step 1: Write failing tests** in `build.test.ts` (add `id` to the fixture's top tracks: `st1`, `mt1`, `lt1`; pass `recent: null` in existing calls):

```ts
test("top tracks and recent plays are excluded from picks", async () => {
  // ai proposes rec(1), rec(2), rec(3); search returns hit(n) with ids sp1..sp3
  // tops.tracks.short_term[0].id = "sp1"; recent = [play("sp2", "alb", ...)]
  // → items ids are ["sp3"]
});
test("an album with 3+ recent tracks is excluded by album id", async () => {
  // recent = three distinct tracks of album "sp1" → items exclude sp1
});
test("the prompt lists recent plays and marks them as already in rotation", async () => {
  // capture the user prompt passed to ai
  expect(user).toContain("RECENTLY PLAYED (Spotify):");
  expect(user).toContain("T-r1 by Artist");
  expect(user).toContain("already in rotation");
});
test("recent: null changes nothing", async () => {
  // prompt has no "RECENTLY PLAYED"; items same as before
});
test("recent plays alone (no tops, under 5 rated logs) still returns not_enough_logs", ...);
```

- [ ] **Step 2: Run** `npx vitest run lib/recs/music/build.test.ts` — expected: FAIL.
- [ ] **Step 3: Implement.**
  - `tops.ts`: `RawTrack` gains `id`; map it through.
  - `build.ts`: add to `exclude` every `tops.tracks[range][].id`, every recent `track.id`, and the `id` of every album candidate from `groupRecentPlays(recent, new Set(), Infinity)`. Pass distinct recent tracks (first 30, newest first) to the prompt as `recent`.
  - `prompts.ts`: after the tops block, when `recent` is non-empty, push `\nRECENTLY PLAYED (Spotify): <name> by <artist>; …`. When tops or recent are present, push exactly: `The Spotify top tracks and recently played tracks above are already in rotation: use them as taste signal, do not recommend them.`
  - `route.ts`: inside the existing try that fetches tops, also `fetchRecentPlays(token)` (run both with `Promise.all`); each failing independently must not lose the other — give recent its own try/catch logging `Spotify recent plays fetch failed, continuing without it:`. Pass `recent` to `buildMusicRecs`.
- [ ] **Step 4: Run** the test file — PASS. Then `npm test && npm run lint && npx tsc --noEmit`.
- [ ] **Step 5: Commit** `feat: keep top and recent Spotify plays out of music picks`

### Task 4: Recent plays on the log page

**Files:**
- Create: `web/components/log/recent-plays.tsx`
- Modify: `web/app/protected/log/page.tsx`

**Interfaces:**
- Consumes: `RecentCandidate`, `localDay`, `playedLabel` (Task 1); `GET /api/spotify/me?action=recently-played` (Task 2); in the page: `chooseResult`, `setMediaType`, `setWatchedDate`, `setListenedOn`, `isEditMode`, `initialPrefill`, `mode`, `selectedMovie`, `title`.
- Produces: `export function RecentPlays({ onPick }: { onPick: (c: RecentCandidate) => void })`.

- [ ] **Step 1: Build `RecentPlays`.** On mount it fetches the endpoint once. It renders `null` while loading, on any non-array response (`{ connected: false }`, `{ error }`), on a thrown fetch, and on an empty array. Otherwise: a `t-label` heading `Recently played on Spotify` and a `<ul>` of `row-item` buttons, each showing cover (`Avatar`, square if the primitive supports it), `name · artist`, and a muted meta line: album → `album · {plays} tracks · {playedLabel}`; track → `track · {plays} play(s) · {playedLabel}`. Each row is a real `<button type="button">` with an accessible name `Log {name} by {artist}`.
- [ ] **Step 2: Wire into the page.** Render `<RecentPlays onPick={pickRecent} />` directly under the title search field only when `mode === "music" && !isEditMode && !initialPrefill && !selectedMovie && title.trim() === ""`. `pickRecent(c)`:
  1. `setMediaType(c.type)`;
  2. select it exactly as a search result is selected — build a `MediaSearchResult` the way `searchMusic` maps a `SpotifySearchResult` (`spotify_id: c.id`, `media_type: c.type`, name, artist, album_name, image) and set title, selection, `spotifyId`, `artist`, `albumName`. `chooseResult` reads `isSelectedMusic` from the current render, so set the music fields directly rather than relying on it after `setMediaType`;
  3. `setWatchedDate(localDay(c.last_played_at))` — confirm `watchedDate` is `YYYY-MM-DD` (see `today`); if not, convert to its format;
  4. `setListenedOn("Spotify")`.
- [ ] **Step 3: Check behaviours by reading the code paths:** picking a row closes the search panel and does not trigger a search (`selectedLabel === title`); clearing the title brings the list back; edit mode and pre-filled links never render it; film mode never renders or fetches it.
- [ ] **Step 4: Run** `npm test && npm run lint && npx tsc --noEmit` — all pass.
- [ ] **Step 5: Commit** `feat: start a music log from recent Spotify plays`

### Task 5: Whole-branch audit and live check

- [ ] **Step 1:** `npm test && npm run lint && npx tsc --noEmit && npm run build` — all pass; paste the tails.
- [ ] **Step 2:** Top-model reviewer reads the spec, this plan and the full branch diff against the Global Constraints and Review Focus lists; fix every confirmed finding and re-run Step 1.
- [ ] **Step 3: Live check** with `npm run dev` and a connected account: `/protected/log` in music mode shows the list; a track row and an album row each prefill type, title, artist, date and "Listened on: Spotify"; saving creates the log and the row is gone on return; film mode, edit mode and a disconnected account show no list and no console errors; refresh music picks on Discover and confirm none is a current top or recent track.
- [ ] **Step 4:** Report results to the owner with anything that could not be verified.
