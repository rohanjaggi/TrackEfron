import { describe, expect, it } from "vitest";
import { saveErrorMessage } from "./profile-errors";

const TOO_MANY = "Too many attempts. Wait a moment, then try again.";
const EXPIRED = "Your session has expired. Sign in again to save your changes.";
const EMAIL_USED = "That email is already in use.";
const EMAIL_BAD = "That email address isn't valid.";
const TAKEN = "That username is already taken. Try another.";
const BAD_USERNAME = "That username isn't valid. Use lowercase letters, numbers and underscores.";
const OFFLINE = "We couldn't reach TrackEfron. Check your connection and try again.";
const GENERIC = "Something went wrong saving your profile. Try again in a moment.";

describe("saveErrorMessage", () => {
  it("maps rate limiting", () => {
    expect(saveErrorMessage({ status: 429 })).toBe(TOO_MANY);
    expect(saveErrorMessage({ code: "over_request_rate_limit" })).toBe(TOO_MANY);
    expect(saveErrorMessage({ message: "Email Rate Limit exceeded" })).toBe(TOO_MANY);
    expect(saveErrorMessage({ message: "For security purposes, wait" })).toBe(TOO_MANY);
  });

  it("maps an expired session", () => {
    expect(saveErrorMessage({ code: "session_not_found" })).toBe(EXPIRED);
    expect(saveErrorMessage({ code: "refresh_token_not_found" })).toBe(EXPIRED);
    expect(saveErrorMessage({ name: "AuthSessionMissingError" })).toBe(EXPIRED);
    expect(saveErrorMessage({ message: "Auth session missing!" })).toBe(EXPIRED);
    expect(saveErrorMessage({ message: "JWT expired" })).toBe(EXPIRED);
  });

  it("maps email problems", () => {
    expect(saveErrorMessage({ code: "email_exists" })).toBe(EMAIL_USED);
    expect(saveErrorMessage({ code: "user_already_exists" })).toBe(EMAIL_USED);
    expect(saveErrorMessage({ message: "User already registered" })).toBe(EMAIL_USED);
    expect(saveErrorMessage({ code: "email_address_invalid" })).toBe(EMAIL_BAD);
    expect(saveErrorMessage({ message: "Invalid email" })).toBe(EMAIL_BAD);
  });

  it("maps username problems", () => {
    expect(saveErrorMessage({ code: "23505" })).toBe(TAKEN);
    expect(saveErrorMessage({ message: "username already exists" })).toBe(TAKEN);
    expect(saveErrorMessage({ message: "username is invalid" })).toBe(BAD_USERNAME);
  });

  it("maps network failures", () => {
    expect(saveErrorMessage({ name: "AuthRetryableFetchError" })).toBe(OFFLINE);
    expect(saveErrorMessage({ status: 0 })).toBe(OFFLINE);
    expect(saveErrorMessage({ message: "Failed to fetch" })).toBe(OFFLINE);
    expect(saveErrorMessage({ message: "Network request failed" })).toBe(OFFLINE);
    expect(saveErrorMessage({ message: "Load failed" })).toBe(OFFLINE);
  });

  it("falls back for anything else", () => {
    expect(saveErrorMessage({ message: "boom" })).toBe(GENERIC);
    expect(saveErrorMessage(null)).toBe(GENERIC);
    expect(saveErrorMessage("nope")).toBe(GENERIC);
  });
});
