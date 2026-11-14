import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const mocks = vi.hoisted(() => ({
  anthropicCreate: vi.fn(),
  openaiCreate: vi.fn(),
  geminiGenerate: vi.fn(),
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: mocks.anthropicCreate };
  },
}));

vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create: mocks.openaiCreate } };
  },
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent: mocks.geminiGenerate };
  },
  FunctionCallingConfigMode: { ANY: "ANY" },
}));

import { detectProvider } from "./detect-provider";
import { callAI, resolveProvider, MODEL_MAP } from "./provider";
import * as tools from "./tools";

function fakeSupabase(storedKey: string | null): SupabaseClient {
  const result = { data: storedKey ? { ai_api_key: storedKey } : null, error: null };
  const chain = {
    select: () => chain,
    eq: () => chain,
    single: async () => result,
  };
  return { from: () => chain } as unknown as SupabaseClient;
}

const tool = tools.vibeSearchTool;

function options(storedKey: string | null, overrides: Partial<Parameters<typeof callAI>[0]> = {}) {
  return {
    supabase: fakeSupabase(storedKey),
    userId: "user-1",
    tier: "powerful" as const,
    maxTokens: 3000,
    system: "system prompt",
    tool,
    toolName: tool.name,
    userMessage: "user message",
    ...overrides,
  };
}

function anthropicMessage(stopReason: string, content: unknown[]) {
  return { stop_reason: stopReason, content };
}

const validOutput = { interpretation: "quiet films", results: [] };

beforeEach(() => {
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  vi.stubEnv("OPENAI_API_KEY", "");
  vi.stubEnv("GEMINI_API_KEY", "");
  mocks.anthropicCreate.mockReset();
  mocks.openaiCreate.mockReset();
  mocks.geminiGenerate.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("detectProvider", () => {
  test("detectProvider maps sk-ant-, AIza, sk- and returns null otherwise", () => {
    expect(detectProvider("sk-ant-api03-abc")).toBe("anthropic");
    expect(detectProvider("AIzaSyAbc")).toBe("gemini");
    expect(detectProvider("sk-proj-abc")).toBe("openai");
    expect(detectProvider("sk-abc")).toBe("openai");
    expect(detectProvider("xai-abc")).toBeNull();
    expect(detectProvider("")).toBeNull();
  });
});

describe("resolveProvider", () => {
  test("resolveProvider prefers the user's key over env keys", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-env");
    vi.stubEnv("OPENAI_API_KEY", "sk-env");
    vi.stubEnv("GEMINI_API_KEY", "AIzaEnv");

    expect(await resolveProvider(fakeSupabase("AIzaUser"), "user-1")).toEqual({
      provider: "gemini",
      apiKey: "AIzaUser",
    });
    expect(await resolveProvider(fakeSupabase("sk-user"), "user-1")).toEqual({
      provider: "openai",
      apiKey: "sk-user",
    });
  });

  test("resolveProvider falls back to env when the user has no key", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-env");
    vi.stubEnv("GEMINI_API_KEY", "AIzaEnv");
    expect(await resolveProvider(fakeSupabase(null), "user-1")).toEqual({
      provider: "openai",
      apiKey: "sk-env",
    });

    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-env");
    expect(await resolveProvider(fakeSupabase(null), "user-1")).toEqual({
      provider: "anthropic",
      apiKey: "sk-ant-env",
    });
  });
});

