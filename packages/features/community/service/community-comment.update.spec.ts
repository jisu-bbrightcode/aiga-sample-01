/**
 * CommunityCommentService.update — author/moderator edit + audit (DB-free unit spec).
 *
 * Proves the BBR-601 delta without a database:
 * - 본문 validation (빈/공백/초과 → 400) 이 가장 먼저 실행된다.
 * - 삭제/제거(tombstone) 댓글은 수정할 수 없다 (409).
 * - AC#1: 작성자/모더레이터 수정 권한 분리, 둘 다 아니면 403.
 * - AC#2: 모든 수정은 last_edited_by 를 기록하고, 모더레이터 수정만
 *   community_mod_logs(action=other, kind=edit_comment, before/after)에 감사 기록된다.
 */

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import type { CommunityService } from "./community.service";
import { CommunityCommentService } from "./community-comment.service";
import type { CommunityContentModerationService } from "./community-content-moderation.service";
import type { CommunityKeywordFilterService } from "./community-keyword-filter.service";
import type { CommunityTierService } from "./community-tier.service";

interface CommentRow {
  id: string;
  postId: string;
  authorId: string;
  content: string;
  isDeleted: boolean;
  isRemoved: boolean;
}

const COMMENT: CommentRow = {
  id: "comment-1",
  postId: "post-1",
  authorId: "author-1",
  content: "original body",
  isDeleted: false,
  isRemoved: false,
};

const POST = { communityId: "community-1" };

function buildService(
  opts: {
    comment?: CommentRow | null;
    post?: { communityId: string } | null;
    isModerator?: boolean;
  } = {},
) {
  const comment = opts.comment === undefined ? COMMENT : opts.comment;
  const post = opts.post === undefined ? POST : opts.post;

  // select() 호출 순서대로 결과를 반환: 1) findById → comment, 2) post communityId.
  const selectQueue: unknown[][] = [];
  if (comment !== undefined) selectQueue.push(comment ? [comment] : []);
  selectQueue.push(post ? [post] : []);

  const setSpy = jest.fn(() => ({ where: jest.fn(() => ({ returning: updateReturning })) }));
  const updateReturning = jest.fn().mockResolvedValue([{ ...(comment ?? {}), content: "updated" }]);
  const insertValues = jest.fn().mockResolvedValue(undefined);

  const db = {
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(() => ({
          limit: jest.fn().mockResolvedValue(selectQueue.length ? selectQueue.shift() : []),
        })),
      })),
    })),
    update: jest.fn(() => ({ set: setSpy })),
    insert: jest.fn(() => ({ values: insertValues })),
  };

  const communityService = {
    isModerator: jest.fn().mockResolvedValue(opts.isModerator ?? false),
  };
  const keywordFilterService = {
    validateContent: jest
      .fn()
      .mockResolvedValue({ passed: true, matchedWords: [], action: "allow" }),
  };
  const tierService = { getTierInfo: jest.fn().mockResolvedValue({ tier: "newcomer" }) };
  const contentModerationService = {
    assertContentAllowed: jest.fn().mockResolvedValue(undefined),
  };
  const rateLimitService = { assertRateLimit: jest.fn().mockResolvedValue(undefined) };

  const svc = new CommunityCommentService(
    db as never,
    communityService as unknown as CommunityService,
    keywordFilterService as unknown as CommunityKeywordFilterService,
    tierService as unknown as CommunityTierService,
    contentModerationService as unknown as CommunityContentModerationService,
    rateLimitService as never,
  );

  return { svc, db, communityService, setSpy, updateReturning, insertValues };
}

describe("CommunityCommentService.update — edit + audit (unit)", () => {
  it("rejects empty/whitespace content with 400 before touching the DB", async () => {
    const ctx = buildService();
    await expect(ctx.svc.update("comment-1", "   ", "author-1")).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(ctx.db.select).not.toHaveBeenCalled();
    expect(ctx.updateReturning).not.toHaveBeenCalled();
  });

  it("rejects over-long content with 400", async () => {
    const ctx = buildService();
    await expect(ctx.svc.update("comment-1", "x".repeat(10001), "author-1")).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(ctx.updateReturning).not.toHaveBeenCalled();
  });

  it("throws NotFound for a missing comment", async () => {
    const ctx = buildService({ comment: null });
    await expect(ctx.svc.update("comment-1", "hi", "author-1")).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(ctx.updateReturning).not.toHaveBeenCalled();
  });

  it("blocks editing a deleted comment (409)", async () => {
    const ctx = buildService({ comment: { ...COMMENT, isDeleted: true } });
    await expect(ctx.svc.update("comment-1", "hi", "author-1")).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(ctx.updateReturning).not.toHaveBeenCalled();
  });

  it("blocks editing a removed comment (409)", async () => {
    const ctx = buildService({ comment: { ...COMMENT, isRemoved: true } });
    await expect(ctx.svc.update("comment-1", "hi", "author-1")).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(ctx.updateReturning).not.toHaveBeenCalled();
  });

  it("forbids a non-author, non-moderator editor (403, AC#1)", async () => {
    const ctx = buildService({ isModerator: false });
    await expect(ctx.svc.update("comment-1", "hi", "stranger")).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(ctx.updateReturning).not.toHaveBeenCalled();
    expect(ctx.insertValues).not.toHaveBeenCalled();
  });

  it("lets the author edit, records last_edited_by, and writes NO mod log (AC#1/AC#2)", async () => {
    const ctx = buildService();
    await ctx.svc.update("comment-1", "  new body  ", "author-1");

    expect(ctx.setSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "new body",
        isEdited: true,
        lastEditedBy: "author-1",
      }),
    );
    expect(ctx.updateReturning).toHaveBeenCalled();
    expect(ctx.insertValues).not.toHaveBeenCalled();
  });

  it("lets a moderator edit and appends an edit_comment audit log (AC#1/AC#2)", async () => {
    const ctx = buildService({ isModerator: true });
    await ctx.svc.update("comment-1", "moderated body", "mod-1");

    expect(ctx.setSpy).toHaveBeenCalledWith(
      expect.objectContaining({ lastEditedBy: "mod-1", isEdited: true }),
    );
    expect(ctx.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        communityId: "community-1",
        moderatorId: "mod-1",
        action: "other",
        targetType: "comment",
        targetId: "comment-1",
        details: expect.objectContaining({
          kind: "edit_comment",
          before: "original body",
          after: "moderated body",
        }),
      }),
    );
  });
});
