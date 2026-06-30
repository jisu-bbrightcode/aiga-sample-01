/**
 * CommunityFilterService — filter log audit + review queue (DB-integration).
 *
 * Proves the PB-COMM-FILTER-API-001 contract:
 *  - recordFilterDecision: allow→no row, block→blocked/rejected, review→hidden/pending (AC#2)
 *  - getReviewQueue: only pending hidden_for_review rows (AC#1)
 *  - reviewFilterEntry: pending→approved(published) | rejected(removed) + mod-log audit (AC#1/AC#2)
 *  - moderator-only gate + already-reviewed conflict
 */

import { ForbiddenException } from "@nestjs/common";
import {
  communityComments,
  communityFilterLogs,
  communityMemberships,
  communityModLogs,
  communityPosts,
} from "@repo/drizzle";
import { eq, inArray } from "drizzle-orm";
import { endTestDb, getDrizzleDb, hasDb } from "../../payment/__tests__/test-db";
import {
  addExtraMember,
  cleanupExtraMember,
  setupCommunityCtx,
} from "./__tests__/test-helpers";
import { CommunityFilterService } from "./community-filter.service";
import { CommunityService } from "./community.service";
import type { FilterDecision } from "./content-filter-policy";

const describeIfDb = hasDb ? describe : describe.skip;
jest.setTimeout(30_000);

const REVIEW_DECISION: FilterDecision = {
  action: "review",
  violations: [{ ruleType: "keyword", action: "review", matchedTerms: ["badword"], reason: "금지어: badword" }],
};
const BLOCK_DECISION: FilterDecision = {
  action: "block",
  violations: [{ ruleType: "link", action: "block", matchedTerms: ["https://evil.com"], reason: "허용되지 않은 링크" }],
};

