import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenAI, FunctionCallingConfigMode } from "@google/genai";
import type { SupabaseClient } from "@supabase/supabase-js";

type Provider = "anthropic" | "openai" | "gemini";
type Tier = "powerful" | "fast" | "fastest";

const MODEL_MAP: Record<Provider, Record<Tier, string>> = {
  anthropic: {
    powerful: "claude-sonnet-4-20250514",
    fast: "claude-haiku-4-5-20251001",
    fastest: "claude-haiku-4-5-20251001",
  },
  openai: {
    powerful: "gpt-5.4",
    fast: "gpt-5.4-mini",
    fastest: "gpt-5.4-nano",
  },
  gemini: {
    powerful: "gemini-2.5-flash",
    fast: "gemini-2.5-flash",
    fastest: "gemini-3.1-flash-lite-preview",
  },
};

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

function detectProvider(key: string): Provider {
  if (key.startsWith("sk-ant-")) return "anthropic";
  if (key.startsWith("AIza")) return "gemini";
  return "openai";
}

async function resolveProvider(
  supabase: SupabaseClient,
  userId: string,
): Promise<ProviderConfig | null> {
  if (process.env.OPENAI_API_KEY) {
    return { provider: "openai", apiKey: process.env.OPENAI_API_KEY };
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return { provider: "anthropic", apiKey: process.env.ANTHROPIC_API_KEY };
  }
  if (process.env.GEMINI_API_KEY) {
    return { provider: "gemini", apiKey: process.env.GEMINI_API_KEY };
  }

  const { data } = await supabase
    .from("user_ai_settings")
    .select("ai_api_key")
    .eq("user_id", userId)
    .single();

  if (data?.ai_api_key) {
    const key = data.ai_api_key as string;
    return { provider: detectProvider(key), apiKey: key };
  }

  return null;
}

function anthropicToolToOpenAI(
  tool: AnthropicTool,
): OpenAI.Chat.Completions.ChatCompletionTool {
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description || "",
      parameters: tool.input_schema as Record<string, unknown>,
    },
  };
}

async function callAnthropic(
  apiKey: string,
  model: string,
  options: CallAIOptions,
): Promise<CallAIResult> {
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model,
    max_tokens: options.maxTokens,
    system: options.system,
    tools: [options.tool],
    tool_choice: { type: "tool", name: options.toolName },
    messages: [{ role: "user", content: options.userMessage }],
  });

  const toolBlock = response.content.find((b) => b.type === "tool_use");
  if (!toolBlock || toolBlock.type !== "tool_use") {
    return { error: "AI failed to generate structured output", code: "PROVIDER_ERROR" };
  }

  return { data: toolBlock.input, model };
}

async function callOpenAI(
  apiKey: string,
  model: string,
  options: CallAIOptions,
): Promise<CallAIResult> {
  const client = new OpenAI({ apiKey });
  const response = await client.chat.completions.create({
    model,
    max_completion_tokens: options.maxTokens,
    messages: [
      { role: "system", content: options.system },
      { role: "user", content: options.userMessage },
    ],
    tools: [anthropicToolToOpenAI(options.tool)],
    tool_choice: { type: "function", function: { name: options.toolName } },
  });

  const toolCall = response.choices[0]?.message?.tool_calls?.[0];
  if (!toolCall || toolCall.type !== "function") {
    return { error: "AI failed to generate structured output", code: "PROVIDER_ERROR" };
  }

  try {
    const data = JSON.parse(toolCall.function.arguments);
    return { data, model };
  } catch {
    return { error: "AI returned malformed output", code: "PROVIDER_ERROR" };
  }
}

async function callGemini(
  apiKey: string,
  model: string,
  options: CallAIOptions,
): Promise<CallAIResult> {
  const client = new GoogleGenAI({ apiKey });

  const schema = options.tool.input_schema as Record<string, unknown>;

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
          parameters: schema,
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
    return { error: "AI failed to generate structured output", code: "PROVIDER_ERROR" };
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
    return { error: msg, code: "PROVIDER_ERROR" };
  }
}

export { resolveProvider, MODEL_MAP };
export type { CallAIResult, CallAISuccess, CallAIError, Tier, Provider };
