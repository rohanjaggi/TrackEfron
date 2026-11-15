# Spotify recent plays: log from them, and keep them out of recs

Date: 2026-11-15. Size: small change (short design).

## Intent

Connecting Spotify today only changes Discover (top tracks row, tops in the
recs prompt, the "Right now" strip). A connected user logs exactly like an
unconnected one, and the `user-read-recently-played` permission the connect
flow already requests is never used. This change makes the connection pay off
on the two things the app is for: logging and recommendations.

## Goals

1. On the log page, a connected user sees what they recently played and can
   start a log from it in one tap.
2. Music recommendations stop suggesting things the user already plays, and
   use recent plays as a taste signal.
3. The landing page describes what connecting really does.

## Non-goals

- No new Spotify permissions, so no reconnect. Now-playing, saved-album import
  and writing back to Spotify are later work.
- No dashboard nudges, no Taste DNA changes.
- No stored listening history: recent plays are read live, never saved.

## Anti-goals

- Auto-creating logs. A log is a deliberate rating; recent plays only prefill.
- Any visible change or error for users who have not connected Spotify.

## Constraints

- Spotify returns only the last 50 plays, tracks only, and nothing older.
- Development-mode app: 5 allowlisted users, search capped at 10 per request,
  `/browse/new-releases` removed.
- Spotify data is optional context everywhere: every failure degrades to the
  current behaviour.

## Approaches

- **A. Read live, on demand (chosen).** A new action on `/api/spotify/me`
  reads the last 50 plays each time; a pure function groups them. No schema
  change, nothing to keep in sync. Limited to 50 plays, which is enough for
  "what did I just listen to".
- **B. Sync plays into a table on a schedule.** Gives real history beyond 50
  plays and play counts over time, but needs a table, a cron job, and token
  use while the user is away. Too much for a 5-user app; revisit if history
  features are wanted.
- **C. Client calls Spotify directly.** Rejected: tokens live server-side.

## Design

### Recent plays API

`GET /api/spotify/me?action=recently-played` (same auth and
`{ connected: false }` behaviour as `top-tracks`):

- Calls `GET /v1/me/player/recently-played?limit=50`.
- Passes the raw items and the user's logged `spotify_id`s (from
  `listen_logs`) to a pure function `groupRecentPlays` in
  `web/lib/spotify/recent.ts`.
- `groupRecentPlays` returns candidates, newest first:
  - one **track** candidate per distinct track;
  - one **album** candidate for any album with 3 or more distinct tracks
    played; that album's track candidates are folded into it (my call: an
    album listen should not show up as eight rows);
  - each candidate: `{ type, id, name, artist, album_name, image_url, plays,
    last_played_at }`;
  - candidates whose id is already logged are dropped; at most 12 returned.
- A 204 or empty body from Spotify is an empty list.

### Log page

In `web/app/protected/log/page.tsx`, music mode, new log only (not edit, not
a pre-filled link), while nothing is selected and the title box is empty:

```
Title  [ search…                         ]

Recently played on Spotify
  ▢ In Rainbows · Radiohead        album · 7 tracks · today
  ▢ Pink + White · Frank Ocean     track · 3 plays · yesterday
  ▢ …
```

- Tapping a row sets the media type to the row's type, selects the item the
  same way a search result is chosen (`chooseResult`), sets the listened date
  to the day of `last_played_at`, and sets "Listened on" to Spotify.
- Not connected, loading failure, or empty list: render nothing. The list is
  a bonus, not a state the page depends on.
- Built from the existing row and section primitives in DESIGN.md; no new
  visual language.

### Recommendations

- `SpotifyTops.tracks` entries gain `id`.
- `web/app/api/ai/recommend/route.ts` fetches recent plays next to tops,
  fail-soft (a failure logs and continues, as tops does today).
- `buildMusicRecs` adds to its exclude set: every top-track id (all three
  windows), every recent track id, and the album ids of recent album
  candidates.
- `buildMusicRecommendUserPrompt` gains a `RECENTLY PLAYED (Spotify)` section
  and tells the model these and the top tracks are already in rotation: use
  them as signal, do not recommend them.
- The recs cache shape does not change.

### Housekeeping

- Landing page Spotify line (`web/app/page.tsx`) says what connecting does:
  log from recent plays, sharper music picks.
- Remove `getNewReleases` and the `new-releases` action: the endpoint was
  removed by Spotify and nothing calls it.

## Left to the builder

- Exact component split and state names on the log page.
- Relative-date wording ("today", "yesterday", then a date).
- Test cases beyond the obvious: grouping threshold, folding, logged
  exclusion, cap, empty input; exclude-set and prompt additions.

## Checks

`npm test`, `npm run lint` and `npx tsc --noEmit` in `web/` pass after every
task; the log page is opened in a browser with a connected account before
the work is called done.
