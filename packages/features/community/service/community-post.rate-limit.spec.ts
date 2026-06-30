/**
 * CommunityPostService — rate-limit gate (DB-free unit spec).
 *
 * Proves the BBR-596 delta: post creation consults RateLimitService BEFORE
 * the keyword filter / moderation / insert, and propagates the 429 it throws.
 * Runs without DATABASE_URL (unlike the DB-integration spec).
 */

import { HttpException, HttpStatus } from "@nestjs/common";
import type { CommunityService } from "./community.service";
import type { CommunityContentModerationService } from "./community-content-moderation.service";
import type { CommunityKeywordFilterService } from "./community-keyword-filter.service";
import { CommunityPostService, POST_CREATE_RATE_LIMIT } from "./community-post.service";
import type { CommunityTierService } from "./community-tier.service";

function buildService() {
  const communityService = {
    findById: jest.fn().mockResolvedValue({ id: "community-1" }),
    isMember: jest.fn().mockResolvedValue(true),
  };
  const keywordFilterService = {
    validateContent: jest
      .fn()
      .mockResolvedValue({ passed: true, matchedWords: [], action: "allow" }),
  };
  const tierService = {
    getTierInfo: jest.fn().mockResolvedValue({ tier: "newcomer" }),
  };
  const contentModerationService = {
    assertContentAllowed: jest.fn().mockResolvedValue(undefined),
  };
  const insertReturning = jest.fn().mockResolvedValue([{ id: "post-1", authorId: "user-1" }]);
  const db = {
    insert: jest.fn(() => ({ values: jest.fn(() => ({ returning: insertReturning })) })),
    update: jest.fn(() => ({
      set: jest.fn(() => ({ where: jest.fn().mockResolvedValue(undefined) })),
    })),
  };
  const rateLimitService = { assertRateLimit: jest.fn().mockResolvedValue(undefined) };
  const filterService = {
    evaluatePostPolicy: jest.fn().mockReturnValue({ action: "allow", violations: [] }),
    recordFilterDecision: jest.fn().mockResolvedValue(null),
  };

  const svc = new CommunityPostService(
    db as never,
    communityService as unknown as CommunityService,
    keywordFilterService as unknown as CommunityKeywordFilterService,
    tierService as unknown as CommunityTierService,
    contentModerationService as unknown as CommunityContentModerationService,
    rateLimitService as never,
    filterService as never,
  );

  return { svc, communityService, keywordFilterService, contentModerationService, insertReturning, rateLimitService };
}

const POST_INPUT = {
  communityId: "community-1",
  title: "hello",
  type: "text",
  content: "body",
} as never;

describe("CommunityPostService rate-limit gate (unit)", () => {
  it("consults the rate limiter with the caller id and post-create config", async () => {
    const { svc, rateLimitService } = buildService();

    await svc.create(POST_INPUT, "user-1");

    expect(rateLimitService.assertRateLimit).toHaveBeenCalledWith("user-1", POST_CREATE_RATE_LIMIT);
  });

  it("propagates the 429 and skips filter/moderation/insert when limited", async () => {
    const ctx = buildService();
    ctx.rateLimitService.assertRateLimit.mockRejectedValue(
      new HttpException("rate limited", HttpStatus.TOO_MANY_REQUESTS),
    );

    await expect(svc429(ctx)).rejects.toBeInstanceOf(HttpException);

    expect(ctx.keywordFilterService.validateContent).not.toHaveBeenCalled();
    expect(ctx.contentModerationService.assertContentAllowed).not.toHaveBeenCalled();
    expect(ctx.insertReturning).not.toHaveBeenCalled();
  });

  it("checks the rate limit only for members (after membership passes)", async () => {
    const ctx = buildService();
    ctx.communityService.isMember.mockResolvedValue(false);

    await expect(svc429(ctx)).rejects.toMatchObject({ status: HttpStatus.FORBIDDEN });
    expect(ctx.rateLimitService.assertRateLimit).not.toHaveBeenCalled();
  });

  it("uses a stable per-action rate-limit key", () => {
    expect(POST_CREATE_RATE_LIMIT.action).toBe("community:post:create");
    expect(POST_CREATE_RATE_LIMIT.maxRequests).toBeGreaterThan(0);
    expect(POST_CREATE_RATE_LIMIT.windowSeconds).toBeGreaterThan(0);
  });
});

function svc429(ctx: ReturnType<typeof buildService>) {
  return ctx.svc.create(POST_INPUT, "user-1");
}
