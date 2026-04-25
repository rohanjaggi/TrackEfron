import type { Anthropic } from "@anthropic-ai/sdk";

type Tool = Anthropic.Messages.Tool;

export const tasteDNATool: Tool = {
  name: "generate_taste_dna",
  description: "Generate a structured taste profile analyzing the user's film and music preferences",
  input_schema: {
    type: "object" as const,
    properties: {
      fingerprint: {
        type: "string",
        description: "One-sentence taste identity, max 120 chars. Punchy and specific, not generic.",
      },
      film_identity: {
        type: "object",
        properties: {
          core: { type: "string", description: "2-3 sentences: what defines this person's film taste at its core" },
          aspect_lens: { type: "string", description: "2-3 sentences: which aspects (plot, cinematography, acting, soundtrack, pacing, casting) they weight most and how" },
          patterns: { type: "string", description: "2-3 sentences: recurring patterns in what they rate high vs low" },
          rating_style: { type: "string", description: "1-2 sentences: how generous/harsh they are, their rating distribution tendencies" },
        },
        required: ["core", "aspect_lens", "patterns", "rating_style"],
      },
      music_identity: {
        type: "object",
        properties: {
          core: { type: "string", description: "2-3 sentences: what defines this person's music taste at its core" },
          aspect_lens: { type: "string", description: "2-3 sentences: which aspects (lyrics, production, vocals, melody, replay, energy) they weight most and how" },
          patterns: { type: "string", description: "2-3 sentences: recurring patterns in what they rate high vs low" },
          rating_style: { type: "string", description: "1-2 sentences: how generous/harsh they are" },
        },
        required: ["core", "aspect_lens", "patterns", "rating_style"],
      },
      cross_domain: {
        type: "object",
        properties: {
          thread: { type: "string", description: "2-3 sentences: the connecting thread between their film and music taste" },
          surprising_connection: { type: "string", description: "1-2 sentences: a non-obvious connection between their film and music preferences" },
        },
        required: ["thread", "surprising_connection"],
      },
      blind_spots: {
        type: "array",
        items: { type: "string" },
        description: "2-4 blind spots: genres, eras, or styles they haven't explored that they might enjoy based on their taste",
      },
      guilty_pleasures: {
        type: "array",
        items: { type: "string" },
        description: "1-3 guilty pleasures or contradictions in their taste profile",
      },
    },
    required: ["fingerprint", "film_identity", "music_identity", "cross_domain", "blind_spots", "guilty_pleasures"],
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
        },
        description: "25 music recommendations ordered by relevance",
      },
    },
    required: ["recommendations"],
  },
};

export const filmVerifyTool: Tool = {
  name: "verify_film_recommendations",
  description: "Verify, re-rank, and enrich ML-generated film recommendations",
  input_schema: {
    type: "object" as const,
    properties: {
      verified: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            media_type: { type: "string", enum: ["movie", "tv"] },
            tmdb_id: { type: "number", description: "TMDB ID from the ML candidate list, or 0 if this is a new AI suggestion" },
            explanation: { type: "string", description: "2-3 sentences: personalized reason this matches their taste" },
            source: { type: "string", enum: ["ml", "ai"], description: "ml=from ML pipeline, ai=new suggestion" },
            year: { type: "number", description: "Release year, for TMDB validation of AI suggestions" },
          },
          required: ["title", "media_type", "explanation", "source"],
        },
        description: "Final 20 recommendations, ordered by relevance. Mix of ML-verified picks and AI suggestions.",
      },
    },
    required: ["verified"],
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
            artist: { type: "string", description: "Artist name (music only)" },
            year: { type: "number", description: "Release year (film only)" },
            type: { type: "string", enum: ["album", "track", "movie", "tv"] },
            why: { type: "string", description: "One sentence: why this matches the vibe" },
          },
          required: ["title", "type", "why"],
        },
        description: "10-15 results matching the vibe query",
      },
    },
    required: ["interpretation", "results"],
  },
};
