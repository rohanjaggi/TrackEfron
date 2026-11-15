# ML Removal, AI Recommendations, Analytics Trim and Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete the self-hosted ML service, make film and music recommendations stand on the existing LLM layer with better inputs and strict matching, trim Analytics to the kept sections with a short taste card, and remove bloat from `web/`.

**Architecture:** The existing `web/lib/ai/provider.ts` (`callAI` over Anthropic, OpenAI, Gemini with per-user keys) stays and is updated. New pure modules under `web/lib/recs/` gather inputs and match model output against TMDB and Spotify; the existing `/api/ai/recommend` route orchestrates them and reuses the existing `ai_recommendation_cache` table. Taste DNA is reshaped and its card moves to Analytics.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (`@supabase/ssr`), `@anthropic-ai/sdk`, `openai`, `@google/genai`, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-14-llm-migration-design.md`. Read it first.

## Global Constraints

- Work only in the worktree at `.claude/worktrees/llm-migration` on branch `llm-migration` (from `origin/main` `df40e52`). Never commit to or modify `main`, `music-integration` or the main checkout.
- All commands run from `web/` unless stated. `node_modules` is not installed in the worktree: Task 1 runs `npm ci`.
- No LLM call the user did not cause: none on a page view when a valid cached result exists; none while typing.
- Nothing is shown that was not matched against TMDB or Spotify.
- Popularity and vote count are never sent to the model and never used to rank.
- Anthropic model ids, exactly: `claude-sonnet-5-5` (`powerful`), `claude-haiku-5-5` (`fast`, `fastest`). No date suffixes.
- OpenAI: all three tiers use the cheapest current model. Confirm its id and price on OpenAI's own pricing page; third-party pages name GPT-6 Luna at $0.10 / $0.50 per million tokens.
- Before writing Claude API code, read `typescript/claude-api/README.md` and `tool-use.md` in the `claude-api` skill. Use the official `@anthropic-ai/sdk`. Do not send `temperature`, a `thinking` config, or a forced `tool_choice` to Anthropic.
- Routes read the user from the Supabase server session, never from the request.
- Stretch share: about a quarter of each batch. Era rule: at most 5 of 20 film picks older than the user's two most-watched decades.
- The repo has no migration setup. A database change is a SQL file the owner runs by hand; stop and ask at that checkpoint.
- Each phase ends with `npm run lint`, `npm run build` and `npm test` passing.

## Review Focus

1. **A user with fewer than 5 rated logs opens For You.** Expected: `not_enough_logs`, a "log a few things first" message, no LLM call. (Tasks 4, 6.)
2. **The model returns titles that do not exist, wrong years, duplicates, or things already logged.** Expected: dropped; survivors shown. (Tasks 3, 5.)
3. **Matching leaves zero picks, or the provider refuses or truncates.** Expected: `empty` or a 500 with `PROVIDER_ERROR`, each with its own message; never the "log more" message. (Tasks 2, 4, 7, 8.)
4. **Spotify not connected, or its token is rejected during a rebuild.** Expected: music recs build from listen logs alone; "Right now" hidden. (Tasks 5, 6.)
5. **An existing `taste_dna` row from before the reshape.** Expected: the card shows the fingerprint with "Regenerate to update"; the recommendation prompts tolerate missing or old-shape fields. (Tasks 10, 11.)

## File Structure

New files under `web/`:

| File | Responsibility |
|---|---|
| `vitest.config.ts` | Test config with the `@/` alias |
| `lib/ai/detect-provider.ts` | The single key-prefix-to-provider function |
| `lib/recs/cache.ts` | Cache-validity rule |
| `lib/recs/film/select-logs.ts` | Choose and format watch logs for the prompt |
| `lib/recs/film/era.ts` | Top decades and the older-pick limit |
| `lib/recs/film/candidates.ts` | Gather TMDB candidates |
| `lib/recs/film/match.ts` | Match and filter model film picks |
| `lib/recs/film/build.ts` | Orchestrate a film batch |
| `lib/recs/music/tops.ts` | Fetch Spotify tops for three ranges |
| `lib/recs/music/right-now.ts` | Rising / dropped-off artists |
| `lib/recs/music/match.ts` | Match and filter model music picks |
| `lib/recs/music/build.ts` | Orchestrate a music batch |
| `lib/taste/validate.ts` | Drop observations citing unknown titles |
| `components/discover/right-now-strip.tsx` | The strip |
| `supabase/taste_dna_pulse.sql` (repo root) | Adds two columns |

---

## Phase 0

### Task 1: Install, test runner, baseline

**Files:**
- Create: `vitest.config.ts`, `lib/utils.test.ts`
- Modify: `package.json` (dev dependency `vitest`; script `"test": "vitest run"`)

- [ ] **Step 1:** Run `npm ci`.
- [ ] **Step 2:** Add Vitest with `environment: "node"` and the `@` alias to the `web/` root. Add `lib/utils.test.ts` asserting `cn("a", "b") === "a b"`.
- [ ] **Step 3:** Run `npm test`. Expected: 1 passed.
- [ ] **Step 4:** Run `npm run build` and `npx eslint . --no-cache`. Record the ESLint message count per rule in the commit message body. Expected: build succeeds (if it does not, stop and report; do not fix unrelated build errors in this task).
- [ ] **Step 5:** Commit `chore: add vitest and record lint baseline`. Commit the two docs under `docs/superpowers/` separately as `docs: llm migration spec and plan`.

---

## Phase 1: ML removal and For You

### Task 2: Provider layer

**Files:**
- Create: `lib/ai/detect-provider.ts`, `lib/ai/provider.test.ts`
- Modify: `lib/ai/provider.ts`, `lib/ai/tools.ts`, `app/api/ai/settings/route.ts`, `package.json` (`@anthropic-ai/sdk` to the current release)
- Delete: `lib/ai/anthropic.ts`

**Interfaces:**
- Produces:
  - `export function detectProvider(key: string): Provider | null` — `sk-ant-` → `anthropic`; `AIza` → `gemini`; `sk-` → `openai`; otherwise `null`. Used by both `provider.ts` and the settings route; a stored key that maps to `null` makes `callAI` return `NO_API_KEY`.
  - `resolveProvider(supabase, userId)` order: the user's stored key first; then env `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`.
  - `MODEL_MAP.anthropic = { powerful: "claude-sonnet-5-5", fast: "claude-haiku-5-5", fastest: "claude-haiku-5-5" }`; `MODEL_MAP.openai` all three = the confirmed cheapest id.
  - `callAI` signature and result type unchanged: `CallAIOptions` in, `{ data, model } | { error, code: "NO_API_KEY" | "PROVIDER_ERROR" }` out.

Decisions:
- Anthropic path: structured outputs via `output_config.format` built from `options.tool.input_schema`, plus `output_config.effort` (`medium` for `powerful`, `low` otherwise). `max_tokens` is `Math.max(options.maxTokens, 16000)`. `stop_reason` of `refusal` or `max_tokens`, or output that does not parse as JSON, returns `PROVIDER_ERROR` with a message naming which.
- Add `additionalProperties: false` to every object schema in `tools.ts`, and make every property `required` where structured outputs demand it; optional fields become nullable.
- OpenAI and Gemini paths keep their shape. If the confirmed OpenAI model rejects the forced function call, switch that path to the SDK's JSON-schema response format. Check the two Gemini ids resolve; if not, set all Gemini tiers to the current cheapest Flash-class id.

- [ ] **Step 1: Write failing tests** (mock `@anthropic-ai/sdk`, `openai`, `@google/genai` with `vi.mock`; fake Supabase client):

```ts
test("detectProvider maps sk-ant-, AIza, sk- and returns null otherwise");
test("resolveProvider prefers the user's key over env keys");
test("resolveProvider falls back to env when the user has no key");
test("callAI returns NO_API_KEY when neither exists");
test("anthropic tiers map to sonnet 5.5 and haiku 5.5", () =>
  expect(MODEL_MAP.anthropic).toEqual({ powerful: "claude-sonnet-5-5", fast: "claude-haiku-5-5", fastest: "claude-haiku-5-5" }));
