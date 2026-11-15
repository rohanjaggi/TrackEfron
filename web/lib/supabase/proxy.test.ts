import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const getClaims = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getClaims } }),
}));
vi.mock("../utils", () => ({ hasEnvVars: true }));

import { updateSession } from "./proxy";

function request(path: string) {
  return new NextRequest(new URL(path, "http://localhost:3000"));
}

describe("updateSession, signed out", () => {
  beforeEach(() => {
    getClaims.mockResolvedValue({ data: null });
  });

  test("an /api path gets a JSON 401", async () => {
    for (const path of ["/api?action=trending", "/api/ai/recommend", "/api/spotify/me?action=top-tracks"]) {
      const res = await updateSession(request(path));
      expect(res.status, path).toBe(401);
      expect(await res.json()).toEqual({ error: "Unauthorized" });
    }
  });

  test("the Spotify connect and callback navigations still redirect to login", async () => {
    for (const path of ["/api/spotify/connect", "/api/spotify/callback?code=x"]) {
      const res = await updateSession(request(path));
      expect(res.status, path).toBe(307);
      expect(new URL(res.headers.get("location")!).pathname).toBe("/auth/login");
    }
  });

  test("only exact /api paths get the 401, and only the exact Spotify paths are exempt", async () => {
    const lookalike = await updateSession(request("/apifoo"));
    expect(lookalike.status).toBe(307);
    const connectx = await updateSession(request("/api/spotify/connectx"));
    expect(connectx.status).toBe(401);
  });

  test("a page path still redirects to login", async () => {
    const res = await updateSession(request("/protected/discover"));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/auth/login");
  });

  test("/ and /auth paths stay public", async () => {
    for (const path of ["/", "/auth/login", "/auth/sign-up"]) {
      const res = await updateSession(request(path));
      expect(res.status, path).toBe(200);
    }
  });

  test("a /login path is no longer treated as public", async () => {
    const res = await updateSession(request("/login"));
    expect(res.status).toBe(307);
  });
});

describe("updateSession, signed in", () => {
  test("an /api path passes through", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } } });
    const res = await updateSession(request("/api?action=trending"));
    expect(res.status).toBe(200);
  });
});

describe("updateSession, the /dev catalogue", () => {
  beforeEach(() => {
    getClaims.mockResolvedValue({ data: null });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("/dev/kit is public outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const res = await updateSession(request("/dev/kit"));
    expect(res.status).toBe(200);
  });

  test("/dev/kit redirects to login in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const res = await updateSession(request("/dev/kit"));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/auth/login");
  });
});
