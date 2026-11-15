import type { SupabaseClient } from "@supabase/supabase-js";
import { callAI } from "@/lib/ai/provider";
import type { Tool } from "@/lib/ai/tools";

export class AIError extends Error {
  constructor(
    message: string,
    readonly code: "NO_API_KEY" | "PROVIDER_ERROR",
  ) {
    super(message);
    this.name = "AIError";
  }
}

/** Builds the `ai(system, user)` function the recommendation builders expect. */
export function makeAI<T>(opts: {
  supabase: SupabaseClient;
  userId: string;
  tool: Tool;
}): (system: string, user: string) => Promise<T> {
  return async (system, user) => {
    const result = await callAI({
      supabase: opts.supabase,
      userId: opts.userId,
      tier: "powerful",
      maxTokens: 16000,
      system,
      tool: opts.tool,
      userMessage: user,
    });
    if ("error" in result) throw new AIError(result.error, result.code);
    return result.data as T;
  };
}
