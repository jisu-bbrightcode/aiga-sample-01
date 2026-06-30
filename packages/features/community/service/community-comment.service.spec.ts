/**
 * CommunityCommentService — happy-path smoke + key permission/validation guards.
 *
 * The service depends on 4 peers (community / keyword-filter / tier /
 * content-moderation). We instantiate the real implementations against the
 * test DB and stub the content-moderation fetch via env (OPENAI_API_KEY
 * unset → moderation auto-passes). Keyword filter is disabled by default
 * (no bannedWords seeded).
 */

import { ConflictException, NotFoundException } from "@nestjs/common";
import {
  communityComments,
  communityMemberships,
  communityModLogs,
  communityPosts,
} from "@repo/drizzle";
import { and, eq, inArray } from "drizzle-orm";
import { endTestDb, getDrizzleDb, hasDb } from "../../payment/__tests__/test-db";
import { addExtraMember, cleanupExtraMember, setupCommunityCtx } from "./__tests__/test-helpers";
import { CommunityCommentService } from "./community-comment.service";
import { CommunityContentModerationService } from "./community-content-moderation.service";
import { CommunityKeywordFilterService } from "./community-keyword-filter.service";
import { CommunityService } from "./community.service";
import { CommunityTierService } from "./community-tier.service";

const describeIfDb = hasDb ? describe : describe.skip;
jest.setTimeout(30_000);

