export type Provider = "anthropic" | "openai" | "gemini";

export function detectProvider(key: string): Provider | null {
  if (key.startsWith("sk-ant-")) return "anthropic";
  if (key.startsWith("AIza")) return "gemini";
  if (key.startsWith("sk-")) return "openai";
  return null;
}

const ENV_KEYS: [Provider, string][] = [
  ["anthropic", "ANTHROPIC_API_KEY"],
  ["openai", "OPENAI_API_KEY"],
  ["gemini", "GEMINI_API_KEY"],
];

/** The server key used for users without their own, in precedence order. */
export function envProvider(): { provider: Provider; apiKey: string } | null {
  for (const [provider, name] of ENV_KEYS) {
    const apiKey = process.env[name];
    if (apiKey) return { provider, apiKey };
  }
  return null;
}
