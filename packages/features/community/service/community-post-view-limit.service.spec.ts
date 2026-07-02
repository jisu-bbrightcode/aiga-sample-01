import { HttpException } from "@nestjs/common";
import type { RateLimitConfig, RateLimitResult, RateLimitService } from "@repo/core/rate-limit";
import { CommunityPostViewLimitService } from "./community-post-view-limit.service";

/**
 * 순수 로직 단위 테스트 — DB 불필요. RateLimitService 를 목으로 주입해
 * 등급 판정 + 제한 위임/우회 동작을 검증한다.
 */

type CheckCall = { identifier: string; config: RateLimitConfig };

function makeService(nextResult: RateLimitResult = { allowed: true, remaining: 1 }) {
  const calls: CheckCall[] = [];
  const rateLimit = {
    check: jest.fn((identifier: string, config: RateLimitConfig) => {
      calls.push({ identifier, config });
      return Promise.resolve(nextResult);
    }),
  } as unknown as RateLimitService;
  const service = new CommunityPostViewLimitService(rateLimit);
  return { service, rateLimit, calls };
}

const ENV_KEYS = [
  "COMMUNITY_POST_VIEW_GUEST_DAILY_LIMIT",
  "COMMUNITY_POST_VIEW_GENERAL_DAILY_LIMIT",
  "COMMUNITY_POST_VIEW_VERIFIED_ROLES",
  "COMMUNITY_POST_VIEW_AUTHENTICATED_UNLIMITED",
];

describe("CommunityPostViewLimitService", () => {
  const original: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      original[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
    jest.clearAllMocks();
  });

  describe("resolveGrade", () => {
    it("returns guest when there is no user", () => {
      const { service } = makeService();
      expect(service.resolveGrade(null)).toBe("guest");
      expect(service.resolveGrade(undefined)).toBe("guest");
      expect(service.resolveGrade({ id: "" })).toBe("guest");
    });

    it("returns general for an authenticated user without a verified role", () => {
      const { service } = makeService();
      expect(service.resolveGrade({ id: "u1" })).toBe("general");
      expect(service.resolveGrade({ id: "u1", role: "user" })).toBe("general");
    });

    it("returns verified when role matches a configured verified role (default set)", () => {
      const { service } = makeService();
      expect(service.resolveGrade({ id: "u1", role: "admin" })).toBe("verified");
      expect(service.resolveGrade({ id: "u1", roleIds: ["moderator"] })).toBe("verified");
    });

    it("honors COMMUNITY_POST_VIEW_VERIFIED_ROLES override (case-insensitive)", () => {
      process.env.COMMUNITY_POST_VIEW_VERIFIED_ROLES = "gold, platinum";
      const { service } = makeService();
      expect(service.resolveGrade({ id: "u1", role: "admin" })).toBe("general");
      expect(service.resolveGrade({ id: "u1", role: "GOLD" })).toBe("verified");
    });

    it("treats any authenticated user as verified when AUTHENTICATED_UNLIMITED=true", () => {
      process.env.COMMUNITY_POST_VIEW_AUTHENTICATED_UNLIMITED = "true";
      const { service } = makeService();
      expect(service.resolveGrade({ id: "u1", role: "user" })).toBe("verified");
      expect(service.resolveGrade(null)).toBe("guest");
    });
  });

  describe("assertCanView", () => {
    it("bypasses the limiter for verified members (unlimited)", async () => {
      const { service, rateLimit } = makeService();
      const grade = await service.assertCanView({ user: { id: "u1", role: "admin" } });
      expect(grade).toBe("verified");
      expect(rateLimit.check).not.toHaveBeenCalled();
    });

    it("checks the guest bucket keyed by client IP with the guest limit", async () => {
      process.env.COMMUNITY_POST_VIEW_GUEST_DAILY_LIMIT = "3";
      const { service, calls } = makeService();
      const grade = await service.assertCanView({ clientIp: "1.2.3.4" });
      expect(grade).toBe("guest");
      expect(calls).toHaveLength(1);
      expect(calls[0]?.identifier).toBe("guest:1.2.3.4");
      expect(calls[0]?.config).toMatchObject({
        action: "community:post-view",
        maxRequests: 3,
        windowSeconds: 86_400,
      });
    });

    it("falls back to an 'unknown' guest bucket when no IP is provided", async () => {
      const { service, calls } = makeService();
      await service.assertCanView({});
      expect(calls[0]?.identifier).toBe("guest:unknown");
    });

    it("checks the user bucket with the general limit for plain members", async () => {
      process.env.COMMUNITY_POST_VIEW_GENERAL_DAILY_LIMIT = "10";
      const { service, calls } = makeService();
      const grade = await service.assertCanView({ user: { id: "u42" } });
      expect(grade).toBe("general");
      expect(calls[0]?.identifier).toBe("user:u42");
      expect(calls[0]?.config.maxRequests).toBe(10);
    });

    it("throws a 429 HttpException with a domain error code when the limit is exceeded", async () => {
      const { service } = makeService({ allowed: false, remaining: 0, retryAfterSeconds: 120 });
      await expect(service.assertCanView({ user: { id: "u1" } })).rejects.toBeInstanceOf(
        HttpException,
      );
      try {
        await service.assertCanView({ user: { id: "u1" } });
      } catch (err) {
        const response = (err as HttpException).getResponse() as Record<string, unknown>;
        expect((err as HttpException).getStatus()).toBe(429);
        expect(response.errorCode).toBe("POST_VIEW_DAILY_LIMIT_EXCEEDED");
        expect(response.grade).toBe("general");
        expect(response.retryAfter).toBe(120);
      }
    });
  });
});