describeIfDb("CommunityCommentService", () => {
  let svc: CommunityCommentService;
  let ctx: Awaited<ReturnType<typeof setupCommunityCtx>>["ctx"];
  let author: string;
  let postId: string;
  let teardown: () => Promise<void>;
  const createdCommentIds: string[] = [];

  beforeAll(() => {
    delete process.env.OPENAI_API_KEY; // bypass content moderation
    const db = getDrizzleDb();
    const community = new CommunityService(db);
    const keyword = new CommunityKeywordFilterService(db);
    const tier = new CommunityTierService(db);
    const mod = new CommunityContentModerationService();
    svc = new CommunityCommentService(db, community, keyword, tier, mod);
  });

  beforeEach(async () => {
    const setup = await setupCommunityCtx("cmt");
    ctx = setup.ctx;
    teardown = setup.teardown;
    author = await addExtraMember("cmt", ctx.communityId);
    createdCommentIds.length = 0;

    const [post] = await getDrizzleDb()
      .insert(communityPosts)
      .values({
        communityId: ctx.communityId,
        authorId: ctx.ownerId,
        title: "topic",
      })
      .returning({ id: communityPosts.id });
    postId = post!.id;
  });

  afterEach(async () => {
    const db = getDrizzleDb();
    if (createdCommentIds.length > 0) {
      await db.delete(communityComments).where(inArray(communityComments.id, createdCommentIds));
    }
    await db.delete(communityComments).where(eq(communityComments.postId, postId));
    await db.delete(communityPosts).where(eq(communityPosts.id, postId));
    await db.delete(communityMemberships).where(eq(communityMemberships.userId, author));
    await cleanupExtraMember(author);
    await teardown();
  });

  afterAll(async () => {
    await endTestDb();
  });

  it("create() persists a top-level comment with depth=0", async () => {
    const c = await svc.create({ postId, content: "hello" } as never, author);
    createdCommentIds.push(c.id);
    expect(c.depth).toBe(0);
    expect(c.parentId).toBeNull();
    expect(c.authorId).toBe(author);
  });

  it("create() persists a reply with depth=parent.depth+1", async () => {
    const parent = await svc.create({ postId, content: "p" } as never, author);
    createdCommentIds.push(parent.id);
    const reply = await svc.create({ postId, content: "r", parentId: parent.id } as never, author);
    createdCommentIds.push(reply.id);
    expect(reply.depth).toBe(1);
    expect(reply.parentId).toBe(parent.id);
  });

  it("create() throws NotFound for an unknown postId", async () => {
    await expect(
      svc.create({ postId: "00000000-0000-0000-0000-000000000000", content: "x" } as never, author),
    ).rejects.toThrow(NotFoundException);
  });

  it("findById() returns null for an unknown id", async () => {
    await expect(svc.findById("00000000-0000-0000-0000-000000000000")).resolves.toBeNull();
  });

  it("update() mutates content for the author", async () => {
    const c = await svc.create({ postId, content: "old" } as never, author);
    createdCommentIds.push(c.id);
    const updated = await svc.update(c.id, "new", author);
    expect(updated.content).toBe("new");
  });

  it("delete() masks content + sets isDeleted but keeps the row visible (Reddit-style)", async () => {
    const c = await svc.create({ postId, content: "original" } as never, author);
    createdCommentIds.push(c.id);
    await svc.delete(c.id, author);
    const list = await svc.findByPost({ postId });
    const found = list.items.find((x) => x.id === c.id);
    expect(found).toBeDefined();
    expect(found?.isDeleted).toBe(true);
    expect(found?.content).not.toBe("original");
  });

  it("findByPost() masks keyword-hidden content from non-authors but shows it to the author (AC#1)", async () => {
    const c = await svc.create({ postId, content: "borderline text" } as never, author);
    createdCommentIds.push(c.id);
    await getDrizzleDb()
      .update(communityComments)
      .set({ isHidden: true })
      .where(eq(communityComments.id, c.id));

    const asOther = await svc.findByPost({ postId, viewerId: ctx.ownerId });
    expect(asOther.items.find((x) => x.id === c.id)?.content).not.toBe("borderline text");

    const asAuthor = await svc.findByPost({ postId, viewerId: author });
    expect(asAuthor.items.find((x) => x.id === c.id)?.content).toBe("borderline text");
  });

  it("findByPost() totalCount counts tombstones so it matches the visible list (AC#2)", async () => {
    const a = await svc.create({ postId, content: "first" } as never, author);
    const b = await svc.create({ postId, content: "second" } as never, author);
    createdCommentIds.push(a.id, b.id);
    await svc.delete(a.id, author); // tombstone — stays visible and counted

    const list = await svc.findByPost({ postId });
    expect(list.items).toHaveLength(2);
    expect(list.totalCount).toBe(list.items.length);
  });

  it("findByPost() excludes blocked authors from both the list and totalCount (AC#1/AC#2)", async () => {
    const mine = await svc.create({ postId, content: "owner comment" } as never, ctx.ownerId);
    const theirs = await svc.create({ postId, content: "blocked comment" } as never, author);
    createdCommentIds.push(mine.id, theirs.id);

    const list = await svc.findByPost({ postId, blockedUserIds: [author], viewerId: ctx.ownerId });
    expect(list.items.map((x) => x.id)).toEqual([mine.id]);
    expect(list.totalCount).toBe(1);
  });

  // BBR-602 — 삭제/숨김/복구 + 카운트/감사 일관성

  const postCommentCount = async (): Promise<number> => {
    const [row] = await getDrizzleDb()
      .select({ commentCount: communityPosts.commentCount })
      .from(communityPosts)
      .where(eq(communityPosts.id, postId));
    return row?.commentCount ?? -1;
  };

  it("delete() is idempotent — re-deleting does not double-decrement commentCount (AC#1)", async () => {
    const c = await svc.create({ postId, content: "to delete" } as never, author);
    createdCommentIds.push(c.id);
    expect(await postCommentCount()).toBe(1);

    await svc.delete(c.id, author);
    expect(await postCommentCount()).toBe(0);

    // 재호출은 멱등 — 카운트가 음수로 어긋나지 않는다.
    await svc.delete(c.id, author);
    expect(await postCommentCount()).toBe(0);
  });

  it("remove() preserves original content + writes an audit log; restore() unhides it (AC#2)", async () => {
    const c = await svc.create({ postId, content: "operator target" } as never, author);
    createdCommentIds.push(c.id);

    const removed = await svc.remove(c.id, "rule violation", ctx.ownerId);
    expect(removed.isRemoved).toBe(true);
    expect(removed.removedBy).toBe(ctx.ownerId);
    // 본문은 보존되어 복구 시 그대로 노출된다(저장 마스킹이 아니라 read 마스킹).
    expect(removed.content).toBe("operator target");

    const removeLogs = await getDrizzleDb()
      .select()
      .from(communityModLogs)
      .where(and(eq(communityModLogs.targetId, c.id), eq(communityModLogs.action, "remove_comment")));
    expect(removeLogs).toHaveLength(1);

    const restored = await svc.restore(c.id, ctx.ownerId);
    expect(restored.isRemoved).toBe(false);
    expect(restored.removalReason).toBeNull();
    expect(restored.removedBy).toBeNull();
    expect(restored.content).toBe("operator target");

    const restoreLogs = await getDrizzleDb()
      .select()
      .from(communityModLogs)
      .where(and(eq(communityModLogs.targetId, c.id), eq(communityModLogs.action, "other")));
    expect(restoreLogs).toHaveLength(1);
  });

  it("restore() rejects an author-deleted comment with 409 (작성자 의사 우선)", async () => {
    const c = await svc.create({ postId, content: "author will delete" } as never, author);
    createdCommentIds.push(c.id);
    await svc.delete(c.id, author);

    await expect(svc.restore(c.id, ctx.ownerId)).rejects.toThrow(ConflictException);
  });
});
