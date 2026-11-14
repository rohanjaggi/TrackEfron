import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenAI, FunctionCallingConfigMode } from "@google/genai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { detectProvider, envProvider, type Provider } from "./detect-provider";

type Tier = "powerful" | "fast" | "fastest";

const MODEL_MAP: Record<Provider, Record<Tier, string>> = {
  anthropic: {
    powerful: "claude-sonnet-5-5",
    fast: "claude-haiku-5-5",
    fastest: "claude-haiku-5-5",
  },
  openai: {
    powerful: "gpt-6-luna",
    fast: "gpt-6-luna",
    fastest: "gpt-6-luna",
  },
  gemini: {
    powerful: "gemini-2.5-flash-lite",
    fast: "gemini-2.5-flash-lite",
    fastest: "gemini-2.5-flash-lite",
  },
};

// Claude 5.5 models and gpt-6-luna reason by default, and reasoning counts
// against the output limit, so the callers' 2,000-4,000 would truncate.
const MIN_OUTPUT_TOKENS = 16000;

type AnthropicTool = Anthropic.Messages.Tool;

interface CallAIOptions {
  supabase: SupabaseClient;
  userId: string;
  tier: Tier;
  maxTokens: number;
  system: string;
  tool: AnthropicTool;
  toolName: string;
  userMessage: string;
}

type CallAISuccess = { data: unknown; model: string };
type CallAIError = { error: string; code: "NO_API_KEY" | "PROVIDER_ERROR" };
type CallAIResult = CallAISuccess | CallAIError;

interface ProviderConfig {
  provider: Provider;
  apiKey: string;
}

function providerError(error: string): CallAIError {
  return { error, code: "PROVIDER_ERROR" };
}

async function resolveProvider(
  supabase: SupabaseClient,
  userId: string,
): Promise<ProviderConfig | null> {
  const { data } = await supabase
    .from("user_ai_settings")
    .select("ai_api_key")
    .eq("user_id", userId)
    .single();

  if (data?.ai_api_key) {
    const key = data.ai_api_key as string;
    const provider = detectProvider(key);
    // A stored key we cannot route is an error to fix in settings, not a
    // reason to bill the server key.
    return provider ? { provider, apiKey: key } : null;
  }

  return envProvider();
}

function parseJSON(text: string, provider: string, model: string): CallAIResult {
  try {
    return { data: JSON.parse(text), model };
  } catch {
    return providerError(`${provider} returned output that is not valid JSON`);
  }
}

async function callAnthropic(
  apiKey: string,
  model: string,
  options: CallAIOptions,
): Promise<CallAIResult> {
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model,
    max_tokens: Math.max(options.maxTokens, MIN_OUTPUT_TOKENS),
    system: options.system,
    messages: [{ role: "user", content: options.userMessage }],
    output_config: {
      effort: options.tier === "powerful" ? "medium" : "low",
      format: { type: "json_schema", schema: options.tool.input_schema },
    },
  });

  if (response.stop_reason === "refusal") {
    return providerError("Anthropic declined the request (stop_reason: refusal)");
  }
  if (
    response.stop_reason === "max_tokens" ||
    response.stop_reason === "model_context_window_exceeded"
  ) {
    return providerError(`Anthropic output was cut off (stop_reason: ${response.stop_reason})`);
  }

  // The response can begin with thinking blocks; the JSON is in the text.
  const text = response.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("");
  return parseJSON(text, "Anthropic", model);
}

async function callOpenAI(
  apiKey: string,
  model: string,
  options: CallAIOptions,
): Promise<CallAIResult> {
  const client = new OpenAI({ apiKey });
  // gpt-6-luna takes function calls in Chat Completions only with reasoning
  // off, so the structured output comes from a JSON-schema response format.
  const response = await client.chat.completions.create({
    model,
    max_completion_tokens: Math.max(options.maxTokens, MIN_OUTPUT_TOKENS),
    messages: [
      { role: "system", content: options.system },
      { role: "user", content: options.userMessage },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: options.tool.name,
        description: options.tool.description,
        schema: options.tool.input_schema,
        strict: true,
      },
    },
  });

  const choice = response.choices[0];
  if (choice?.message?.refusal) {
    return providerError("OpenAI declined the request (refusal)");
  }
  if (choice?.finish_reason === "length") {
    return providerError("OpenAI output was cut off (finish_reason: length)");
  }
  if (!choice?.message?.content) {
    return providerError("OpenAI returned no output");
  }

  return parseJSON(choice.message.content, "OpenAI", model);
}

async function callGemini(
  apiKey: string,
  model: string,
  options: CallAIOptions,
): Promise<CallAIResult> {
  const client = new GoogleGenAI({ apiKey });

  const response = await client.models.generateContent({
    model,
    contents: options.userMessage,
    config: {
      systemInstruction: options.system,
      maxOutputTokens: options.maxTokens,
      tools: [{
        functionDeclarations: [{
          name: options.tool.name,
          description: options.tool.description || "",
          // JSON Schema field: `parameters` takes an OpenAPI schema, which
          // has no `additionalProperties`.
          parametersJsonSchema: options.tool.input_schema,
        }],
      }],
      toolConfig: {
        functionCallingConfig: {
          mode: FunctionCallingConfigMode.ANY,
          allowedFunctionNames: [options.toolName],
        },
      },
    },
  });

  const fc = response.functionCalls?.[0];
  if (!fc || !fc.args) {
    return providerError("AI failed to generate structured output");
  }

  return { data: fc.args, model };
}

export async function callAI(options: CallAIOptions): Promise<CallAIResult> {
  const config = await resolveProvider(options.supabase, options.userId);
  if (!config) {
    return {
      error: "No AI API key configured. Add one in your profile settings.",
      code: "NO_API_KEY",
    };
  }

  const model = MODEL_MAP[config.provider][options.tier];

  try {
    if (config.provider === "anthropic") {
      return await callAnthropic(config.apiKey, model, options);
    }
    if (config.provider === "gemini") {
      return await callGemini(config.apiKey, model, options);
    }
    return await callOpenAI(config.apiKey, model, options);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown AI error";
    return providerError(msg);
  }
}

export { resolveProvider, MODEL_MAP };
