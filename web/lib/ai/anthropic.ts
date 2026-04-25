import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const MODELS = {
  SONNET: "claude-sonnet-4-20250514",
  HAIKU: "claude-haiku-4-5-20251001",
} as const;

export default client;