describe("callAI", () => {
  test("callAI returns NO_API_KEY when neither exists", async () => {
    const result = await callAI(options(null));
    expect(result).toMatchObject({ code: "NO_API_KEY" });
    expect(mocks.anthropicCreate).not.toHaveBeenCalled();
    expect(mocks.openaiCreate).not.toHaveBeenCalled();
    expect(mocks.geminiGenerate).not.toHaveBeenCalled();
  });

  test("callAI returns NO_API_KEY for a stored key of unknown format, even with an env key", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-env");
    const result = await callAI(options("not-a-known-key"));
    expect(result).toMatchObject({ code: "NO_API_KEY" });
    expect(mocks.anthropicCreate).not.toHaveBeenCalled();
  });

  test("anthropic tiers map to sonnet 5.5 and haiku 5.5", () =>
    expect(MODEL_MAP.anthropic).toEqual({
      powerful: "claude-sonnet-5-5",
      fast: "claude-haiku-5-5",
      fastest: "claude-haiku-5-5",
    }));

  test("anthropic request has no tool_choice, max_tokens >= 16000, effort medium for powerful", async () => {
    mocks.anthropicCreate.mockResolvedValue(
      anthropicMessage("end_turn", [{ type: "text", text: JSON.stringify(validOutput) }]),
    );

    await callAI(options("sk-ant-user", { tier: "powerful", maxTokens: 3000 }));
    const powerful = mocks.anthropicCreate.mock.calls[0][0];
    expect(powerful.model).toBe("claude-sonnet-5-5");
    expect(powerful.max_tokens).toBe(16000);
    expect(powerful.output_config).toEqual({
      effort: "medium",
      format: { type: "json_schema", schema: tool.input_schema },
    });
    expect(powerful.system).toBe("system prompt");
    expect(powerful.messages).toEqual([{ role: "user", content: "user message" }]);
    for (const key of ["tool_choice", "tools", "thinking", "temperature", "top_p", "top_k"]) {
      expect(powerful).not.toHaveProperty(key);
    }

    await callAI(options("sk-ant-user", { tier: "fast", maxTokens: 20000 }));
    const fast = mocks.anthropicCreate.mock.calls[1][0];
    expect(fast.model).toBe("claude-haiku-5-5");
    expect(fast.max_tokens).toBe(20000);
    expect(fast.output_config.effort).toBe("low");

    await callAI(options("sk-ant-user", { tier: "fastest" }));
    expect(mocks.anthropicCreate.mock.calls[2][0].output_config.effort).toBe("low");
  });

  test("anthropic stop_reason refusal returns PROVIDER_ERROR", async () => {
    mocks.anthropicCreate.mockResolvedValue(anthropicMessage("refusal", []));
    const result = await callAI(options("sk-ant-user"));
    expect(result).toMatchObject({ code: "PROVIDER_ERROR" });
    expect("error" in result && result.error).toMatch(/refusal/);
  });

  test("anthropic stop_reason max_tokens returns PROVIDER_ERROR", async () => {
    mocks.anthropicCreate.mockResolvedValue(
      anthropicMessage("max_tokens", [{ type: "text", text: '{"interpretation": "cut' }]),
    );
    const result = await callAI(options("sk-ant-user"));
    expect(result).toMatchObject({ code: "PROVIDER_ERROR" });
    expect("error" in result && result.error).toMatch(/max_tokens/);
  });

  test("anthropic output that is not JSON returns PROVIDER_ERROR", async () => {
    mocks.anthropicCreate.mockResolvedValue(
      anthropicMessage("end_turn", [{ type: "text", text: "Here are some films" }]),
    );
    const result = await callAI(options("sk-ant-user"));
    expect(result).toMatchObject({ code: "PROVIDER_ERROR" });
    expect("error" in result && result.error).toMatch(/JSON/);
  });

  test("anthropic valid JSON output returns data", async () => {
    mocks.anthropicCreate.mockResolvedValue(
      anthropicMessage("end_turn", [
        { type: "thinking", thinking: "", signature: "sig" },
        { type: "text", text: JSON.stringify(validOutput) },
      ]),
    );
    const result = await callAI(options("sk-ant-user", { tier: "fast" }));
    expect(result).toEqual({ data: validOutput, model: "claude-haiku-5-5" });
  });

  test("anthropic SDK errors return PROVIDER_ERROR", async () => {
    mocks.anthropicCreate.mockRejectedValue(new Error("401 invalid x-api-key"));
    const result = await callAI(options("sk-ant-user"));
    expect(result).toEqual({ error: "401 invalid x-api-key", code: "PROVIDER_ERROR" });
  });
});

