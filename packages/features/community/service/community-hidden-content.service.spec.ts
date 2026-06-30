/**
 * CommunityHiddenContentService — per-viewer content hide + admin global hide.
 *
 * DB-gated (skips without DATABASE_URL). Covers AC#1 (user vs global hide are
 * distinct storage/permission paths) and AC#2 inputs (hidden id lists +
 * reaction guard that downstream list/detail/reaction paths consume).
 */

import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
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

  // ── 숨김 해제 (DELETE /hidden-content/:id) — BBR-618 ──────────────────────

  it("unhideByIdForUser() removes the row by id and restores exposure (AC#1)", async () => {
    const row = await svc.hideForUser(viewer, {
      targetType: "post",
      targetId: postId,
      scope: "user",
    });
    await expect(svc.getHiddenPostIds(viewer)).resolves.toEqual([postId]);

    const restored = await svc.unhideByIdForUser(viewer, row.id);
    expect(restored).toEqual({ targetType: "post", targetId: postId });
    // 노출이 일관되게 복구된다 — 목록 제외 집합에서 사라진다.
    await expect(svc.getHiddenPostIds(viewer)).resolves.toEqual([]);
    await expect(svc.isHidden(viewer, "post", postId)).resolves.toBe(false);
  });

  it("unhideByIdForUser() throws NotFound for another user's record (AC#2 owner scope)", async () => {
    const row = await svc.hideForUser(viewer, {
      targetType: "post",
      targetId: postId,
      scope: "user",
    });
    // 타인(outsider)은 viewer 의 숨김 레코드를 해제할 수 없다.
    await expect(svc.unhideByIdForUser(outsider, row.id)).rejects.toThrow(NotFoundException);
    // viewer 시야에서는 여전히 숨김 상태로 유지된다.
    await expect(svc.isHidden(viewer, "post", postId)).resolves.toBe(true);
  });

  it("unhideByIdForUser() throws NotFound for a missing record", async () => {
    await expect(
      svc.unhideByIdForUser(viewer, "00000000-0000-0000-0000-000000000000"),
    ).rejects.toThrow(NotFoundException);
  });

  it("global hide leaves no user hidden-content row → user API cannot undo it (AC#2)", async () => {
    await svc.hideGlobally(ctx.ownerId, { targetType: "post", targetId: postId, scope: "global" });
    // 전역 숨김은 community_hidden_content 가 아니라 posts 에 저장된다.
    await expect(svc.listForUser(viewer)).resolves.toHaveLength(0);
    // 사용자 경로에는 해제할 레코드(id)가 존재하지 않는다.
    const [post] = await getDrizzleDb()
      .select({ status: communityPosts.status })
      .from(communityPosts)
      .where(eq(communityPosts.id, postId));
    expect(post?.status).toBe("hidden");
  });

  // ── 전역 숨김 복구 (POST /hidden-content/restore) — BBR-618 ───────────────

  it("restoreGlobally() (AC#1) restores post status + writes a mod log (owner)", async () => {
    await svc.hideGlobally(ctx.ownerId, {
      targetType: "post",
      targetId: postId,
      scope: "global",
      reason: "정책 위반",
    });

    const result = await svc.restoreGlobally(ctx.ownerId, { targetType: "post", targetId: postId });
    expect(result).toEqual({ targetType: "post", targetId: postId, scope: "global" });

    const [post] = await getDrizzleDb()
      .select({ status: communityPosts.status, reason: communityPosts.removalReason })
      .from(communityPosts)
      .where(eq(communityPosts.id, postId));
    expect(post?.status).toBe("published");
    expect(post?.reason).toBeNull();

    const logs = await getDrizzleDb()
      .select({ reason: communityModLogs.reason })
      .from(communityModLogs)
      .where(eq(communityModLogs.communityId, ctx.communityId));
    expect(logs.some((l) => l.reason?.startsWith("전역 숨김 해제"))).toBe(true);
  });

  it("restoreGlobally() restores comment is_hidden=false (owner)", async () => {
    await svc.hideGlobally(ctx.ownerId, { targetType: "comment", targetId: commentId, scope: "global" });
    await svc.restoreGlobally(ctx.ownerId, { targetType: "comment", targetId: commentId });

    const [comment] = await getDrizzleDb()
      .select({ isHidden: communityComments.isHidden })
      .from(communityComments)
      .where(eq(communityComments.id, commentId));
    expect(comment?.isHidden).toBe(false);
  });

  it("restoreGlobally() throws Forbidden for a non-moderator member (AC#2 permission split)", async () => {
    await svc.hideGlobally(ctx.ownerId, { targetType: "post", targetId: postId, scope: "global" });
    await expect(
      svc.restoreGlobally(viewer, { targetType: "post", targetId: postId }),
    ).rejects.toThrow(ForbiddenException);
  });

  it("restoreGlobally() throws Conflict when target is not globally hidden", async () => {
    await expect(
      svc.restoreGlobally(ctx.ownerId, { targetType: "post", targetId: postId }),
    ).rejects.toThrow(ConflictException);
  });
});
