import type { RecsResponse } from "@/lib/ai/types";

/** What one call to the recommendations endpoint came back with. */
export type RecsLoad<T> =
  | { kind: "ok"; body: T }
  | { kind: "no_key" }
  | { kind: "error"; detail: string | null };

/**
 * The one loader for film and music picks. 402 means no AI key; any other failure
 * (an error status, a network failure, a body without `items`) is an error, and a
 * provider error carries the server's message in `detail` for callers that show it.
 */
export async function loadRecs<T extends RecsResponse<unknown>>(url: string): Promise<RecsLoad<T>> {
  try {
    const res = await fetch(url);
    if (res.status === 402) return { kind: "no_key" };
    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const err = (body ?? {}) as { error?: unknown; code?: unknown };
      const detail = err.code === "PROVIDER_ERROR" && typeof err.error === "string" ? err.error : null;
      return { kind: "error", detail };
    }
    if (!body || !Array.isArray((body as { items?: unknown }).items)) return { kind: "error", detail: null };
    return { kind: "ok", body: body as T };
  } catch {
    return { kind: "error", detail: null };
  }
}
