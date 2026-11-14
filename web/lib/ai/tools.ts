import type { Anthropic } from "@anthropic-ai/sdk";

type Tool = Anthropic.Messages.Tool;

export const tasteDNATool: Tool = {
  name: "generate_taste_dna",
  description: "Generate a short taste profile of the user's film and music preferences",
  input_schema: {
    type: "object" as const,
    properties: {
      fingerprint: {
        type: "string",
        description: "One punchy, specific taste-identity line, at most 80 characters.",
      },
      pulse: {
        type: "array",
        items: { type: "string" },
        description: "Exactly 3 single words that capture this person's taste. One word each, no spaces.",
      },
      observations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            text: { type: "string", description: "One sentence of at most 20 words about this person's taste" },
            cited_title: { type: "string", description: "One film, series, album or track from their logs that backs the observation, spelled exactly as given" },
          },
          required: ["text", "cited_title"],
          additionalProperties: false,
        },
        description: "2 or 3 observations, no more than 3",
      },
      film_identity: {
        type: "object",
        properties: {
          core: { type: "string", description: "One sentence: what defines this person's film taste at its core" },
          aspect_lens: { type: "string", description: "One sentence: which aspects (plot, cinematography, acting, soundtrack, pacing, casting) they weight most" },
        },
        required: ["core", "aspect_lens"],
        additionalProperties: false,
      },
      music_identity: {
        type: "object",
        properties: {
          core: { type: "string", description: "One sentence: what defines this person's music taste at its core" },
          aspect_lens: { type: "string", description: "One sentence: which aspects (lyrics, production, vocals, melody, replay, energy) they weight most" },
        },
        required: ["core", "aspect_lens"],
        additionalProperties: false,
      },
      blind_spots: {
        type: "array",
        items: { type: "string" },
        description: "2 to 4 blind spots: genres, eras, or styles they haven't explored that they might enjoy based on their taste",
      },
    },
    required: ["fingerprint", "pulse", "observations", "film_identity", "music_identity", "blind_spots"],
    additionalProperties: false,
  },
};

export const musicRecommendTool: Tool = {
  name: "recommend_music",
  description: "Generate personalized music recommendations based on user taste profile",
  input_schema: {
    type: "object" as const,
    properties: {
      recommendations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            artist: { type: "string", description: "Artist or band name" },
            title: { type: "string", description: "Album or track title" },
            type: { type: "string", enum: ["album", "track"] },
            explanation: { type: "string", description: "2-3 sentences: why this matches their taste, referencing specific things they've rated/reviewed" },
            confidence: { type: "string", enum: ["high", "medium", "discovery"], description: "high=safe bet, medium=likely match, discovery=stretch pick for exploration" },
          },
          required: ["artist", "title", "type", "explanation", "confidence"],
          additionalProperties: false,
        },
        description: "25 music recommendations ordered by relevance",
      },
    },
    required: ["recommendations"],
    additionalProperties: false,
  },
};

export const filmRecommendTool: Tool = {
  name: "recommend_films",
  description: "Return personalized film and TV picks for the user",
  input_schema: {
    type: "object" as const,
    properties: {
      picks: {
        type: "array",
        items: {
          type: "object",
          properties: {
            tmdb_id: { anyOf: [{ type: "number" }, { type: "null" }], description: "TMDB id from the candidate list, or null for a title outside it" },
            title: { type: "string" },
            year: { anyOf: [{ type: "number" }, { type: "null" }], description: "Release year, needed when tmdb_id is null" },
            media_type: { type: "string", enum: ["movie", "tv"] },
            explanation: { type: "string", description: "One sentence, at most 25 words, naming something they logged" },
            confidence: { type: "string", enum: ["high", "medium", "discovery"], description: "high=safe bet, medium=likely match, discovery=stretch pick" },
          },
          required: ["tmdb_id", "title", "year", "media_type", "explanation", "confidence"],
          additionalProperties: false,
        },
        description: "30 picks ordered by relevance",
      },
    },
    required: ["picks"],
    additionalProperties: false,
  },
};

export const vibeSearchTool: Tool = {
  name: "vibe_search",
  description: "Search for media matching a mood, vibe, or natural-language description",
  input_schema: {
    type: "object" as const,
    properties: {
      interpretation: {
        type: "string",
        description: "Brief 1-sentence interpretation of what the user is looking for",
      },
      results: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            artist: { anyOf: [{ type: "string" }, { type: "null" }], description: "Artist name (music only; null for film)" },
            year: { anyOf: [{ type: "number" }, { type: "null" }], description: "Release year (film only; null for music)" },
            type: { type: "string", enum: ["album", "track", "movie", "tv"] },
            why: { type: "string", description: "One sentence: why this matches the vibe" },
          },
          required: ["title", "artist", "year", "type", "why"],
          additionalProperties: false,
        },
        description: "10-15 results matching the vibe query",
      },
    },
    required: ["interpretation", "results"],
    additionalProperties: false,
  },
};
