/** HTTP status for a failed AI call: a missing key is 402, anything else 500. */
export function aiErrorStatus(code: "NO_API_KEY" | "PROVIDER_ERROR"): 402 | 500 {
  return code === "NO_API_KEY" ? 402 : 500;
}