describeIfDb("CommunityFilterService", () => {
  let svc: CommunityFilterService;
  let ctx: Awaited<ReturnType<typeof setupCommunityCtx>>["ctx"];
  let author: string;
  let teardown: () => Promise<void>;
  const createdPostIds: string[] = [];
  const createdCommentIds: string[] = [];

  beforeAll(() => {
    const db = getDrizzleDb();
    svc = new CommunityFilterService(db, new CommunityService(db));
  });

  beforeEach(async () => {
    const setup = await setupCommunityCtx("filter");
    ctx = setup.ctx;
    teardown = setup.teardown;
    author = await addExtraMember("filter", ctx.communityId);
    createdPostIds.length = 0;
    createdCommentIds.length = 0;
  });

  afterEach(async () => {
    if (!ctx || !teardown) return;
    const db = getDrizzleDb();
    await db.delete(communityFilterLogs).where(eq(communityFilterLogs.communityId, ctx.communityId));
    await db.delete(communityModLogs).where(eq(communityModLogs.communityId, ctx.communityId));
    if (createdCommentIds.length > 0) {
      await db.delete(communityComments).where(inArray(communityComments.id, createdCommentIds));
    }
    if (createdPostIds.length > 0) {
      await db.delete(communityPosts).where(inArray(communityPosts.id, createdPostIds));
    }
    if (author) await cleanupExtraMember(author);
    await teardown();
  });

  afterAll(async () => {
    await endTestDb();
  });

  async function insertHiddenPost(): Promise<string> {
    const db = getDrizzleDb();
    const [post] = await db
      .insert(communityPosts)
      .values({
        communityId: ctx.communityId,
        authorId: author,
        title: "filtered",
        type: "text",
        content: "has badword",
        status: "hidden",
        removalReason: "자동 필터: badword",
      })
      .returning({ id: communityPosts.id });
    createdPostIds.push(post!.id);
    return post!.id;
  }

  it("recordFilterDecision: allow → no row", async () => {
    const row = await svc.recordFilterDecision({
      communityId: ctx.communityId,
      authorId: author,
      target: null,
      decision: { action: "allow", violations: [] },
    });
    expect(row).toBeNull();
  });

  it("recordFilterDecision: block → blocked/rejected, no target", async () => {
    const row = await svc.recordFilterDecision({
      communityId: ctx.communityId,
      authorId: author,
      target: null,
      decision: BLOCK_DECISION,
    });
    expect(row?.action).toBe("blocked");
    expect(row?.reviewStatus).toBe("rejected");
    expect(row?.targetId).toBeNull();
    expect(row?.matchedTerms).toEqual(["https://evil.com"]);
  });

  it("recordFilterDecision: review → hidden_for_review/pending with target", async () => {
    const postId = await insertHiddenPost();
    const row = await svc.recordFilterDecision({
      communityId: ctx.communityId,
      authorId: author,
      target: { type: "post", id: postId },
      decision: REVIEW_DECISION,
    });
    expect(row?.action).toBe("hidden_for_review");
    expect(row?.reviewStatus).toBe("pending");
    expect(row?.targetType).toBe("post");
    expect(row?.targetId).toBe(postId);
  });

  it("getReviewQueue returns only pending hidden_for_review (moderator-gated)", async () => {
    const postId = await insertHiddenPost();
    await svc.recordFilterDecision({
      communityId: ctx.communityId,
      authorId: author,
      target: { type: "post", id: postId },
      decision: REVIEW_DECISION,
    });
    // a blocked row must NOT appear in the queue
    await svc.recordFilterDecision({
      communityId: ctx.communityId,
      authorId: author,
      target: null,
      decision: BLOCK_DECISION,
    });

    const queue = await svc.getReviewQueue(ctx.communityId, ctx.ownerId);
    expect(queue.total).toBe(1);
    expect(queue.items[0]!.targetId).toBe(postId);

    // non-member is rejected
    const outsider = await addExtraMember("filter-out", ctx.communityId);
    await getDrizzleDb()
      .delete(communityMemberships)
      .where(eq(communityMemberships.userId, outsider));
    await expect(svc.getReviewQueue(ctx.communityId, outsider)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await cleanupExtraMember(outsider);
  });

  it("reviewFilterEntry approve → post published + reviewStatus approved + mod-log", async () => {
    const postId = await insertHiddenPost();
    const log = await svc.recordFilterDecision({
      communityId: ctx.communityId,
      authorId: author,
      target: { type: "post", id: postId },
      decision: REVIEW_DECISION,
    });

    const updated = await svc.reviewFilterEntry(log!.id, ctx.ownerId, { decision: "approve" });
    expect(updated.reviewStatus).toBe("approved");
    expect(updated.reviewedBy).toBe(ctx.ownerId);

    const db = getDrizzleDb();
    const [post] = await db
      .select({ status: communityPosts.status, removalReason: communityPosts.removalReason })
      .from(communityPosts)
      .where(eq(communityPosts.id, postId));
    expect(post!.status).toBe("published");
    expect(post!.removalReason).toBeNull();

    const logs = await db
      .select()
      .from(communityModLogs)
      .where(eq(communityModLogs.communityId, ctx.communityId));
    expect(logs.length).toBeGreaterThanOrEqual(1);
  });

  it("reviewFilterEntry reject → post removed + reviewStatus rejected", async () => {
    const postId = await insertHiddenPost();
    const log = await svc.recordFilterDecision({
      communityId: ctx.communityId,
      authorId: author,
      target: { type: "post", id: postId },
      decision: REVIEW_DECISION,
    });

    const updated = await svc.reviewFilterEntry(log!.id, ctx.ownerId, {
      decision: "reject",
      note: "스팸",
    });
    expect(updated.reviewStatus).toBe("rejected");
    expect(updated.reviewNote).toBe("스팸");

    const db = getDrizzleDb();
    const [post] = await db
      .select({ status: communityPosts.status, removedBy: communityPosts.removedBy })
      .from(communityPosts)
      .where(eq(communityPosts.id, postId));
    expect(post!.status).toBe("removed");
    expect(post!.removedBy).toBe(ctx.ownerId);
  });

  it("reviewFilterEntry on already-reviewed entry → conflict", async () => {
    const postId = await insertHiddenPost();
    const log = await svc.recordFilterDecision({
      communityId: ctx.communityId,
      authorId: author,
      target: { type: "post", id: postId },
      decision: REVIEW_DECISION,
    });
    await svc.reviewFilterEntry(log!.id, ctx.ownerId, { decision: "approve" });
    await expect(
      svc.reviewFilterEntry(log!.id, ctx.ownerId, { decision: "reject" }),
    ).rejects.toThrow();
  });

  it("getFilterLogs supports reviewStatus filter + pagination", async () => {
    await svc.recordFilterDecision({
      communityId: ctx.communityId,
      authorId: author,
      target: null,
      decision: BLOCK_DECISION,
    });
    const postId = await insertHiddenPost();
    await svc.recordFilterDecision({
      communityId: ctx.communityId,
      authorId: author,
      target: { type: "post", id: postId },
      decision: REVIEW_DECISION,
    });

    const pending = await svc.getFilterLogs(ctx.communityId, ctx.ownerId, {
      reviewStatus: "pending",
    });
    expect(pending.total).toBe(1);

    const all = await svc.getFilterLogs(ctx.communityId, ctx.ownerId, { limit: 1 });
    expect(all.total).toBe(2);
    expect(all.items).toHaveLength(1);
    expect(all.hasMore).toBe(true);
  });
});
