/**
 * CommunityCommentService.create — guard pipeline (DB-free unit spec).
 *
 * Proves the BBR-600 delta without a database:
 * - 본문 validation (빈/공백 본문 → 400) 이 가장 먼저 실행된다.
 * - 정책 게이트: 숨김/잠김/삭제 게시글에는 댓글 작성이 차단된다 (AC#2).
 * - anti-spam rate limit 이 키워드 필터/모더레이션/insert 이전에 실행된다.
 * - 통과 시 본문을 trim 하여 저장한다.
 */

import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { HttpException, HttpStatus } from "@nestjs/common";
import { COMMENT_CREATE_RATE_LIMIT, CommunityCommentService } from "./community-comment.service";
import type { CommunityContentModerationService } from "./community-content-moderation.service";
import type { CommunityKeywordFilterService } from "./community-keyword-filter.service";
import type { CommunityService } from "./community.service";
import type { CommunityTierService } from "./community-tier.service";

interface PostRow {
  id: string;
  communityId: string;
  status: string;
  isLocked: boolean;
}

const PUBLISHED_POST: PostRow = {
  id: "post-1",
  communityId: "community-1",
  status: "published",
  isLocked: false,
};

function buildService(post: PostRow | null = PUBLISHED_POST) {
  const communityService = {
    findById: jest.fn().mockResolvedValue({ id: "community-1" }),
  } as unknown as CommunityService;
  const keywordFilterService = {
    validateContent: jest
      .fn()
      .mockResolvedValue({ passed: true, matchedWords: [], action: "allow" }),
  };
  const tierService = {
    getTierInfo: jest.fn().mockResolvedValue({ tier: "newcomer" }),
    hasAcceptedRules: jest.fn().mockResolvedValue(true),
  };
  const contentModerationService = {
    assertContentAllowed: jest.fn().mockResolvedValue(undefined),
  };

  const insertReturning = jest.fn().mockResolvedValue([{ id: "comment-1", authorId: "user-1" }]);
  const insertValues = jest.fn(() => ({ returning: insertReturning }));
  const db = {
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(() => ({ limit: jest.fn().mockResolvedValue(post ? [post] : []) })),
      })),
    })),
    insert: jest.fn(() => ({ values: insertValues })),
    update: jest.fn(() => ({
      set: jest.fn(() => ({ where: jest.fn().mockResolvedValue(undefined) })),
    })),
  };
  const rateLimitService = { assertRateLimit: jest.fn().mockResolvedValue(undefined) };
  const filterService = {
    recordFilterDecision: jest.fn().mockResolvedValue(null),
  };

  const svc = new CommunityCommentService(
    db as never,
    communityService,
    keywordFilterService as unknown as CommunityKeywordFilterService,
    tierService as unknown as CommunityTierService,
    contentModerationService as unknown as CommunityContentModerationService,
    rateLimitService as never,
    filterService as never,
  );

  return {
    svc,
    db,
    keywordFilterService,
    contentModerationService,
    insertValues,
    insertReturning,
    rateLimitService,
  };
}

const input = (over: Record<string, unknown> = {}) =>
  ({ postId: "post-1", content: "hello", ...over }) as never;

describe("CommunityCommentService.create — guard pipeline (unit)", () => {
  it("rejects empty/whitespace content with 400 before touching the DB", async () => {
    const ctx = buildService();

    await expect(ctx.svc.create(input({ content: "   " }), "user-1")).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(ctx.db.select).not.toHaveBeenCalled();
    expect(ctx.insertReturning).not.toHaveBeenCalled();
  });

  it("throws NotFound for a missing post", async () => {
    const ctx = buildService(null);
    await expect(ctx.svc.create(input(), "user-1")).rejects.toBeInstanceOf(NotFoundException);
    expect(ctx.insertReturning).not.toHaveBeenCalled();
  });

  it("blocks comments on a hidden post (AC#2) and never inserts or rate-limits", async () => {
    const ctx = buildService({ ...PUBLISHED_POST, status: "hidden" });
    await expect(ctx.svc.create(input(), "user-1")).rejects.toBeInstanceOf(ForbiddenException);
    expect(ctx.rateLimitService.assertRateLimit).not.toHaveBeenCalled();
    expect(ctx.insertReturning).not.toHaveBeenCalled();
  });

  it("blocks comments on a locked post (AC#2)", async () => {
    const ctx = buildService({ ...PUBLISHED_POST, isLocked: true });
    await expect(ctx.svc.create(input(), "user-1")).rejects.toBeInstanceOf(ForbiddenException);
    expect(ctx.insertReturning).not.toHaveBeenCalled();
  });

  it("hides the existence of a deleted post (404, AC#2)", async () => {
    const ctx = buildService({ ...PUBLISHED_POST, status: "deleted" });
    await expect(ctx.svc.create(input(), "user-1")).rejects.toBeInstanceOf(NotFoundException);
    expect(ctx.insertReturning).not.toHaveBeenCalled();
  });

  it("propagates the 429 and skips filter/moderation/insert when rate-limited", async () => {
    const ctx = buildService();
    ctx.rateLimitService.assertRateLimit.mockRejectedValue(
      new HttpException("rate limited", HttpStatus.TOO_MANY_REQUESTS),
    );

    await expect(ctx.svc.create(input(), "user-1")).rejects.toBeInstanceOf(HttpException);
    expect(ctx.keywordFilterService.validateContent).not.toHaveBeenCalled();
    expect(ctx.contentModerationService.assertContentAllowed).not.toHaveBeenCalled();
    expect(ctx.insertReturning).not.toHaveBeenCalled();
  });

  it("rate-limits with the caller id + comment-create config, then trims and stores the body", async () => {
    const ctx = buildService();

    await ctx.svc.create(input({ content: "  hi there  " }), "user-1");

    expect(ctx.rateLimitService.assertRateLimit).toHaveBeenCalledWith(
      "user-1",
      COMMENT_CREATE_RATE_LIMIT,
    );
    expect(ctx.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ content: "hi there", authorId: "user-1" }),
    );
  });

  it("uses a stable per-action rate-limit key", () => {
    expect(COMMENT_CREATE_RATE_LIMIT.action).toBe("community:comment:create");
    expect(COMMENT_CREATE_RATE_LIMIT.maxRequests).toBeGreaterThan(0);
    expect(COMMENT_CREATE_RATE_LIMIT.windowSeconds).toBeGreaterThan(0);
  });
});