test("anthropic request has no tool_choice, max_tokens >= 16000, effort medium for powerful");
test("anthropic stop_reason refusal returns PROVIDER_ERROR");
test("anthropic stop_reason max_tokens returns PROVIDER_ERROR");
test("anthropic valid JSON output returns data");
```

- [ ] **Step 2:** Run `npx vitest run lib/ai/provider.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the tests. Expected: PASS. Run `npm run build`.
- [ ] **Step 5:** Commit `feat(ai): current models, structured outputs, user key first`.

### Task 3: Film pure modules

**Files:**
- Create: `lib/recs/cache.ts`, `lib/recs/film/select-logs.ts`, `lib/recs/film/era.ts`, `lib/recs/film/candidates.ts`, `lib/recs/film/match.ts`, with a `.test.ts` beside `cache.ts`, `select-logs.ts`, `era.ts`, `match.ts`
- Modify: `lib/tmdb/tmdb.ts` (add `getRecommendations(type, id)`, `searchByTitleYear(type, title, year)`, `discoverFiltered(type, { genreIds, maxVoteCount?, minVoteAverage? })`; leave existing functions alone), `lib/ai/types.ts`

**Interfaces:**
- Produces, in `lib/ai/types.ts` (replacing the current `FilmRecommendation`):

```ts
export type Confidence = "high" | "medium" | "discovery";
export interface FilmRecommendation { tmdb_id: number; title: string; media_type: "movie" | "tv"; year: number | null; poster_url: string | null; explanation: string; confidence: Confidence; }
export interface FilmCandidate { tmdb_id: number; media_type: "movie" | "tv"; title: string; year: number | null; genres: string[]; overview: string; poster_url: string | null; }
export interface RawFilmPick { tmdb_id: number | null; title: string; year: number | null; media_type: "movie" | "tv"; explanation: string; confidence: Confidence; }
export type RecsResponse<T> = { status: "ok" | "not_enough_logs" | "empty"; items: T[] };
```

