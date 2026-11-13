# Remove the ML service, fix the AI recommendations, trim Analytics, clean up

Date: 2026-11-14. Status: draft for the owner's approval. Supersedes the earlier draft of the same name, which was written against the wrong branch.

Base: branch `llm-migration`, created from `origin/main` at `df40e52`. **(decided)** The owner's local `main` and `music-integration` branches are stale relative to it and are not touched.

Lines marked **(decided)** are the owner's explicit choices. Lines marked **(my call)** are defaults chosen while writing; the owner has not confirmed them.

## Why

The Python ML service in `ml/` costs money to host. The app already has an LLM layer (`web/lib/ai/`), but film recommendations still depend on the ML service: it supplies 35 candidates and the model is told to keep 12 to 15 of them, so the picks inherit the ML model's bias toward old, heavily reviewed films, and when the service is down For You is empty. The owner wants the service gone, recommendations that fit them, Analytics cut to the parts they like, and the bloat removed from `web/`.

Three parts, built in this order. Each leaves the app working.

1. Remove the ML service; make film and music For You stand on the LLM alone.
2. Analytics trim, with a short taste card.
3. Cleanup.

## What exists today (on `origin/main`)

- `web/lib/ai/provider.ts`: `callAI` over Anthropic, OpenAI and Gemini, selected by key prefix. Three tiers: `powerful`, `fast`, `fastest`. Every provider is called with a forced tool choice.
- Keys: a server env key (`OPENAI_API_KEY`, then `ANTHROPIC_API_KEY`, then `GEMINI_API_KEY`) wins if set; otherwise the user's own key from `user_ai_settings`. Users enter a key at sign-up or on their profile.
- Routes under `web/app/api/ai/`: `recommend` (`?mode=film|music`, `&refresh=true`), `search` (vibe search), `taste-dna`, `settings`.
- Tables used, with no migration files in the repo: `user_ai_settings`, `taste_dna`, `ai_recommendation_cache` (one row per user and mode; 24-hour expiry; stores `log_count_at_generation`).
- `web/components/taste-dna-card.tsx` on the Profile page shows the full Taste DNA: a fingerprint, four multi-sentence fields each for film and music, a cross-domain section, blind spots and guilty pleasures.
- ML is still called from: `web/app/api/ai/recommend/route.ts` (film candidates), `web/app/api/route.ts` (actions `recommend` and `refresh_profile`), `web/app/protected/discover/page.tsx` (ML recs fetch and refresh), `web/components/dashboard-client.tsx` (ML recs fetch).

## Goals

- No self-hosted service. `ml/` and every reference to it are deleted. **(decided)**
- Film recommendations that fit the owner: a mix of eras weighted to what they watch, and some picks that are not obvious. **(decided)**
- Music recommendations tailored to the owner, using their Spotify listening, not what is generally popular. **(decided)**
- Analytics keeps only: the overall statistics at the top, "You vs The Crowd", and Content Profile (genre breakdown, decade distribution, movie length, release year vs watch date). **(decided)**
- Taste folds into Analytics as a short, interesting card. **(decided)**
- Low cost per call. **(decided)**
- Users bring their own API key; the owner does not pay for friends. **(decided)**
- Anthropic keys use Sonnet and Haiku; OpenAI keys use the cheapest current model. **(decided)**

## Non-goals

- Importing full Spotify streaming history from the data-export file.
- New AI features beyond what exists (tonight picker, would-I-like-this, friend match, recaps).
- Encrypting stored API keys. They are stored as plain text in `user_ai_settings` today and pass through sign-up metadata; this is flagged to the owner as a separate risk, not fixed here.
- Rewriting git history to shrink the repo.

## Anti-goals

- An LLM call that the user did not cause: none on a plain page view when a valid cached result exists, and none while typing in a search box.
- A title, artist or album shown that was not matched against TMDB or Spotify.
- For You dominated by old, heavily reviewed films. Popularity and vote count are never ranking signals.
- A taste card that is a wall of text or reads like a neutral summary.

## Part 1: ML removal and For You

### Deleted

- `ml/`, `.vscode/` settings that point at it, the `.venv/` line in `.gitignore`.
- `ML_API_URL` from `web/.env.local.example` and the README's ML sections.
- `web/app/api/route.ts`: actions `recommend` and `refresh_profile` (the `POST` handler goes entirely if nothing else uses it).
- `web/app/protected/discover/page.tsx`: the ML recs state, fetch and fallback rendering, and the ML refresh call.
- `web/components/dashboard-client.tsx`: the ML recs fetch.
- `FILM_VERIFY_SYSTEM`, `buildFilmVerifyUserPrompt`, `filmVerifyTool`, and the `source: "ml" | "ai"` field.