describe("openai path", () => {
  function completion(message: Record<string, unknown>, finishReason = "stop") {
    return { choices: [{ finish_reason: finishReason, message: { refusal: null, ...message } }] };
  }

  test("openai tiers all use gpt-6-luna", () => {
    expect(MODEL_MAP.openai).toEqual({
      powerful: "gpt-6-luna",
      fast: "gpt-6-luna",
      fastest: "gpt-6-luna",
    });
  });

  test("openai request uses a strict JSON-schema response format, not a forced function call", async () => {
    mocks.openaiCreate.mockResolvedValue(completion({ content: JSON.stringify(validOutput) }));
    const result = await callAI(options("sk-user", { maxTokens: 2000 }));

    expect(result).toEqual({ data: validOutput, model: "gpt-6-luna" });
    const request = mocks.openaiCreate.mock.calls[0][0];
    expect(request.model).toBe("gpt-6-luna");
    expect(request.max_completion_tokens).toBe(16000);
    expect(request.response_format).toEqual({
      type: "json_schema",
      json_schema: {
        name: tool.name,
        description: tool.description,
        schema: tool.input_schema,
        strict: true,
      },
    });
    expect(request).not.toHaveProperty("tools");
    expect(request).not.toHaveProperty("tool_choice");
  });

  test("openai refusal or truncated output returns PROVIDER_ERROR", async () => {
    mocks.openaiCreate.mockResolvedValueOnce(completion({ content: null, refusal: "I can't help" }));
    const refused = await callAI(options("sk-user"));
    expect(refused).toMatchObject({ code: "PROVIDER_ERROR" });
    expect("error" in refused && refused.error).toMatch(/refus/);

    mocks.openaiCreate.mockResolvedValueOnce(completion({ content: '{"interp' }, "length"));
    const truncated = await callAI(options("sk-user"));
    expect(truncated).toMatchObject({ code: "PROVIDER_ERROR" });
    expect("error" in truncated && truncated.error).toMatch(/length/);
  });
});

describe("gemini path", () => {
  test("gemini uses gemini-2.5-flash-lite and sends the schema as JSON Schema", async () => {
    expect(MODEL_MAP.gemini).toEqual({
      powerful: "gemini-2.5-flash-lite",
      fast: "gemini-2.5-flash-lite",
      fastest: "gemini-2.5-flash-lite",
    });

    mocks.geminiGenerate.mockResolvedValue({ functionCalls: [{ name: tool.name, args: validOutput }] });
    const result = await callAI(options("AIzaUser"));

    expect(result).toEqual({ data: validOutput, model: "gemini-2.5-flash-lite" });
    const request = mocks.geminiGenerate.mock.calls[0][0];
    const declaration = request.config.tools[0].functionDeclarations[0];
    expect(declaration.parametersJsonSchema).toEqual(tool.input_schema);
    expect(declaration).not.toHaveProperty("parameters");
    expect(request.config.toolConfig.functionCallingConfig.allowedFunctionNames).toEqual([tool.name]);
  });
});

describe("tool schemas", () => {
  type Schema = {
    type?: string;
    properties?: Record<string, Schema>;
    required?: string[];
    additionalProperties?: boolean;
    items?: Schema;
    anyOf?: Schema[];
  };

  function objectSchemas(schema: Schema, path: string): [string, Schema][] {
    const found: [string, Schema][] = schema.type === "object" ? [[path, schema]] : [];
    for (const [key, child] of Object.entries(schema.properties ?? {})) {
      found.push(...objectSchemas(child, `${path}.${key}`));
    }
    if (schema.items) found.push(...objectSchemas(schema.items, `${path}[]`));
    for (const variant of schema.anyOf ?? []) found.push(...objectSchemas(variant, path));
    return found;
  }

  const allTools = Object.values(tools);

  test("every object schema forbids additional properties and requires every property", () => {
    expect(allTools.length).toBeGreaterThan(0);
    for (const t of allTools) {
      for (const [path, schema] of objectSchemas(t.input_schema as Schema, t.name)) {
        expect(schema.additionalProperties, path).toBe(false);
        expect([...(schema.required ?? [])].sort(), path).toEqual(
          Object.keys(schema.properties ?? {}).sort(),
        );
      }
    }
  });

  test("formerly optional fields are nullable", () => {
    const film = (tools.filmVerifyTool.input_schema as Schema).properties!.verified.items!.properties!;
    const vibe = (tools.vibeSearchTool.input_schema as Schema).properties!.results.items!.properties!;
    for (const field of [film.tmdb_id, film.year, vibe.artist, vibe.year]) {
      expect(field.anyOf?.map((s) => s.type)).toContain("null");
    }
  });
});