- `cache.ts`: `export function isCacheValid(row: { expires_at: string; log_count_at_generation: number } | null, logCount: number, now: Date): boolean` and `export const CACHE_DAYS = 7`.
- `select-logs.ts`: `export type WatchLogRow` (columns: `tmdb_id, title, media_type, rating, review, plot_rating, cinematography_rating, acting_rating, soundtrack_rating, pacing_rating, casting_rating, watched_date`); `export function selectWatchLogs(logs: WatchLogRow[]): WatchLogRow[]` (all when 80 or fewer; otherwise every reviewed log, the 15 highest and 15 lowest rated, and the 50 most recent, deduplicated); `export function formatWatchLogs(logs: WatchLogRow[]): string` (review cut to 300 characters).
- `era.ts`: `export function eraLimits(years: number[]): { topDecades: number[]; olderBefore: number | null; maxOlder: number }` — `topDecades` is up to two decades by count, ties to the later decade; `olderBefore` is the earlier of them or `null` with no years; `maxOlder` is 5.
- `candidates.ts`: `export async function gatherFilmCandidates(logs: WatchLogRow[], exclude: Set<string>): Promise<FilmCandidate[]>` — TMDB recommendations for the 6 highest-rated logs; discover for the top 3 genres of those logs, one call with `maxVoteCount: 500, minVoteAverage: 7`; deduplicated by `media_type:tmdb_id`; excluded keys removed; at most 60.
- `match.ts`: `export async function matchFilmPicks(raw: RawFilmPick[], candidates: FilmCandidate[], exclude: Set<string>, lookup: (type, title, year) => Promise<FilmCandidate | null>, limits: { max: number; maxOlder: number; olderBefore: number | null }): Promise<FilmRecommendation[]>`.

- [ ] **Step 1: Write failing tests:**

```ts
// cache
test("null row is invalid");
test("valid when counts match and not expired");
test("invalid when log count differs");
test("invalid when expired");
// select-logs
test("returns all at 80 logs");
test("at 200 logs includes every reviewed log and the 50 most recent, without duplicates");
test("formatWatchLogs cuts a 500-char review to 300");
// era
test("picks the two most common decades", () =>
  expect(eraLimits([2021, 2023, 2015, 2012, 2004]).topDecades).toEqual([2020, 2010]));
test("olderBefore is the earlier top decade", () =>
  expect(eraLimits([2021, 2023, 2015, 2012, 2004]).olderBefore).toBe(2010));
test("no years gives olderBefore null and maxOlder 5");
// match
test("keeps a pick whose id is in the candidate list");
test("drops an id that is not in the candidate list and has no lookup match");
test("resolves a null-id pick through lookup");
test("drops a lookup match whose year is more than 1 from the proposed year");
test("drops excluded keys, including lookup results");
test("drops duplicates, keeping the first");
test("keeps at most limits.max");
test("keeps at most limits.maxOlder picks with year < olderBefore");
test("a pick with a null year is not counted as older");
test("empty input returns []");
```

- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(recs): film log selection, era limits, candidates and matching`.

### Task 4: Film batch builder

**Files:**
- Create: `lib/recs/film/build.ts`, `lib/recs/film/build.test.ts`
- Modify: `lib/ai/prompts.ts` (replace `FILM_VERIFY_SYSTEM` and `buildFilmVerifyUserPrompt` with `FILM_RECOMMEND_SYSTEM` and `buildFilmRecommendUserPrompt`), `lib/ai/tools.ts` (replace `filmVerifyTool` with `filmRecommendTool`, tool name `recommend_films`, output `{ picks: RawFilmPick[] }`)

**Interfaces:**
- Consumes: Task 2 `callAI`; Task 3.
- Produces: `export async function buildFilmRecs(deps: { logs: WatchLogRow[]; watchlist: { tmdb_id: number; media_type: string }[]; tasteDNA: { fingerprint?: string; film_profile?: { core?: string; aspect_lens?: string } | null; blind_spots?: string[] | null } | null; yearsOf: (logs: WatchLogRow[]) => Promise<number[]>; gather: typeof gatherFilmCandidates; lookup: ...; ai: (system: string, user: string) => Promise<{ picks: RawFilmPick[] }> }): Promise<RecsResponse<FilmRecommendation>>` — throws on an AI failure; the route maps it.

Decisions:
- Fewer than 5 logs with a rating: `not_enough_logs`, no AI call.
- Tier `powerful`. Ask for 30 picks; keep 20.
- `FILM_RECOMMEND_SYSTEM` says, in plain sentences: recommend for this person from their ratings and reviews; follow the era guidance in the user message; make about a quarter `discovery` (lower-profile, non-English, or an adjacent genre) and use their blind spots for those; each explanation is one sentence of at most 25 words naming something they logged; prefer candidate ids; for a title outside the list set `tmdb_id` to null and give title and year; never recommend something in the "already seen" list; do not pick by fame.
- The user message has: taste profile lines when present; "ERA: most of what they watch is from the {d1}s and {d2}s. At most 5 of your picks may be older than {olderBefore}."; the formatted logs; candidates as `id | type | title | year | genres | first 30 words of overview`. No popularity or vote fields.
- Zero matched picks: `empty`.

- [ ] **Step 1: Write failing tests:**

```ts
test("under 5 rated logs returns not_enough_logs and never calls ai");
test("user message contains the ERA line with both decades");
test("user message contains no 'popularity' or 'vote'");
test("tolerates tasteDNA null and an old-shape film_profile with extra fields");
test("returns ok with matched picks");
test("returns empty when matching drops everything");
test("ai rejection propagates");
```

- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(recs): llm-only film batch builder`.

### Task 5: Music pure modules

**Files:**
- Create: `lib/recs/music/tops.ts`, `lib/recs/music/right-now.ts`, `lib/recs/music/match.ts`, with `.test.ts` beside `right-now.ts` and `match.ts`
- Modify: `lib/ai/types.ts`

**Interfaces:**
- Produces, in `types.ts`:

```ts
export type SpotifyRange = "short_term" | "medium_term" | "long_term";
export interface SpotifyTops { artists: Record<SpotifyRange, { id: string; name: string; genres: string[]; image_url: string | null }[]>; tracks: Record<SpotifyRange, { name: string; artist: string }[]>; }
export interface RightNow { rising: { id: string; name: string; image_url: string | null }[]; dropped_off: { id: string; name: string; image_url: string | null }[]; }
export type MusicRecsResponse = RecsResponse<MusicRecommendation> & { right_now: RightNow | null };
```

- `tops.ts`: `export async function fetchSpotifyTops(accessToken: string): Promise<SpotifyTops | null>` — six `/v1/me/top/{artists|tracks}?limit=20&time_range=…` calls; `null` on any 401 or 403.
- `right-now.ts`: `export function computeRightNow(tops: SpotifyTops): RightNow` — `rising`: short-term artists not in long-term, short-term order, at most 6. `dropped_off`: long-term artists in neither shorter list, at most 6.
- `match.ts`: `export function normalise(s: string): string`; `export async function matchMusicPicks(raw: MusicRecommendation[], exclude: Set<string>, search: typeof searchSpotify, max: number): Promise<MusicRecommendation[]>` — accepts a search result only when normalised title and artist each contain or are contained by the proposal's; no fallback to the first result; drops Spotify ids in `exclude` and duplicates.

- [ ] **Step 1: Write failing tests:**

```ts
test("rising excludes artists present in long_term");
test("dropped_off excludes artists in short_term or medium_term");
test("each list is capped at 6");
test("accepts a result matching title and artist ignoring case and punctuation");
test("drops a pick when no result matches, even if results exist");
test("drops a pick when search throws");
test("drops excluded ids and duplicates");
test("caps at max");
```

- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(recs): spotify tops, right-now and strict music matching`.

### Task 6: Music batch builder

**Files:**
- Create: `lib/recs/music/build.ts`, `lib/recs/music/build.test.ts`
- Modify: `lib/ai/prompts.ts` (`MUSIC_RECOMMEND_SYSTEM`, `buildMusicRecommendUserPrompt`)

**Interfaces:**
- Produces: `export async function buildMusicRecs(deps: { logs: ListenLogRow[]; queue: { spotify_id: string | null; title: string; artist: string | null }[]; tops: SpotifyTops | null; tasteDNA: ... | null; search: typeof searchSpotify; ai: (system, user) => Promise<{ recommendations: MusicRecommendation[] }> }): Promise<MusicRecsResponse>`; `ListenLogRow` adds `spotify_id` and `review` to the columns the route selects today.

Decisions:
- `not_enough_logs` when `tops` is null and fewer than 5 logs have a rating. With `tops` present, build even with zero logs.
- Tier `powerful`. Ask for 30; keep 20. `right_now` is `computeRightNow(tops)` or `null`.
- System prompt changes: mix becomes "about 75% high or medium, about 25% discovery"; add "Do not recommend an artist's best-known album when they already appear in the person's long-term top artists"; explanations become one sentence of at most 25 words.
- User message adds, when `tops` is present, three labelled blocks: "LAST 4 WEEKS", "LAST 6 MONTHS", "LONG TERM", each listing top artists (with genres) and top tracks. Listen logs include reviews cut to 300 characters.

- [ ] **Step 1: Write failing tests:**

```ts
test("null tops and 3 rated logs returns not_enough_logs without calling ai");
test("null tops and 6 rated logs builds with right_now null");
test("tops present and zero logs builds");
test("user message contains all three window labels when tops present");
test("returns empty when matching drops everything");
```

- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(recs): music batch builder with spotify listening`.

### Task 7: Recommend route and ML removal from the API

**Files:**
- Modify: `app/api/ai/recommend/route.ts` (rewrite both handlers), `app/api/route.ts` (delete action `recommend` and the whole `POST` handler)

**Interfaces:**
- Consumes: Tasks 2 to 6.
- Produces: `GET /api/ai/recommend?mode=film` → `RecsResponse<FilmRecommendation>`; `?mode=music` → `MusicRecsResponse`; `&refresh=true` skips the cache. Errors: 401 `{ error }`; 402 `{ error, code: "NO_API_KEY" }`; 500 `{ error, code: "PROVIDER_ERROR" }`.

Decisions:
- Each handler: read the cache row for mode `film` or `music`; count the user's logs; if `isCacheValid` and not refreshing, return `{ status: "ok", items: cached }` (music also returns the cached `right_now`; store the cache payload as `{ items, right_now }` for music and read old array-shaped rows as invalid).
- Only `ok` results are written to the cache, with `expires_at` = now + 7 days and `log_count_at_generation` = the count.
- The film handler supplies `yearsOf` by fetching TMDB details for the selected logs in batches of 10, and `lookup` via `searchByTitleYear`. The music handler gets the token from `getValidToken(supabase, user.id)` and passes `tops: null` when there is none.
- Every Supabase read has an explicit `.eq("user_id", user.id)`.

- [ ] **Step 1:** Rewrite the route. Keep the handlers thin; no test file for the route itself.
- [ ] **Step 2:** Delete the two ML pieces from `app/api/route.ts`.
- [ ] **Step 3:** Verify: `grep -rn "ML_API_URL\|mlCandidates\|refresh_profile" app lib`. Expected: matches only in `discover/page.tsx` and `dashboard-client.tsx` (removed in Task 8).
- [ ] **Step 4:** `npm test && npm run build`. If the build fails only because Discover or Dashboard read the old response shape, proceed to Task 8 and commit both together.
- [ ] **Step 5:** Commit `feat(ai): llm-only recommend route, remove ml api actions`.

### Task 8: Discover and Dashboard

**Files:**
- Create: `components/discover/right-now-strip.tsx`
- Modify: `app/protected/discover/page.tsx`, `components/dashboard-client.tsx`

Decisions:
- Remove from Discover: the ML state block, the ML fetch effect, `handleRefreshMlRecs`, the refresh-status UI, every `aiFilmRecs.length > 0 ? aiFilmRecs : mlRecs` fallback, and the copy "The ML engine needs enough signal…". Rename `handleAddMlToWatchlist` to `handleAddRecToWatchlist`.
- Both AI fetches read the new response shape. Messages by case: 402 → the existing "add an API key in your profile" state; `not_enough_logs` → "Log and rate at least 5 titles to get recommendations."; `empty` or 500 → "Couldn't build recommendations. Try again." with a retry button.
- A pick with `confidence === "discovery"` shows a small "Stretch" tag on its card. The explanation stays where it is shown today.
- Add a `mode` guard so the film fetch does not fire in music mode.
- Music mode: remove the new-releases row, the `MUSIC_GENRE_QUERIES` rows and the `MOOD_PILLS` block with their state, effects and handlers. Keep search, the AI For You section and the Spotify top-tracks row. Remove the top-artists row; render `<RightNowStrip rightNow={…} />` above For You when `right_now` is not null. Artists in the strip link to `https://open.spotify.com/artist/{id}`.
- Vibe search: remove the vibe branch from the debounced search effect and delete `detectVibeQuery`. Pressing Enter in the search box runs the vibe search for the current query; typing only ever runs the normal title search.
- Dashboard: `fetchRecs` calls `/api/ai/recommend?mode=film` and takes the first 6 `items`. Remove the "ML" badge. Hide the section in music mode and when the response is not `ok` with at least one item.

