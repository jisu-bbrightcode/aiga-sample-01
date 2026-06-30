/**
 * CommunityHiddenContentService — per-viewer content hide + admin global hide.
 *
 * DB-gated (skips without DATABASE_URL). Covers AC#1 (user vs global hide are
 * distinct storage/permission paths) and AC#2 inputs (hidden id lists +
 * reaction guard that downstream list/detail/reaction paths consume).
 */

import { ForbiddenException, NotFoundException } from "@nestjs/common";
import {
  communityComments,
  communityHiddenContent,
  communityModLogs,
  communityPosts,
} from "@repo/drizzle";
import { eq } from "drizzle-orm";
import { endTestDb, getDrizzleDb, hasDb } from "../../payment/__tests__/test-db";
import { addExtraMember, cleanupExtraMember, setupCommunityCtx } from "./__tests__/test-helpers";
import { CommunityService } from "./community.service";
import { CommunityHiddenContentService } from "./community-hidden-content.service";

const describeIfDb = hasDb ? describe : describe.skip;
jest.setTimeout(30_000);

describeIfDb("CommunityHiddenContentService", () => {
  let svc: CommunityHiddenContentService;
  let ctx: Awaited<ReturnType<typeof setupCommunityCtx>>["ctx"];
  let viewer: string;
  let outsider: string;
  let postId: string;
  let commentId: string;
  let teardown: () => Promise<void>;

  beforeAll(() => {
    const db = getDrizzleDb();
    svc = new CommunityHiddenContentService(db, new CommunityService(db));
  });

  beforeEach(async () => {
    const setup = await setupCommunityCtx("hide");
    ctx = setup.ctx;
    teardown = setup.teardown;
    viewer = await addExtraMember("hide", ctx.communityId);
    outsider = await addExtraMember("hide-out", ctx.communityId);

    const db = getDrizzleDb();
    const [post] = await db
      .insert(communityPosts)
      .values({ communityId: ctx.communityId, authorId: ctx.ownerId, title: "hide target" })
      .returning({ id: communityPosts.id });
    postId = post!.id;

    const [comment] = await db
      .insert(communityComments)
      .values({ postId, authorId: ctx.ownerId, content: "c" })
      .returning({ id: communityComments.id });
    commentId = comment!.id;
  });

  afterEach(async () => {
    const db = getDrizzleDb();
    await db.delete(communityHiddenContent).where(eq(communityHiddenContent.userId, viewer));
    await db.delete(communityModLogs).where(eq(communityModLogs.communityId, ctx.communityId));
    await db.delete(communityComments).where(eq(communityComments.id, commentId));
    await db.delete(communityPosts).where(eq(communityPosts.id, postId));
    await cleanupExtraMember(viewer);
    await cleanupExtraMember(outsider);
    await teardown();
  });

  afterAll(async () => {
    await endTestDb();
  });

  it("hideForUser() persists a per-viewer hide row with reason", async () => {
    const row = await svc.hideForUser(viewer, {
      targetType: "post",
      targetId: postId,
      scope: "user",
      reason: "관심 없음",
    });
    expect(row.userId).toBe(viewer);
    expect(row.targetType).toBe("post");
    expect(row.reason).toBe("관심 없음");
  });

  it("hideForUser() is idempotent (returns existing row, no duplicate)", async () => {
    const first = await svc.hideForUser(viewer, {
      targetType: "post",
      targetId: postId,
      scope: "user",
    });
    const second = await svc.hideForUser(viewer, {
      targetType: "post",
      targetId: postId,
      scope: "user",
    });
    expect(second.id).toBe(first.id);
    const rows = await svc.listForUser(viewer);
    expect(rows).toHaveLength(1);
  });

  it("hideForUser() throws NotFound for a missing target", async () => {
    await expect(
      svc.hideForUser(viewer, {
        targetType: "post",
        targetId: "00000000-0000-0000-0000-000000000000",
        scope: "user",
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it("getHiddenPostIds / getHiddenCommentIds reflect hidden rows", async () => {
    await svc.hideForUser(viewer, { targetType: "post", targetId: postId, scope: "user" });
    await svc.hideForUser(viewer, { targetType: "comment", targetId: commentId, scope: "user" });
    await expect(svc.getHiddenPostIds(viewer)).resolves.toEqual([postId]);
    await expect(svc.getHiddenCommentIds(viewer)).resolves.toEqual([commentId]);
  });

  it("assertReactable() throws Forbidden on a self-hidden target (AC#2 reaction policy)", async () => {
    await svc.hideForUser(viewer, { targetType: "post", targetId: postId, scope: "user" });
    await expect(svc.assertReactable(viewer, "post", postId)).rejects.toThrow(ForbiddenException);
    // not hidden → allowed
    await expect(svc.assertReactable(viewer, "comment", commentId)).resolves.toBeUndefined();
  });

  it("unhideForUser() removes the row; throws NotFound when none", async () => {
    await expect(svc.unhideForUser(viewer, "post", postId)).rejects.toThrow(NotFoundException);
    await svc.hideForUser(viewer, { targetType: "post", targetId: postId, scope: "user" });
    await svc.unhideForUser(viewer, "post", postId);
    await expect(svc.isHidden(viewer, "post", postId)).resolves.toBe(false);
  });

  it("hideGlobally() (AC#1) sets post status='hidden' + writes a mod log (owner)", async () => {
    await svc.hideGlobally(ctx.ownerId, {
      targetType: "post",
      targetId: postId,
      scope: "global",
      reason: "정책 위반",
    });
    const [post] = await getDrizzleDb()
      .select({ status: communityPosts.status, reason: communityPosts.removalReason })
      .from(communityPosts)
      .where(eq(communityPosts.id, postId));
    expect(post?.status).toBe("hidden");
    expect(post?.reason).toBe("정책 위반");

    const logs = await getDrizzleDb()
      .select({ action: communityModLogs.action })
      .from(communityModLogs)
      .where(eq(communityModLogs.communityId, ctx.communityId));
    expect(logs.length).toBeGreaterThan(0);
  });

  it("hideGlobally() (AC#1) sets comment is_hidden=true (owner)", async () => {
    await svc.hideGlobally(ctx.ownerId, {
      targetType: "comment",
      targetId: commentId,
      scope: "global",
    });
    const [comment] = await getDrizzleDb()
      .select({ isHidden: communityComments.isHidden })
      .from(communityComments)
      .where(eq(communityComments.id, commentId));
    expect(comment?.isHidden).toBe(true);
  });

  it("hideGlobally() throws Forbidden for a non-moderator member (AC#1 permission split)", async () => {
    await expect(
      svc.hideGlobally(viewer, { targetType: "post", targetId: postId, scope: "global" }),
    ).rejects.toThrow(ForbiddenException);
  });
});
