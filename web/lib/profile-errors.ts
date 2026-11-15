import { PG_UNIQUE_VIOLATION } from "@/lib/postgrest";

export const TRY_AGAIN = "Check your connection and try again.";

/** Plain words for a failed profile save; never blames the connection unless it was one. */
export function saveErrorMessage(err: unknown): string {
  const rec = typeof err === "object" && err !== null ? (err as Record<string, unknown>) : {};
  const code = typeof rec.code === "string" ? rec.code : "";
  const message = typeof rec.message === "string" ? rec.message.toLowerCase() : "";
  const status = rec.status;

  if (
    status === 429 ||
    code.startsWith("over_") ||
    message.includes("rate limit") ||
    message.includes("for security purposes")
  ) {
    return "Too many attempts. Wait a moment, then try again.";
  }
  if (
    code === "session_not_found" ||
    code === "refresh_token_not_found" ||
    rec.name === "AuthSessionMissingError" ||
    message.includes("session missing") ||
    message.includes("jwt expired")
  ) {
    return "Your session has expired. Sign in again to save your changes.";
  }
  if (
    code === "email_exists" ||
    code === "user_already_exists" ||
    message.includes("already registered")
  ) {
    return "That email is already in use.";
  }
  if (code === "email_address_invalid" || message.includes("invalid email")) {
    return "That email address isn't valid.";
  }
  if (code === PG_UNIQUE_VIOLATION || (message.includes("username") && message.includes("already"))) {
    return "That username is already taken. Try another.";
  }
  if (message.includes("username") && message.includes("invalid")) {
    return "That username isn't valid. Use lowercase letters, numbers and underscores.";
  }
  if (
    rec.name === "AuthRetryableFetchError" ||
    status === 0 ||
    message.includes("failed to fetch") ||
    message.includes("network") ||
    message.includes("load failed")
  ) {
    return `We couldn't reach TrackEfron. ${TRY_AGAIN}`;
  }
  return "Something went wrong saving your profile. Try again in a moment.";
}