- [ ] **Step 1:** Make the changes. Delete state, effects, constants and imports that become unused.
- [ ] **Step 2:** `npm run lint && npm run build && npm test`.
- [ ] **Step 3: Manual check** with `npm run dev` and a user who has a key and logs: film For You shows picks with one-line reasons and some Stretch tags; Browse rows still load; music mode shows the strip (if Spotify is connected), For You with artwork, and top tracks; typing a long sentence in search makes no request to `/api/ai/search` until Enter; a reload of For You makes one `/api/ai/recommend` request that returns quickly from cache; the Dashboard shows six picks. If no API key or test account is available to you, say so in the report; do not claim this step passed.
- [ ] **Step 4:** Commit `feat(discover): llm-only For You, right-now strip, vibe search on enter`.

### Task 9: Delete the ML service and its references

**Files:**
- Delete: `ml/` (repo root), `.vscode/settings.json`
- Modify: `.gitignore` (remove `.venv/`), `web/.env.local.example` (remove the ML block), `README.md`, `web/app/page.tsx` (the copy at about lines 348 to 356)

- [ ] **Step 1:** Delete and edit as listed. README: remove the ML sections and `ML_API_URL`; describe For You as LLM-based; add a short "AI features" section covering bring-your-own-key, the three providers, which model each uses, and that a server env key is used for any user without their own key, at the owner's cost.
- [ ] **Step 2:** `grep -rniE "\bml\b|ML_API|machine learning" --include="*.ts" --include="*.tsx" --include="*.md" --include="*.example" . | grep -v node_modules | grep -v docs/superpowers`. Expected: no output, apart from unrelated words such as "html".
- [ ] **Step 3:** `npm run build && npm test`.
- [ ] **Step 4:** Commit `chore: remove ml service`.

**Phase 1 gate:** lint, build and tests pass.

---

## Phase 2: Analytics

### Task 10: Taste DNA reshape

**Files:**
- Create: `lib/taste/validate.ts`, `lib/taste/validate.test.ts`, `supabase/taste_dna_pulse.sql` (repo root)
- Modify: `lib/ai/types.ts`, `lib/ai/tools.ts` (`tasteDNATool`), `lib/ai/prompts.ts` (`TASTE_DNA_SYSTEM`, `buildTasteDNAUserPrompt`), `app/api/ai/taste-dna/route.ts`

**Interfaces:**
- Produces:

```ts
export interface TasteObservation { text: string; cited_title: string; }
export interface TasteDNA { fingerprint: string; pulse: string[]; observations: TasteObservation[]; film_identity: { core: string; aspect_lens: string }; music_identity: { core: string; aspect_lens: string }; blind_spots: string[]; }
export function validateObservations(obs: TasteObservation[], loggedTitles: string[]): TasteObservation[]; // keeps those whose cited_title equals a logged title after normalising
```

- `GET /api/ai/taste-dna` returns `{ fingerprint, pulse, observations, generated_at, film_log_count, music_log_count, logs_since: number, needs_regenerate: boolean }` or `null`. `needs_regenerate` is true when the row has no `pulse`. `logs_since` is current film plus music log count minus the stored counts, floored at 0.

Decisions:
- Tool schema: `fingerprint` at most 80 characters; `pulse` exactly 3 single words; `observations` 2 or 3 items, `text` one sentence of at most 20 words; `film_identity` and `music_identity` each `core` and `aspect_lens`, one sentence each; `blind_spots` 2 to 4. Remove `patterns`, `rating_style`, `cross_domain`, `guilty_pleasures`.
- Add to `TASTE_DNA_SYSTEM`, verbatim: "Be specific, opinionated and a little cheeky. Say something this person would recognise about themselves, not a neutral summary. Example of the register: 'You forgive a weak plot if it looks gorgeous.' Each observation must name one film, series, album or track from their logs in cited_title, spelled exactly as given."
- POST: after the call, run `validateObservations`; if none survive, return 500 `PROVIDER_ERROR` and do not save. Save `pulse` and `observations` to the new columns, `film_profile` / `music_profile` / `blind_spots` to the existing ones, and write `null` to `cross_domain` and `guilty_pleasures`.
- SQL file: `alter table taste_dna add column if not exists pulse text[]; alter table taste_dna add column if not exists observations jsonb;`

