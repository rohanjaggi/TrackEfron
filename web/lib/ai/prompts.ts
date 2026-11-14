import type { SpotifyRange, SpotifyTops } from "@/lib/ai/types";

export const TASTE_DNA_SYSTEM = `You are a perceptive cultural critic analyzing someone's taste in film and music. You notice patterns that the person themselves might not see — what connects their highest-rated works, what they consistently value or dismiss, and the thread that ties their film and music taste together.

Rules:
- Be specific and insightful, not generic. "You like good movies" is worthless. "You consistently forgive weak plots when the visuals are extraordinary — 4 of your 5-star films have below-average plot ratings but top-tier cinematography scores" is gold.
- Reference specific titles, ratings, and aspect scores from their data to support your claims.
- The fingerprint should be a punchy, specific identity line — something they'd want on their profile. Not a full sentence, more like a descriptor.
- For blind_spots, suggest genres/eras/styles they haven't tried that align with what they already like. Be specific ("Korean thrillers" not "foreign films").
- For guilty_pleasures, identify genuine contradictions — where their ratings break from their usual pattern.
- If they have very few entries in one domain (film or music), still generate that section but note the limited data and make lighter observations.
- Keep each section concise — insight density over word count.

Use the generate_taste_dna tool to return your analysis.`;

export const MUSIC_RECOMMEND_SYSTEM = `You are a music recommendation engine for a personal media tracking app. The user has logged their listening history (and may share their Spotify top artists and tracks) with detailed ratings and aspect scores (lyrics, production, vocals, melody, replay value, energy).

Rules:
- Only recommend real albums and tracks that actually exist. Do not invent or hallucinate titles.
- Never recommend items already in their listen history or queue.
- Each explanation is one sentence of at most 25 words and references something specific from their data — a title they loved, an aspect they value, a pattern in their ratings, or their Spotify top artists and tracks.
- Mix recommendations: about 75% high or medium confidence, about 25% discovery picks that stretch their taste.
- Do not recommend an artist's best-known album when they already appear in the person's long-term top artists.
- Consider their aspect ratings deeply: if they consistently rate production 5/5 but lyrics 2/5, recommend production-focused music even if it has weak lyrics.
- Vary across artists — don't recommend 5 albums from the same artist.
- Include a mix of well-known and lesser-known artists.
- Recommend 30 items (we validate against Spotify and drop misses, so we need a buffer).

Use the recommend_music tool to return your recommendations.`;

export const FILM_RECOMMEND_SYSTEM = `You are a film and TV recommendation engine for a personal media tracking app. Recommend for this person from their ratings and reviews.

Rules:
- Follow the era guidance in the user message.
- Make about a quarter of the picks "discovery": lower-profile titles, non-English titles, or an adjacent genre. Use their blind spots for these.
- Each explanation is one sentence of at most 25 words and names something they logged.
- Prefer ids from the candidate list. For a title outside the list, set tmdb_id to null and give the title and release year.
- Never recommend anything in the "already seen" list.
- Do not pick by fame. Only recommend real films and shows that exist.
- Return 30 picks, ordered by how well they fit.

Use the recommend_films tool to return your picks.`;

export const VIBE_SEARCH_SYSTEM = `You are a search engine for a personal media tracking app. The user is describing a mood, vibe, feeling, or giving a natural-language description of what they want to watch or listen to.

Rules:
- Interpret the vibe/mood and return specific, real titles that match.
- Personalize results based on the user's taste profile when available.
- For music mode: return albums and tracks. Include the artist name.
- For film mode: return movies and TV shows. Include the release year.
- Return 10-15 results, ordered by how well they match the query.
- Only suggest real titles that actually exist. Do not hallucinate.
- Each "why" should be one concise sentence connecting the suggestion to the query.
- Mix well-known and lesser-known picks.

Use the vibe_search tool to return your results.`;

