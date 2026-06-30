/**
 * CommunityReactionService — DB-free unit tests (BBR-611).
 *
 * 폴리모픽 ReactionService 와 노출 정책을 mock db(FIFO select 큐)로 검증한다.
 *   AC#1 게시글/댓글 모두 count + 내 상태 조회
 *   AC#2 숨김/삭제 대상은 404 (리액션 표면 비노출)
 */
import { NotFoundException } from "@nestjs/common";
import type { DrizzleDB } from "@repo/drizzle";
import { REACTION_TYPES } from "../../common/types";
import { CommunityReactionService } from "./community-reaction.service";

/** select(...).from(...).where(...).limit(n) → 큐에서 다음 행 배열을 반환. */
function makeDb(queue: unknown[][]): { db: DrizzleDB; selectCalls: () => number } {
  let i = 0;
  const chain = {
    from: () => chain,
    where: () => chain,
    limit: () => Promise.resolve(queue[i++] ?? []),
  };
  return {
    db: { select: () => chain } as unknown as DrizzleDB,
    selectCalls: () => i,
  };
}

function makeReactionService() {
  return {
    getReactionCounts: jest.fn().mockResolvedValue({
      total: 3,
      byType: [
        { type: "like", count: 2 },
        { type: "love", count: 1 },
      ],
    }),
    getUserReactionStatus: jest.fn().mockResolvedValue({
      hasReacted: true,
      types: ["like"],
    }),
  };
}

type ReactionServiceMock = ReturnType<typeof makeReactionService>;

function makeService(queue: unknown[][], reaction: ReactionServiceMock) {
  const { db } = makeDb(queue);
  return new CommunityReactionService(db, reaction as never);
}

const POST_ROW = (status: string) => [{ status }];
const NON_PUBLISHED_STATUSES = ["draft", "hidden", "removed", "deleted"];
const TOMBSTONE_FLAGS = [{ isDeleted: true }, { isRemoved: true }, { isHidden: true }];
const COMMENT_ROW = (over: Record<string, unknown> = {}) => [
  { postId: "post-1", isDeleted: false, isRemoved: false, isHidden: false, ...over },
];

describe("CommunityReactionService (BBR-611)", () => {
  describe("getSupportedTypes", () => {
    it("returns the canonical reaction type list", () => {
      const svc = makeService([], makeReactionService());
      expect(svc.getSupportedTypes()).toEqual(REACTION_TYPES);
      expect(svc.getSupportedTypes()).toHaveLength(6);
    });
  });

  describe("getPostReactionSummary", () => {
    it("returns summary + supported types for a published post (anon → viewer null)", async () => {
      const reaction = makeReactionService();
      const svc = makeService([POST_ROW("published")], reaction);

      const result = await svc.getPostReactionSummary("post-1");

      expect(result.targetType).toBe("community_post");
      expect(result.targetId).toBe("post-1");
      expect(result.summary.total).toBe(3);
      expect(result.viewer).toBeNull();
      expect(result.supportedTypes).toEqual(REACTION_TYPES);
      expect(reaction.getReactionCounts).toHaveBeenCalledWith("community_post", "post-1");
      expect(reaction.getUserReactionStatus).not.toHaveBeenCalled();
    });

    it("includes viewer reaction state when authenticated (AC#1)", async () => {
      const reaction = makeReactionService();
      const svc = makeService([POST_ROW("published")], reaction);

      const result = await svc.getPostReactionSummary("post-1", "user-9");

      expect(result.viewer).toEqual({ hasReacted: true, types: ["like"] });
      expect(reaction.getUserReactionStatus).toHaveBeenCalledWith(
        "community_post",
        "post-1",
        "user-9",
      );
    });

    it.each(
      NON_PUBLISHED_STATUSES,
    )("throws 404 for %s posts without exposing reactions (AC#2)", async (status) => {
      const reaction = makeReactionService();
      const svc = makeService([POST_ROW(status)], reaction);

      await expect(svc.getPostReactionSummary("post-1")).rejects.toBeInstanceOf(NotFoundException);
      expect(reaction.getReactionCounts).not.toHaveBeenCalled();
    });

    it("throws 404 when the post does not exist", async () => {
      const reaction = makeReactionService();
      const svc = makeService([[]], reaction);

      await expect(svc.getPostReactionSummary("missing")).rejects.toBeInstanceOf(NotFoundException);
      expect(reaction.getReactionCounts).not.toHaveBeenCalled();
    });
  });

  describe("getCommentReactionSummary", () => {
    it("returns summary for a live comment under a published post (AC#1)", async () => {
      const reaction = makeReactionService();
      const svc = makeService([COMMENT_ROW(), POST_ROW("published")], reaction);

      const result = await svc.getCommentReactionSummary("comment-1", "user-9");

      expect(result.targetType).toBe("community_comment");
      expect(result.targetId).toBe("comment-1");
      expect(result.summary.total).toBe(3);
      expect(result.viewer).toEqual({ hasReacted: true, types: ["like"] });
      expect(reaction.getReactionCounts).toHaveBeenCalledWith("community_comment", "comment-1");
    });

    it.each(TOMBSTONE_FLAGS)("throws 404 for tombstoned comment %o (AC#2)", async (flags) => {
      const reaction = makeReactionService();
      const svc = makeService([COMMENT_ROW(flags), POST_ROW("published")], reaction);

      await expect(svc.getCommentReactionSummary("comment-1")).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(reaction.getReactionCounts).not.toHaveBeenCalled();
    });

    it("throws 404 when the parent post is not published (AC#2)", async () => {
      const reaction = makeReactionService();
      const svc = makeService([COMMENT_ROW(), POST_ROW("removed")], reaction);

      await expect(svc.getCommentReactionSummary("comment-1")).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(reaction.getReactionCounts).not.toHaveBeenCalled();
    });

    it("throws 404 when the comment does not exist", async () => {
      const reaction = makeReactionService();
      const svc = makeService([[]], reaction);

      await expect(svc.getCommentReactionSummary("missing")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
