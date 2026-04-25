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

export const MUSIC_RECOMMEND_SYSTEM = `You are a music recommendation engine for a personal media tracking app. The user has logged their listening history with detailed ratings and aspect scores (lyrics, production, vocals, melody, replay value, energy).

Rules:
- Only recommend real albums and tracks that actually exist. Do not invent or hallucinate titles.
- Never recommend items already in their listen history or queue.
- Each explanation must reference something specific from their data — a title they loved, an aspect they value, a pattern in their ratings.
- Mix recommendations: ~60% safe bets (high confidence), ~25% moderate matches, ~15% discovery picks that stretch their taste.
- Consider their aspect ratings deeply: if they consistently rate production 5/5 but lyrics 2/5, recommend production-focused music even if it has weak lyrics.
- Vary across artists — don't recommend 5 albums from the same artist.
- Include a mix of well-known and lesser-known artists.
- Recommend 25 items (we validate against Spotify and drop misses, so we need a buffer).

Use the recommend_music tool to return your recommendations.`;

export const FILM_VERIFY_SYSTEM = `You are an AI layer that verifies and enriches film recommendations from a machine learning pipeline. The ML model uses collaborative filtering and content similarity, but it has blind spots: stale training data, no awareness of recent releases, and scoring signals that sometimes produce false positives.

Your job:
1. VERIFY: Review each ML candidate against the user's actual taste profile. Does this genuinely match what they like? Flag and drop picks that contradict their demonstrated preferences (e.g., ML suggests a horror film but user rates horror consistently low).
2. RE-RANK: Reorder based on deeper taste understanding — review themes, aspect preferences, contextual signals the ML model can't capture.
3. ENRICH: Drop weak ML picks and suggest replacements. You can recommend newer titles, niche picks, or films the static ML model doesn't know about. Mark these as source="ai".
4. EXPLAIN: Write a personalized 2-3 sentence explanation for each final recommendation, referencing specific things from the user's profile.

Rules:
- Keep at least 12-15 of the ML candidates (they're pre-filtered by collaborative signals which you can't replicate). Only drop clear misfits.
- Fill to exactly 20 total recommendations.
- AI suggestions must be real films/TV shows that actually exist.
- For AI suggestions, include the release year for TMDB validation.
- Reference specific titles, ratings, and review quotes from the user's data in explanations.

Use the verify_film_recommendations tool to return your final list.`;

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

export function buildMusicRecommendUserPrompt(data: {
  tasteDNA?: { fingerprint: string; music_identity?: any } | null;
  listenLogs: { title: string; artist?: string | null; rating: number; media_type: string; lyrics_rating?: number | null; production_rating?: number | null; vocals_rating?: number | null; melody_rating?: number | null; replay_rating?: number | null; energy_rating?: number | null; }[];
  musicQueue: { title: string; artist?: string | null; }[];
}): string {
  const parts: string[] = [];

  if (data.tasteDNA) {
    parts.push(`USER TASTE PROFILE: ${data.tasteDNA.fingerprint}`);
    if (data.tasteDNA.music_identity?.core) {
      parts.push(`Music identity: ${data.tasteDNA.music_identity.core}`);
    }
    if (data.tasteDNA.music_identity?.aspect_lens) {
      parts.push(`What they value: ${data.tasteDNA.music_identity.aspect_lens}`);
    }
  }

  parts.push(`\nLISTEN HISTORY (${data.listenLogs.length} entries, most recent first):`);
  const sorted = [...data.listenLogs].sort((a, b) => b.rating - a.rating);
  sorted.slice(0, 50).forEach((l) => {
    const aspects = formatAspects(l, ["lyrics_rating", "production_rating", "vocals_rating", "melody_rating", "replay_rating", "energy_rating"]);
    parts.push(`  "${l.title}" by ${l.artist || "unknown"} — ${l.rating}/5${aspects ? ` [${aspects}]` : ""}`);
  });

  if (data.musicQueue.length > 0) {
    parts.push(`\nALREADY IN QUEUE (do not recommend these): ${data.musicQueue.map((m) => `"${m.title}" by ${m.artist}`).join(", ")}`);
  }

  const listened = data.listenLogs.map((l) => `"${l.title}" by ${l.artist}`).join(", ");
  if (listened) {
    parts.push(`\nALREADY LISTENED (do not recommend these): ${listened}`);
  }

  return parts.join("\n");
}

export function buildFilmVerifyUserPrompt(data: {
  tasteDNA?: { fingerprint: string; film_identity?: any } | null;
  watchLogs: { title: string; rating: number; review?: string | null; media_type: string; plot_rating?: number | null; cinematography_rating?: number | null; acting_rating?: number | null; soundtrack_rating?: number | null; pacing_rating?: number | null; casting_rating?: number | null; }[];
  mlCandidates: { tmdb_id: number; title: string; media_type: string; poster_url?: string | null; }[];
}): string {
  const parts: string[] = [];

  if (data.tasteDNA) {
    parts.push(`USER TASTE PROFILE: ${data.tasteDNA.fingerprint}`);
    if (data.tasteDNA.film_identity?.core) {
      parts.push(`Film identity: ${data.tasteDNA.film_identity.core}`);
    }
    if (data.tasteDNA.film_identity?.aspect_lens) {
      parts.push(`What they value: ${data.tasteDNA.film_identity.aspect_lens}`);
    }
    if (data.tasteDNA.film_identity?.patterns) {
      parts.push(`Patterns: ${data.tasteDNA.film_identity.patterns}`);
    }
  }

  parts.push(`\nRECENT WATCH HISTORY (${data.watchLogs.length} entries):`);
  const sorted = [...data.watchLogs].sort((a, b) => b.rating - a.rating);
  sorted.slice(0, 30).forEach((w) => {
    const aspects = formatAspects(w, ["plot_rating", "cinematography_rating", "acting_rating", "soundtrack_rating", "pacing_rating", "casting_rating"]);
    parts.push(`  "${w.title}" (${w.media_type}) — ${w.rating}/5${aspects ? ` [${aspects}]` : ""}${w.review ? ` Review: "${w.review.slice(0, 150)}"` : ""}`);
  });

  parts.push(`\nML CANDIDATES (${data.mlCandidates.length} items to verify/re-rank/enrich):`);
  data.mlCandidates.forEach((c, i) => {
    parts.push(`  ${i + 1}. "${c.title}" (${c.media_type}) [tmdb_id: ${c.tmdb_id}]`);
  });

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
