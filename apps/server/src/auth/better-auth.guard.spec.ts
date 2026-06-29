/**
 * better-auth.guard.spec.ts — Phase-0 REST auth fix regression guard.
 *
 * BetterAuthGuard must authenticate EITHER:
 *   1. a valid 3-part JWT Bearer (legacy JwtAuthGuard path, unchanged), OR
 *   2. a Better Auth session resolvable from the request headers
 *      (cookie or opaque bearer) — the same auth.api.getSession validation
 *      tRPC createContext performs.
 *
 * better-auth is mocked at the module level (same pattern as
 * oauth-callback.controller.spec.ts) so no DB/session runtime is needed.
 */
const getSession = jest.fn();
jest.mock("@repo/core/auth/server", () => ({ auth: { api: { getSession } } }), {
  virtual: true,
});

import { UnauthorizedException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import { BetterAuthGuard } from "../../../../packages/core/nestjs/auth";

interface FakeRequest {
  headers: Record<string, string | undefined>;
  user?: { id: string; email?: string; activeOrganizationId?: string | null };
}

function contextFor(request: FakeRequest): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function makeJwt(payload: Record<string, unknown>): string {
  const part = (obj: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(obj)).toString("base64url");
  return `${part({ alg: "RS256" })}.${part(payload)}.signature`;
}

describe("BetterAuthGuard", () => {
  beforeEach(() => {
    getSession.mockReset();
  });

  it("accepts a valid 3-part JWT bearer without touching the session API", async () => {
    const guard = new BetterAuthGuard();
    const request: FakeRequest = {
      headers: {
        authorization: `Bearer ${makeJwt({
          sub: "user-1",
          email: "jwt@product-builder.app",
          exp: Math.floor(Date.now() / 1000) + 3600,
          activeOrganizationId: "org-1",
        })}`,
      },
    };

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.user).toEqual({
      id: "user-1",
      email: "jwt@product-builder.app",
      activeOrganizationId: "org-1",
    });
    expect(getSession).not.toHaveBeenCalled();
  });

  it("accepts an opaque bearer session token via auth.api.getSession", async () => {
    getSession.mockResolvedValueOnce({
      user: { id: "user-2", email: "session@product-builder.app" },
      session: { activeOrganizationId: "org-2" },
    });
    const guard = new BetterAuthGuard();
    const request: FakeRequest = {
      headers: { authorization: "Bearer abcdefghijklmnopqrstuvwxyz012345" },
    };

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.user).toEqual({
      id: "user-2",
      email: "session@product-builder.app",
      activeOrganizationId: "org-2",
    });
    expect(getSession).toHaveBeenCalledTimes(1);
  });

  it("accepts a cookie-only request via auth.api.getSession", async () => {
    getSession.mockResolvedValueOnce({
      user: { id: "user-3", email: null },
      session: {},
    });
    const guard = new BetterAuthGuard();
    const request: FakeRequest = {
      headers: { cookie: "better-auth.session_token=opaque" },
    };

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.user).toEqual({
      id: "user-3",
      email: undefined,
      activeOrganizationId: null,
    });
  });

  it("falls back to the session check when the JWT is expired (stale JWT + live cookie)", async () => {
    getSession.mockResolvedValueOnce({
      user: { id: "user-4", email: "stale-jwt@product-builder.app" },
      session: {},
    });
    const guard = new BetterAuthGuard();
    const request: FakeRequest = {
      headers: {
        authorization: `Bearer ${makeJwt({
          sub: "user-4",
          exp: Math.floor(Date.now() / 1000) - 60,
        })}`,
        cookie: "better-auth.session_token=opaque",
      },
    };

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.user?.id).toBe("user-4");
  });

  it("rejects with 401 when no credentials resolve a session", async () => {
    getSession.mockResolvedValueOnce(null);
    const guard = new BetterAuthGuard();
    const request: FakeRequest = { headers: {} };

    await expect(guard.canActivate(contextFor(request))).rejects.toThrow(UnauthorizedException);
  });

  it("rejects with 401 when both the JWT and the session are invalid", async () => {
    getSession.mockResolvedValueOnce(null);
    const guard = new BetterAuthGuard();
    const request: FakeRequest = {
      headers: { authorization: "Bearer not-a-jwt-and-not-a-session" },
    };

    await expect(guard.canActivate(contextFor(request))).rejects.toThrow(UnauthorizedException);
  });

  it("rejects with 401 when the session API itself throws (no raw error leak)", async () => {
    getSession.mockRejectedValueOnce(new Error("db down"));
    const guard = new BetterAuthGuard();
    const request: FakeRequest = { headers: { cookie: "x=y" } };

    await expect(guard.canActivate(contextFor(request))).rejects.toThrow(UnauthorizedException);
  });
});