- [ ] **Step 1: Write failing tests** for `validateObservations`: keeps an exact match; keeps a match differing only in case and punctuation; drops an unknown title; returns `[]` for `[]`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement the validator, types, tool, prompt and route.
- [ ] **Step 4:** Run tests and `npm run build`. The card component will not compile against the new type yet if it reads removed fields; make the minimal edit to keep the build green, since Task 11 replaces it.
- [ ] **Step 5: Owner checkpoint.** Stop and ask the owner to run `supabase/taste_dna_pulse.sql` in the Supabase SQL editor. Continue to Task 11 while waiting; its manual check needs the columns.
- [ ] **Step 6:** Commit `feat(taste): short taste dna with pulse and observations`.

### Task 11: Taste card on Analytics, and the trim

**Files:**
- Modify: `components/taste-dna-card.tsx`, `components/profile-client.tsx` (remove the card), `app/protected/analytics/page.tsx`

Decisions:
- The card renders above the page's mode sections: the fingerprint as a headline; the pulse words joined by " · "; the observations as short lines. A Generate / Regenerate button; "N logs since this was generated" when `logs_since > 0`; with `needs_regenerate`, the fingerprint plus "Regenerate to update". States for no key (402), not enough data (400) and provider error, each with its own line. Nothing else from the old card remains.
- Film sections kept, in order: overview tiles, Content Profile (Genre Breakdown, Decade Distribution, Movie Length, Release Year vs Watch Date), You vs The Crowd. Removed: Highest/Lowest rated, Ratings & Activity (all four charts), Taste Profile radar, People, Habits & Discovery, and every computation, type, import and constant only they used.
- Music sections kept: overview tiles, Top Artists. Removed: Listening Activity, Listening Contexts, Taste Profile radar, Highest Rated, and their computations.
- Move `SectionHeader`, `Card`, `CardTitle` to module scope.
- Loading: set `loading` false as soon as the Supabase logs arrive; a separate `detailsLoading` covers the TMDB fetch. Tiles that need details (runtime, seasons, episodes) show a dash until they arrive; Content Profile and You vs The Crowd show a skeleton. Make `totalRuntime`, `totalSeasons`, `totalEpisodes` derived values, not state.
- A failed logs fetch shows "Couldn't load your analytics" with a retry, not the empty state.