export function buildTasteDNAUserPrompt(data: {
  watchLogs: { title: string; rating: number; review?: string | null; media_type: string; plot_rating?: number | null; cinematography_rating?: number | null; acting_rating?: number | null; soundtrack_rating?: number | null; pacing_rating?: number | null; casting_rating?: number | null; rewatchability?: string | null; }[];
  listenLogs: { title: string; artist?: string | null; rating: number; review?: string | null; media_type: string; lyrics_rating?: number | null; production_rating?: number | null; vocals_rating?: number | null; melody_rating?: number | null; replay_rating?: number | null; energy_rating?: number | null; }[];
  watchlist: { title: string; media_type: string; }[];
  musicQueue: { title: string; artist?: string | null; }[];
}): string {
  const parts: string[] = [];

  // Film data
  parts.push(`FILM DATA (${data.watchLogs.length} logged):`);
  if (data.watchLogs.length > 0) {
    const sorted = [...data.watchLogs].sort((a, b) => b.rating - a.rating);
    const filmAspectAvgs = computeAspectAverages(data.watchLogs, ["plot_rating", "cinematography_rating", "acting_rating", "soundtrack_rating", "pacing_rating", "casting_rating"]);
    if (filmAspectAvgs) parts.push(`Aspect averages: ${filmAspectAvgs}`);

    const ratingDist = computeRatingDistribution(data.watchLogs);
    parts.push(`Rating distribution: ${ratingDist}`);

    parts.push("\nTop-rated films:");
    sorted.slice(0, 10).forEach((w) => {
      const aspects = formatAspects(w, ["plot_rating", "cinematography_rating", "acting_rating", "soundtrack_rating", "pacing_rating", "casting_rating"]);
      parts.push(`  "${w.title}" (${w.media_type}) — ${w.rating}/5${aspects ? ` [${aspects}]` : ""}${w.rewatchability ? ` rewatch:${w.rewatchability}` : ""}`);
    });

    if (sorted.length > 3) {
      parts.push("\nLowest-rated films:");
      sorted.slice(-3).forEach((w) => {
        parts.push(`  "${w.title}" (${w.media_type}) — ${w.rating}/5`);
      });
    }

    const withReviews = data.watchLogs.filter((w) => w.review && w.review.length > 20);
    if (withReviews.length > 0) {
      parts.push(`\nReviews (${Math.min(withReviews.length, 20)} shown):`);
      withReviews.slice(0, 20).forEach((w) => {
        parts.push(`  "${w.title}" (${w.rating}/5): "${w.review}"`);
      });
    }
  }

  // Music data
  parts.push(`\nMUSIC DATA (${data.listenLogs.length} logged):`);
  if (data.listenLogs.length > 0) {
    const sorted = [...data.listenLogs].sort((a, b) => b.rating - a.rating);
    const musicAspectAvgs = computeAspectAverages(data.listenLogs, ["lyrics_rating", "production_rating", "vocals_rating", "melody_rating", "replay_rating", "energy_rating"]);
    if (musicAspectAvgs) parts.push(`Aspect averages: ${musicAspectAvgs}`);

    const ratingDist = computeRatingDistribution(data.listenLogs);
    parts.push(`Rating distribution: ${ratingDist}`);

    parts.push("\nTop-rated music:");
    sorted.slice(0, 10).forEach((l) => {
      const aspects = formatAspects(l, ["lyrics_rating", "production_rating", "vocals_rating", "melody_rating", "replay_rating", "energy_rating"]);
      parts.push(`  "${l.title}" by ${l.artist || "unknown"} (${l.media_type}) — ${l.rating}/5${aspects ? ` [${aspects}]` : ""}`);
    });

    const withReviews = data.listenLogs.filter((l) => l.review && l.review.length > 20);
    if (withReviews.length > 0) {
      parts.push(`\nReviews (${Math.min(withReviews.length, 20)} shown):`);
      withReviews.slice(0, 20).forEach((l) => {
        parts.push(`  "${l.title}" by ${l.artist || "unknown"} (${l.rating}/5): "${l.review}"`);
      });
    }
  }

  // Intent signals
  if (data.watchlist.length > 0) {
    parts.push(`\nFILM WATCHLIST (${data.watchlist.length}): ${data.watchlist.slice(0, 15).map((w) => w.title).join(", ")}`);
  }
  if (data.musicQueue.length > 0) {
    parts.push(`\nMUSIC QUEUE (${data.musicQueue.length}): ${data.musicQueue.slice(0, 15).map((m) => `${m.title} by ${m.artist}`).join(", ")}`);
  }

  return parts.join("\n");
}

