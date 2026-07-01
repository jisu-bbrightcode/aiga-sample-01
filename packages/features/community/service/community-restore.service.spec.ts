/**
 * CommunityModerationService.restoreContent — admin content restore (BBR-1095).
 *
 * DB-gated. Verifies the server-authoritative restore contract:
 *  - restores hidden/removed posts (content preserved) → published + audit log
 *  - restores keyword-hidden comments (content intact)  → visible + audit log
 *  - rejects removed comments whose original content was destroyed (409)
 *  - rejects author-deleted / already-visible comments (409)
 *  - 404 on missing targets
 */

import { eq } from "drizzle-orm";
import { communityComments, communityModLogs, communityPosts } from "@repo/drizzle";
import { endTestDb, getDrizzleDb, hasDb } from "../../payment/__tests__/test-db";
import { setupCommunityCtx } from "./__tests__/test-helpers";
import { REMOVED_COMMENT_SENTINEL } from "./content-restore-policy";
import { CommunityService } from "./community.service";
import { CommunityModerationService } from "./community-moderation.service";

const describeIfDb = hasDb ? describe : describe.skip;
jest.setTimeout(30_000);

describeIfDb("CommunityModerationService.restoreContent", () => {
  let svc: CommunityModerationService;
  let ctx: Awaited<ReturnType<typeof setupCommunityCtx>>["ctx"];
  let teardown: () => Promise<void>;

  beforeAll(() => {
    const db = getDrizzleDb();
    svc = new CommunityModerationService(db, new CommunityService(db));
  });

  beforeEach(async () => {
    const setup = await setupCommunityCtx("restore");
    ctx = setup.ctx;
    teardown = setup.teardown;
  });

  afterEach(async () => {
    const db = getDrizzleDb();
    const posts = await db
      .select({ id: communityPosts.id })
      .from(communityPosts)
      .where(eq(communityPosts.communityId, ctx.communityId));
    for (const p of posts) {
      await db.delete(communityComments).where(eq(communityComments.postId, p.id));
    }
    await db.delete(communityModLogs).where(eq(communityModLogs.communityId, ctx.communityId));
    await db.delete(communityPosts).where(eq(communityPosts.communityId, ctx.communityId));
    await teardown();
  });

  afterAll(async () => {
    await endTestDb();
  });

  async function createPost(status: "published" | "hidden" | "removed" | "deleted") {
    const [post] = await getDrizzleDb()
      .insert(communityPosts)
      .values({
        communityId: ctx.communityId,
        authorId: ctx.ownerId,
        title: "restore target",
        content: "본문",
        status,
        ...(status === "removed" || status === "hidden"
          ? { removalReason: "policy", removedBy: ctx.ownerId }
          : {}),
      })
      .returning({ id: communityPosts.id });
    return post!.id;
  }

  async function createComment(overrides: {
    content: string;
    isRemoved?: boolean;
    isDeleted?: boolean;
    isHidden?: boolean;
  }) {
    const postId = await createPost("published");
    const [comment] = await getDrizzleDb()
      .insert(communityComments)
      .values({
        postId,
        authorId: ctx.ownerId,
        content: overrides.content,
        isRemoved: overrides.isRemoved ?? false,
        isDeleted: overrides.isDeleted ?? false,
        isHidden: overrides.isHidden ?? false,
        ...(overrides.isRemoved ? { removalReason: "policy", removedBy: ctx.ownerId } : {}),
      })
      .returning({ id: communityComments.id });
    return comment!.id;
  }

  async function modLogs() {
    return getDrizzleDb()
      .select()
      .from(communityModLogs)
      .where(eq(communityModLogs.communityId, ctx.communityId));
  }

  // --------------------------------------------------------------------------
  // Posts
  // --------------------------------------------------------------------------

  it("restores a removed post to published and writes an audit log", async () => {
    const postId = await createPost("removed");

    const result = await svc.restoreContent({ targetType: "post", targetId: postId }, ctx.ownerId);

    expect(result).toEqual({
      targetType: "post",
      targetId: postId,
      status: "published",
      restored: true,
    });

    const [row] = await getDrizzleDb()
      .select()
      .from(communityPosts)
      .where(eq(communityPosts.id, postId));
    expect(row?.status).toBe("published");
    expect(row?.removalReason).toBeNull();
    expect(row?.removedBy).toBeNull();

    const logs = await modLogs();
    expect(
      logs.some(
        (l) =>
          l.targetType === "post" &&
          l.targetId === postId &&
          (l.details as { kind?: string }).kind === "post_restored",
      ),
    ).toBe(true);
  });

  it("rejects restoring an author-deleted post (409)", async () => {
    const postId = await createPost("deleted");
    await expect(
      svc.restoreContent({ targetType: "post", targetId: postId }, ctx.ownerId),
    ).rejects.toThrow(/복구/);
  });

  it("404s on a missing post", async () => {
    await expect(
      svc.restoreContent(
        { targetType: "post", targetId: "00000000-0000-0000-0000-000000000000" },
        ctx.ownerId,
      ),
    ).rejects.toThrow(/찾을 수 없습니다/);
  });

  // --------------------------------------------------------------------------
  // Comments
  // --------------------------------------------------------------------------

  it("restores a keyword-hidden comment and writes an audit log", async () => {
    const commentId = await createComment({ content: "실제 본문", isHidden: true });

    const result = await svc.restoreContent(
      { targetType: "comment", targetId: commentId, reason: "오탐" },
      ctx.ownerId,
    );

    expect(result).toEqual({
      targetType: "comment",
      targetId: commentId,
      status: "visible",
      restored: true,
    });

    const [row] = await getDrizzleDb()
      .select()
      .from(communityComments)
      .where(eq(communityComments.id, commentId));
    expect(row?.isHidden).toBe(false);
    expect(row?.isRemoved).toBe(false);
    expect(row?.content).toBe("실제 본문");

    const logs = await modLogs();
    expect(
      logs.some(
        (l) =>
          l.targetType === "comment" &&
          l.targetId === commentId &&
          (l.details as { kind?: string }).kind === "comment_restored",
      ),
    ).toBe(true);
  });

  it("restores a removed comment whose original content survived", async () => {
    const commentId = await createComment({ content: "살아있는 원문", isRemoved: true });

    await expect(
      svc.restoreContent({ targetType: "comment", targetId: commentId }, ctx.ownerId),
    ).resolves.toMatchObject({ restored: true });

    const [row] = await getDrizzleDb()
      .select()
      .from(communityComments)
      .where(eq(communityComments.id, commentId));
    expect(row?.isRemoved).toBe(false);
    expect(row?.removedBy).toBeNull();
  });

  it("rejects a removed comment whose content was destroyed (409) and writes no log", async () => {
    const commentId = await createComment({
      content: REMOVED_COMMENT_SENTINEL,
      isRemoved: true,
    });

    await expect(
      svc.restoreContent({ targetType: "comment", targetId: commentId }, ctx.ownerId),
    ).rejects.toThrow(/원문/);

    // Rejection must be side-effect free: no state change, no audit row.
    const [row] = await getDrizzleDb()
      .select()
      .from(communityComments)
      .where(eq(communityComments.id, commentId));
    expect(row?.isRemoved).toBe(true);
    expect(await modLogs()).toHaveLength(0);
  });

  it("rejects an author-deleted comment (409)", async () => {
    const commentId = await createComment({ content: "[삭제됨]", isDeleted: true });
    await expect(
      svc.restoreContent({ targetType: "comment", targetId: commentId }, ctx.ownerId),
    ).rejects.toThrow(/복구/);
  });

  it("rejects an already-visible comment (409)", async () => {
    const commentId = await createComment({ content: "정상 댓글" });
    await expect(
      svc.restoreContent({ targetType: "comment", targetId: commentId }, ctx.ownerId),
    ).rejects.toThrow(/복구/);
  });
});