### Provider layer changes

- **Models.** Anthropic: `powerful` = `claude-sonnet-5-5`, `fast` and `fastest` = `claude-haiku-5-5`. OpenAI: all three tiers = the cheapest current model; third-party pages name GPT-6 Luna at $0.10 / $0.50 per million tokens, and the builder confirms the id and price on OpenAI's own pricing page. Gemini stays supported; the builder checks its two model ids still resolve and updates them to the current cheapest Flash-class model if not. **(Gemini handling is my call.)**
- **Anthropic call shape.** The current forced tool choice is rejected by Sonnet 5.5. The Anthropic path moves to structured outputs (`output_config.format` with the tool's JSON schema), on a current `@anthropic-ai/sdk`. Schemas gain `additionalProperties: false` where structured outputs require it. The OpenAI and Gemini paths keep their current shape unless the chosen model rejects it.
- **Thinking and token limits.** Sonnet 5.5 and Haiku 5.5 think by default and thinking counts against `max_tokens`. Today's limits of 2,000 to 4,000 would truncate. Anthropic calls use `max_tokens` 16000 and set `output_config.effort`: `medium` for `powerful`, `low` for `fast` and `fastest`. **(my call)**
- **Failures are explicit.** `callAI` checks the stop reason. A refusal, a truncated response or output that fails the schema returns `PROVIDER_ERROR`; nothing is parsed from a partial response.
- **Key precedence.** The user's own key is used first; a server env key is used only when the user has none. **(my call)** The README states that setting a server key means the owner pays for every user without their own key.
- **Tiers per feature.** Film recs, music recs and Taste DNA use `powerful`. Vibe search uses `fast`. **(my call; the owner said "Sonnet/Haiku" without assigning them.)**

### Route contract for recommendations

`GET /api/ai/recommend?mode=film|music[&refresh=true]` returns:

- `{ status: "ok", items: [...] }`
- `{ status: "not_enough_logs", items: [] }` when the user has fewer than 5 rated logs for that mode (and, for music, no Spotify connection)
- `{ status: "empty", items: [] }` when the model answered but nothing survived matching
- `{ error, code: "NO_API_KEY" }` with HTTP 402, and `{ error, code: "PROVIDER_ERROR" }` with HTTP 500, as today

Discover and Dashboard show a distinct message for each. An outage or a missing key never renders as "log more to get recommendations".

### Cache

No schema change. `ai_recommendation_cache` is reused with modes `film` and `music` (the old `film_explanations` rows are simply never read again).

A cached result is served when its `log_count_at_generation` equals the user's current log count for that mode and it is not past `expires_at`, which is set 7 days out. Logging something new, the 7 days passing, or pressing Refresh causes a rebuild on the next visit. **(my call)** A known gap: editing a rating without adding a log does not invalidate the cache; Refresh covers it.

### Film For You

Movies and TV series in one list, as today.

How a batch is built:

1. **Taste input.** Watch logs with title, type, rating, the six aspect scores and review text cut to 300 characters. For large libraries: every reviewed log, the 15 highest and 15 lowest rated, and the 50 most recent. Plus the Taste DNA film fields and blind spots when a Taste DNA exists.
2. **Era mix**, computed in code from the release years of what the user has logged (TMDB details): their two most-watched decades.
3. **Candidates from TMDB**, in code: recommendations for the user's 6 highest-rated titles, and discover-by-genre for their top 3 genres, one slice of which is restricted to low vote counts with a high average so lesser-known titles are present. Up to 60, deduplicated, with anything logged or watchlisted removed. Sent to the model as id, type, title, year, genres and a short overview. No popularity or vote fields.
4. **One `powerful` call.** The model returns 30 picks. Each is either a candidate id or a title-and-year of its own choosing, with a one-sentence reason that names something the user logged, and a confidence of `high`, `medium` or `discovery`.
5. **Matching in code.** A candidate id must be in the candidate list. A proposed title is searched on TMDB by title and year; the match's year must be within one year of the proposal, or it is dropped. Anything logged or watchlisted is dropped. Duplicates are dropped. The first 20 survivors are shown.

Rules:

- About a quarter of picks are `discovery`: lower-profile, non-English, or a genre next to the user's usual ones. They carry a visible "Stretch" tag. **(my call on the share)**
- At most a quarter of the 20 picks may be older than the user's two most-watched decades; extra older picks are dropped in code. **(decided in intent; the number is my call)**

Today's bugs this removes: an AI suggestion is accepted as whatever TMDB returns first, with no year check; logged and watchlisted titles are not filtered out; a failed model call falls back to raw ML output.

### Music For You

Albums and tracks, as today.

- **New input: Spotify listening.** Top artists and top tracks for the three time ranges (about 4 weeks, 6 months, long term), fetched with the user's existing Spotify connection (the `user-top-read` scope is already granted). Sent alongside the rated listen logs, which now include review text cut to 300 characters. Without a Spotify connection, the prompt uses listen logs alone.
- **Mix.** About a quarter `discovery`, shown with the "Stretch" tag. The model is told not to recommend an artist's best-known album when the user already listens to that artist heavily.
- **Matching.** A Spotify search result is accepted only when both title and artist match after normalising; today's fallback to "whatever came first" is removed. Anything already logged or queued is dropped after matching, by Spotify id.
- **"Right now" strip**, computed in code with no LLM: artists in the 4-week list who are not in the long-term list (rising), and long-term artists missing from both shorter lists (dropped off). Up to 6 each. Artists link out to Spotify. Hidden without a Spotify connection. **(my call)**

Music Discover page: the rows that show what is generally popular (new releases, the genre rows, the mood pills) are removed. **(decided: tailored, not popular)** What remains: search, the "Right now" strip, For You, and the user's own top-tracks row if the page has one. The builder confirms which of these rows exist on this branch before removing them.

### Vibe search

Kept. **(my call)** It runs only when the user presses Enter on a query, never as they type. The builder checks how it is triggered today and removes any per-keystroke or debounced trigger.

### Dashboard

The recommendations section shows the first 6 film picks from `GET /api/ai/recommend?mode=film`, which serves the same cache as Discover. With no key configured or no picks, the section is hidden.

### Cost

Estimates with thinking included. Anthropic list prices as of 3 November 2026: Sonnet 5.5 $2 / $10 and Haiku 5.5 $0.10 / $0.50 per million tokens.

| Call | Tokens in / out | Sonnet 5.5 | Haiku 5.5 |
|---|---|---|---|
| For You rebuild (film or music) | 4k / 3k | $0.04 | $0.002 |
| Taste DNA generate | 12k / 2k | $0.04 | $0.002 |
| Vibe search | 1k / 1k | n/a | $0.0006 |

Each user pays for their own calls with their own key.

## Part 2: Analytics

### Film tab keeps

- The stat tiles at the top.
- **Content Profile:** genre breakdown, decade distribution, movie length, release year vs watch date.
- **You vs The Crowd.**

### Film tab loses

Highest/lowest rated, Ratings & Activity, the radar "Taste Profile", People, Habits & Discovery, and every computation only they used.

### Music tab

The owner has not said. **(my call)**: keep the stat tiles and Top Artists; remove Listening Activity, Listening Contexts, the radar and Highest Rated.

### Taste card

- Moves from Profile to the top of Analytics, above the tabs. **(decided: fold into Analytics; position is my call)**
- Shows only: the fingerprint as a headline, a three-word pulse, and two or three one-sentence observations, each naming a film or album the user logged. **(decided: shorter, more interesting)**
- Tone: specific, opinionated and a little cheeky, e.g. "You forgive a weak plot if it looks gorgeous." **(my call)**
- Generation stays manual, as today: a Generate / Regenerate button. The card shows how many logs have been added since it was generated. No automatic calls.
- The generated object changes shape:
  - **Displayed, new:** `pulse` (three single words) and `observations` (two or three items: one sentence of at most 20 words, plus the title it cites).
  - **Kept for the recommendation prompts, not displayed:** `film_identity` and `music_identity`, each reduced to `core` and `aspect_lens` at one sentence apiece, and `blind_spots`.
  - **Dropped:** `patterns`, `rating_style`, `cross_domain`, `guilty_pleasures`.
- An observation whose cited title is not in the user's logs is dropped before saving.
- **Database:** `taste_dna` gains two columns, `pulse text[]` and `observations jsonb`. This is one SQL file the owner runs by hand; the repo has no migration setup. Unused old columns are left in place. An existing row without the new columns shows a "Regenerate to update" state.

### Page load

The stat tiles render as soon as the Supabase logs arrive. TMDB details load afterwards; Content Profile and You vs The Crowd show their own loading state until then.

## Part 3: Cleanup

Scope comes from a read-only audit of this branch: roughly 2,000 to 2,700 lines removable or collapsed out of about 17,000 in `web/`, including what Parts 1 and 2 remove. ESLint could not be run during the audit because dependencies were not installed in the worktree, so its counts are estimates; the builder runs it first.

Every change here keeps behaviour the same unless listed under "Fixes".

**Shared pieces, extracted once**

- Types: `WatchLog` (5 definitions), search-result shapes (4), `WatchlistItem` (2), into one types file.
- `upscalePoster` (5 copies plus 3 inline variants), removed at the root: `web/app/api/route.ts` returns one poster size for list actions, so clients stop rewriting URLs.
- Poster card (`RecMediaCard`, `MediaCard`, `MusicCard` and five page-local tiles), scrolling row (`MediaRow` and `MusicRow` share their scroll logic), skeletons.
- Debounced search hook (4 copies of the 350 ms effect) and click-outside hook (5 copies).
- Stat tile (6 copies). Star display: the existing `components/ui/star-display.tsx` replaces the hand-rolled read-only copies.

**`web/lib/tmdb/tmdb.ts` and `web/app/api/route.ts`**

- One TMDB fetch helper in place of 14 repeated wrappers, sending the Bearer token only (the key is currently also put in every URL).
- The two raw TMDB calls in `app/api/ai/search/route.ts` and `app/api/ai/recommend/route.ts` go through the helper.
- `route.ts` becomes a handler table with one error path. Unknown actions return 400. `type` is validated as `movie` or `tv` on every action that takes it, and `genres` is validated as comma-separated digits.
- One `detectProvider`, used by both `lib/ai/provider.ts` and `app/api/ai/settings/route.ts` (the two copies disagree on unknown keys today).

**Dead code removed**

- Files with no importers: `components/logout-button.tsx`, `components/theme-toggle.tsx`, `components/nav-mode-toggle.tsx`, `components/ui/checkbox.tsx`, `lib/ai/anthropic.ts`, `public/images/logo1.png`. Dependency `@radix-ui/react-checkbox`.
- Unused exports and branches: the no-action fallback in `route.ts` with `searchMovieByName` and `searchSeriesByName`; Spotify `artist-top` action with `getArtistTopTracks`; `TasteDNARow`; the `resolveProvider` / `MODEL_MAP` exports. The Spotify `recently-played` action is removed unless Part 1 ends up using it.
- Unused CSS (`.font-mono-ui`, `.card-surface`, `.card-surface-2`, `.wave-bar` rules, `pulseDot`, the `.dark` block that duplicates `:root`, four unused variables) and the broken `chart` colour group in `tailwind.config.ts`.
- Unused imports and locals reported by ESLint.
- Comments that restate the code or act as section banners.

**Fixes** (behaviour changes, each small)

- `watchlist/page.tsx:242`: the search effect reads `mode` without depending on it; fixed by the shared search hook.
- `friends/page.tsx:215`: raw user input is interpolated into a PostgREST `.or()` filter; the input is sanitised.
- `analytics/page.tsx`: `SectionHeader`, `Card` and `CardTitle` are defined inside the render function, so every chart remounts on any state change; they move to module scope. A failed music fetch shows an error, not "No data yet".
- `lib/supabase/proxy.ts:53`: an unauthenticated request to an `/api` route is redirected to an HTML login page, which the client then fails to parse; `/api` routes get a 401 JSON response.
- `lib/mode-context.tsx`: the mode starts as "film" and is corrected in an effect, so music users briefly load film data and see a colour flash. The stored mode is read before first paint.
- Swallowed errors: each of the roughly 55 empty or comment-only `catch` blocks either sets an error state the page shows or carries a comment saying why ignoring is right.
- Lint: zero messages, or a single-line disable with a reason. `no-img-element` may be turned off project-wide, since artwork comes from remote hosts not configured for `next/image`.

**Docs:** README rewritten to match the app (no ML sections, the AI and Spotify env vars, how bring-your-own-key works). The landing page copy at `app/page.tsx:348-356` that describes "ML-generated film picks" is reworded.

**Not in cleanup scope:** restructuring the log form's state, splitting the lists UI out of the watchlist page, the Analytics page fetching TMDB details for every logged title on each visit (the kept sections need those details; caching them is a follow-up), `next/image` adoption, visual redesign.

## Left to the builder

- Prompt wording, schema field names, internal file layout.
- How TMDB candidates are fetched and merged.
- Component boundaries in the cleanup.
- Tests: there is no test setup in `web/`. Add Vitest. At minimum, the matching and filtering functions, the era-mix rule and the cache-validity rule get unit tests, since they are pure and are where wrong output would come from.