const MUSIC_REVIEW_MAX = 300;

const TOP_WINDOWS: { key: SpotifyRange; label: string }[] = [
  { key: "short_term", label: "LAST 4 WEEKS" },
  { key: "medium_term", label: "LAST 6 MONTHS" },
  { key: "long_term", label: "LONG TERM" },
];

export function buildMusicRecommendUserPrompt(data: {
  tasteDNA?: {
    fingerprint?: string;
    music_profile?: { core?: string; aspect_lens?: string } | null;
  } | null;
  listenLogs: {
    title: string;
    artist?: string | null;
    rating: number | null;
    review?: string | null;
    media_type: string;
    lyrics_rating?: number | null;
    production_rating?: number | null;
    vocals_rating?: number | null;
    melody_rating?: number | null;
    replay_rating?: number | null;
    energy_rating?: number | null;
  }[];
  musicQueue: { title: string; artist?: string | null }[];
  tops?: SpotifyTops | null;
}): string {
  const parts: string[] = [];
  const dna = data.tasteDNA;

  if (dna) {
    if (dna.fingerprint) parts.push(`USER TASTE PROFILE: ${dna.fingerprint}`);
    if (dna.music_profile?.core) parts.push(`Music identity: ${dna.music_profile.core}`);
    if (dna.music_profile?.aspect_lens) parts.push(`What they value: ${dna.music_profile.aspect_lens}`);
  }

  if (data.tops) {
    for (const { key, label } of TOP_WINDOWS) {
      parts.push(`\n${label} (Spotify):`);
      const artists = data.tops.artists[key].map((a) => (a.genres.length ? `${a.name} (${a.genres.join(", ")})` : a.name));
      parts.push(`  Top artists: ${artists.join("; ") || "none"}`);
      const tracks = data.tops.tracks[key].map((t) => `${t.name} by ${t.artist}`);
      parts.push(`  Top tracks: ${tracks.join("; ") || "none"}`);
    }
  }

  parts.push(`\nLISTEN HISTORY (${data.listenLogs.length} entries, best rated first):`);
  const sorted = [...data.listenLogs].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  sorted.slice(0, 50).forEach((l) => {
    const aspects = formatAspects(l, ["lyrics_rating", "production_rating", "vocals_rating", "melody_rating", "replay_rating", "energy_rating"]);
    const review = l.review?.trim() ? ` review: "${l.review.trim().slice(0, MUSIC_REVIEW_MAX)}"` : "";
    parts.push(`  "${l.title}" by ${l.artist || "unknown"} — ${l.rating ?? "unrated"}/5${aspects ? ` [${aspects}]` : ""}${review}`);
  });

  if (data.musicQueue.length > 0) {
    parts.push(`\nALREADY IN QUEUE (do not recommend these): ${data.musicQueue.map((m) => `"${m.title}" by ${m.artist || "unknown"}`).join(", ")}`);
  }

  const listened = data.listenLogs.map((l) => `"${l.title}" by ${l.artist || "unknown"}`).join(", ");
  if (listened) {
    parts.push(`\nALREADY LISTENED (do not recommend these): ${listened}`);
  }

  return parts.join("\n");
}