- [ ] **Step 1:** Rewrite the card.
- [ ] **Step 2:** Trim Analytics and restructure loading.
- [ ] **Step 3:** `npm run lint && npm run build && npm test`.
- [ ] **Step 4: Manual check** (needs Task 10's SQL applied and an API key): tiles appear before the charts; the three kept film sections show real data; Generate produces a headline, three words and two or three lines; a reload shows the same card with no new provider call; Profile no longer shows the card. If you cannot run this, say so in the report.
- [ ] **Step 5:** Commit `feat(analytics): keep stats, content profile and crowd; add short taste card`.

**Phase 2 gate:** lint, build and tests pass.

---

## Phase 3: Cleanup

Behaviour-preserving unless a step says "Fix". Verify each task with `npm run lint && npm run build && npm test` and by opening each touched page in `npm run dev`. Line numbers in the spec predate Phases 1 and 2; grep for each target first.

### Task 12: Shared types and TMDB / route consolidation

**Files:**
- Create: `lib/types.ts`, `lib/tmdb/tmdb.test.ts`
- Modify: `lib/tmdb/tmdb.ts`, `app/api/route.ts`, `app/api/ai/search/route.ts`, `app/api/ai/recommend/route.ts`, every file that defines `WatchLog`, `WatchlistItem` or a search-result type locally, every `upscalePoster` copy

**Interfaces:**
- Produces: `lib/types.ts` exports `WatchLog`, `ListenLog`, `WatchlistItem`, `MediaSearchResult`; `tmdbGet<T>(path: string, params?: Record<string, string | number>): Promise<T>`.

Decisions:
- `tmdbGet` sends the Bearer token only; remove `api_key` from every URL and the `TMDB_API_KEY` env var from the example file and README. Every exported TMDB function becomes a thin call. Delete `searchMovieByName`, `searchSeriesByName`.
- `route.ts`: a handler table keyed by action and one `try/catch`. Unknown or missing action → 400. Validate `type` as `movie` or `tv` (400 otherwise) on every action that takes it; validate `genres` against `/^\d+(,\d+)*$/`. List actions, including `search`, return `w342` posters. Type TMDB results once; no `any` left in the file.
- Delete every `upscalePoster` and inline size-rewrite; where a page needs a larger image than `w342` (check each call site), request it from the `detail` action instead.

- [ ] **Step 1: Write failing tests** for `tmdbGet` with mocked `fetch`: builds the URL with params and no `api_key`; sends the Bearer header; throws with the status on non-2xx.
- [ ] **Step 2:** Refactor; run tests.
- [ ] **Step 3:** Commit in two commits: `refactor: shared types`, `refactor: single tmdb helper and validated route table`.

### Task 13: Shared UI pieces and hooks

**Files:**
- Create: `components/media/poster-card.tsx`, `components/media/scroll-row.tsx`, `components/media/stat-tile.tsx`, `hooks/use-debounced-search.ts`, `hooks/use-debounced-search.test.ts`, `hooks/use-click-outside.ts`
- Modify: Discover, Watchlist, Library, Lists, Log, Dashboard, Analytics, User and Profile pages

Decisions:
- `PosterCard` props: `{ imageUrl, title, subtitle?, aspect: "poster" | "square", href?, tag?, action?, footer? }`. It replaces `RecMediaCard`, `MediaCard`, `MusicCard` and the page-local poster tiles.
- `ScrollRow` replaces `MediaRow` and `MusicRow`; one skeleton component takes `aspect`.
- `useDebouncedSearch<T>(search: (q: string) => Promise<T[]>, deps: unknown[], delayMs = 350)` returns `{ query, setQuery, results, loading, error }` and discards responses for superseded queries. Export the superseding rule as a pure function `latestOnly()` for testing. **Fix:** Watchlist passes `mode` in `deps`.
- Read-only star rows use `components/ui/star-display.tsx`. Interactive pickers are left alone.
- One page per commit.

- [ ] **Step 1: Write a failing test:** two searches resolving out of order keep only the later query's results.
- [ ] **Step 2:** Build the pieces.
- [ ] **Step 3:** Replace copies page by page, verifying and committing each.

### Task 14: Dead code and small fixes

**Files:**
- Delete: `components/logout-button.tsx`, `components/theme-toggle.tsx`, `components/nav-mode-toggle.tsx`, `components/ui/checkbox.tsx`, `public/images/logo1.png`
- Modify: `package.json`, `app/globals.css`, `tailwind.config.ts`, `lib/spotify/spotify.ts`, `app/api/spotify/route.ts`, `app/api/spotify/me/route.ts`, `lib/ai/types.ts`, `lib/ai/provider.ts`, `lib/supabase/proxy.ts`, `lib/mode-context.tsx`, `app/layout.tsx`, `app/protected/friends/page.tsx`
- Create: `lib/postgrest.ts`, `lib/postgrest.test.ts`

Decisions:
- Grep for importers before each deletion; skip and report any that has one.
- Remove: `@radix-ui/react-checkbox`; Spotify `artist-top` and `getArtistTopTracks`; `recently-played` if still uncalled; `TasteDNARow`; unneeded exports from `provider.ts`; the CSS and Tailwind items listed in the spec. Keep `@keyframes wave`.
- **Fix, proxy:** an unauthenticated request whose path starts with `/api` gets `401 { error: "Unauthorized" }` JSON, not a redirect. Correct the `/login` prefix check to the real login path.
- **Fix, mode:** set `data-mode` on `<html>` before first paint with an inline script in `app/layout.tsx` that reads the stored mode, and initialise the provider's state from that attribute on the client so children do not first render as "film". Keep the server render deterministic.
- **Fix, friends search:** `export function escapeIlike(q: string): string` in `lib/postgrest.ts` strips `,`, `(`, `)` and escapes `%`, `_`, `\`; the friends query uses it.

- [ ] **Step 1: Write failing tests** for `escapeIlike`: `"a,b"` → no comma; `"50%"` → `%` escaped; `"x)"` → no parenthesis; plain text unchanged.
- [ ] **Step 2:** Do the removals and fixes in small commits grouped as above.
- [ ] **Step 3: Manual check:** signed out, `curl -i localhost:3000/api?action=trending` returns 401 JSON; in music mode, a hard reload of Discover makes no film recommendation request and shows no colour flash.

### Task 15: Errors, comments, lint

- [ ] **Step 1:** For every empty or comment-only `catch` and every `.catch(() => …)` that hides a failure: either set an error state the page renders, or keep it with a one-line comment giving the reason. Check Supabase `{ error }` results that are currently ignored on writes (watchlist, queue, list edits, log delete) and surface failures.
- [ ] **Step 2:** Delete comments that restate the code and section-banner comments. Keep comments that explain why.
- [ ] **Step 3:** Run `npx eslint . --no-cache` and fix every message, or disable on one line with a reason. `@next/next/no-img-element` may be turned off in `eslint.config.mjs` with a comment. Align `eslint-config-next` with the installed `next` major.
- [ ] **Step 4:** `npm run lint && npm run build && npm test`. Expected: zero lint messages.
- [ ] **Step 5:** Commit `chore: surface errors, drop noise comments, lint clean`. Report TS/TSX line counts for `web/app`, `web/components`, `web/lib` at `origin/main` and now (`git ls-files | xargs wc -l`).
