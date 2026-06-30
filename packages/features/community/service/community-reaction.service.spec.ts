/**
 * CommunityReactionService — community reaction set + visibility gate
 * (PB-COMM-REACTION-API-SET-001 / BBR-612).
 *
 * DB-gated (skips without DATABASE_URL).
 * - AC#1: 한 사용자가 한 대상에 중복 리액션을 만들지 않는다 (delegated single-reaction set).
 * - AC#2: 차단/숨김/삭제 대상에는 리액션을 추가할 수 없다.
 */

import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { communityComments, communityPosts, reactions } from "@repo/drizzle/schema";
import { ReactionService } from "@repo/features/reaction";
import { eq, inArray } from "drizzle-orm";
import { endTestDb, getDrizzleDb, hasDb } from "../../payment/__tests__/test-db";
import { addExtraMember, cleanupExtraMember, setupCommunityCtx } from "./__tests__/test-helpers";
import { CommunityBlockService } from "./community-block.service";
import { CommunityHiddenContentService } from "./community-hidden-content.service";
import { CommunityReactionService } from "./community-reaction.service";
import { CommunityService } from "./community.service";

const describeIfDb = hasDb ? describe : describe.skip;
jest.setTimeout(30_000);

describeIfDb("CommunityReactionService", () => {
  let svc: CommunityReactionService;
  let blockSvc: CommunityBlockService;
  let ctx: Awaited<ReturnType<typeof setupCommunityCtx>>["ctx"];
  let viewer: string;
  let postId: string;
  let commentId: string;
  let teardown: () => Promise<void>;

  beforeAll(() => {
    const db = getDrizzleDb();
    blockSvc = new CommunityBlockService(db);
    svc = new CommunityReactionService(
      db,
      new ReactionService(db),
      new CommunityHiddenContentService(db, new CommunityService(db)),
      blockSvc,
    );
  });

  beforeEach(async () => {
    const setup = await setupCommunityCtx("react");
    ctx = setup.ctx;
    teardown = setup.teardown;
    viewer = await addExtraMember("react-v", ctx.communityId);

    const db = getDrizzleDb();
    const [post] = await db
      .insert(communityPosts)
      .values({
        communityId: ctx.communityId,
        authorId: ctx.ownerId,
        title: "react target",
        status: "published",
      })
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
    await db.delete(reactions).where(inArray(reactions.targetId, [postId, commentId]));
    await blockSvc.unblock(viewer, ctx.ownerId).catch(() => undefined);
    await db.delete(communityComments).where(eq(communityComments.id, commentId));
    await db.delete(communityPosts).where(eq(communityPosts.id, postId));
    await cleanupExtraMember(viewer);
    await teardown();
  });

  afterAll(async () => {
    await endTestDb();
  });

  // AC#1: 단일 리액션 보장 + 타입 변경 + 멱등 (델리게이션 스모크).
  it("sets a single reaction on a published post and changes type without duplicating", async () => {
    const first = await svc.set(viewer, { targetType: "post", targetId: postId, type: "like" });
    expect(first.changed).toBe(true);
    expect(first.counts.total).toBe(1);

    const changed = await svc.set(viewer, { targetType: "post", targetId: postId, type: "love" });
    expect(changed.type).toBe("love");
    expect(changed.counts.total).toBe(1);

    const again = await svc.set(viewer, { targetType: "post", targetId: postId, type: "love" });
    expect(again.changed).toBe(false);
    expect(again.counts.total).toBe(1);
  });

  it("reacts to a visible comment", async () => {
    const result = await svc.set(viewer, {
      targetType: "comment",
      targetId: commentId,
      type: "haha",
    });
    expect(result.changed).toBe(true);
    expect(result.counts.total).toBe(1);
  });

  // AC#2: 삭제 대상.
  it("rejects reacting to a deleted post (404)", async () => {
    await getDrizzleDb()
      .update(communityPosts)
      .set({ status: "deleted" })
      .where(eq(communityPosts.id, postId));

    await expect(
      svc.set(viewer, { targetType: "post", targetId: postId, type: "like" }),
    ).rejects.toThrow(NotFoundException);
  });

  it("rejects reacting to a removed comment (404)", async () => {
    await getDrizzleDb()
      .update(communityComments)
      .set({ isRemoved: true })
      .where(eq(communityComments.id, commentId));

    await expect(
      svc.set(viewer, { targetType: "comment", targetId: commentId, type: "like" }),
    ).rejects.toThrow(NotFoundException);
  });

  it("rejects a missing target without leaking (404)", async () => {
    await expect(
      svc.set(viewer, {
        targetType: "post",
        targetId: "00000000-0000-0000-0000-000000000000",
        type: "like",
      }),
    ).rejects.toThrow(NotFoundException);
  });

  // AC#2: 숨김 대상 (전역 숨김 + 본인 숨김).
  it("rejects reacting to a globally hidden post (403)", async () => {
    await getDrizzleDb()
      .update(communityPosts)
      .set({ status: "hidden" })
      .where(eq(communityPosts.id, postId));

    await expect(
      svc.set(viewer, { targetType: "post", targetId: postId, type: "like" }),
    ).rejects.toThrow(ForbiddenException);
  });

  it("rejects reacting to a self-hidden post (403)", async () => {
    const db = getDrizzleDb();
    const hiddenSvc = new CommunityHiddenContentService(db, new CommunityService(db));
    await hiddenSvc.hideForUser(viewer, { targetType: "post", targetId: postId, scope: "user" });

    await expect(
      svc.set(viewer, { targetType: "post", targetId: postId, type: "like" }),
    ).rejects.toThrow(ForbiddenException);
  });

  // AC#2: 차단 대상.
  it("rejects reacting to content from a blocked author (403)", async () => {
    await blockSvc.block(viewer, ctx.ownerId);

    await expect(
      svc.set(viewer, { targetType: "post", targetId: postId, type: "like" }),
    ).rejects.toThrow(ForbiddenException);
  });
});