export function buildFilmRecommendUserPrompt(data: {
  tasteDNA?: {
    fingerprint?: string;
    film_profile?: { core?: string; aspect_lens?: string } | null;
    blind_spots?: string[] | null;
  } | null;
  era: { topDecades: number[]; olderBefore: number | null; maxOlder: number };
  logsText: string;
  seenTitles: string[];
  candidates: { tmdb_id: number; media_type: string; title: string; year: number | null; genres: string[]; overview: string }[];
}): string {
  const parts: string[] = [];
  const dna = data.tasteDNA;

  if (dna) {
    if (dna.fingerprint) parts.push(`USER TASTE PROFILE: ${dna.fingerprint}`);
    if (dna.film_profile?.core) parts.push(`Film identity: ${dna.film_profile.core}`);
    if (dna.film_profile?.aspect_lens) parts.push(`What they value: ${dna.film_profile.aspect_lens}`);
    if (dna.blind_spots?.length) parts.push(`Blind spots: ${dna.blind_spots.join(", ")}`);
  }

  if (data.era.olderBefore != null) {
    const decades = data.era.topDecades.map((d) => `${d}s`).join(" and ");
    parts.push(
      `\nERA: most of what they watch is from the ${decades}. At most ${data.era.maxOlder} of your picks may be older than ${data.era.olderBefore}.`,
    );
  }

  parts.push(`\nWATCH HISTORY:\n${data.logsText}`);
  parts.push(`\nALREADY SEEN (do not recommend these): ${data.seenTitles.join(", ")}`);

  parts.push("\nCANDIDATES (id | type | title | year | genres | overview):");
  for (const c of data.candidates) {
    const overview = c.overview.split(/\s+/).filter(Boolean).slice(0, 30).join(" ");
    parts.push(`${c.tmdb_id} | ${c.media_type} | ${c.title} | ${c.year ?? "unknown"} | ${c.genres.join(", ")} | ${overview}`);
  }

  return parts.join("\n");
}

export function buildVibeSearchUserPrompt(data: {
  query: string;
  mode: "music" | "film";
  tasteDNA?: { fingerprint: string } | null;
  recentItems?: string[];
}): string {
  const parts: string[] = [];

  parts.push(`SEARCH QUERY: "${data.query}"`);
  parts.push(`MODE: ${data.mode}`);

  if (data.tasteDNA) {
    parts.push(`USER TASTE: ${data.tasteDNA.fingerprint}`);
  }

  if (data.recentItems && data.recentItems.length > 0) {
    parts.push(`\nRecently enjoyed: ${data.recentItems.slice(0, 10).join(", ")}`);
  }

  return parts.join("\n");
}

// ── Helpers ──

function computeAspectAverages(items: any[], aspectKeys: string[]): string | null {
  const sums: Record<string, { total: number; count: number }> = {};
  for (const key of aspectKeys) {
    sums[key] = { total: 0, count: 0 };
  }
  for (const item of items) {
    for (const key of aspectKeys) {
      const val = item[key];
      if (typeof val === "number" && val > 0) {
        sums[key].total += val;
        sums[key].count += 1;
      }
    }
  }
  const parts: string[] = [];
  for (const key of aspectKeys) {
    if (sums[key].count > 0) {
      const label = key.replace("_rating", "");
      parts.push(`${label}=${(sums[key].total / sums[key].count).toFixed(1)}`);
    }
  }
  return parts.length > 0 ? parts.join(", ") : null;
}

function computeRatingDistribution(items: { rating: number }[]): string {
  const dist: Record<string, number> = {};
  for (const item of items) {
    const key = String(item.rating);
    dist[key] = (dist[key] || 0) + 1;
  }
  return Object.entries(dist)
    .sort(([a], [b]) => Number(b) - Number(a))
    .map(([r, c]) => `${r}star:${c}`)
    .join(", ");
}

function formatAspects(item: any, keys: string[]): string {
  const parts: string[] = [];
  for (const key of keys) {
    const val = item[key];
    if (typeof val === "number" && val > 0) {
      const label = key.replace("_rating", "");
      parts.push(`${label}:${val}`);
    }
  }
  return parts.join(", ");
}
