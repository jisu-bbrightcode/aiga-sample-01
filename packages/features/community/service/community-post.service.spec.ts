/**
 * CommunityPostService — happy-path smoke covering create / findAll /
 * findById / update / delete / pin / lock + key permission guards.
 *
 * 4-dep injection mirrors comment.service.spec — real implementations,
 * moderation skipped via missing OPENAI_API_KEY.
 */

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  NotFoundException,
} from "@nestjs/common";
import { RateLimitService } from "@repo/core/rate-limit";
import { communityMemberships, communityModLogs, communityPosts, rateLimits } from "@repo/drizzle";
import { eq, inArray } from "drizzle-orm";
import { endTestDb, getDrizzleDb, hasDb } from "../../payment/__tests__/test-db";
import { addExtraMember, cleanupExtraMember, setupCommunityCtx } from "./__tests__/test-helpers";
import { CommunityService } from "./community.service";
import { CommunityContentModerationService } from "./community-content-moderation.service";
import { CommunityFilterService } from "./community-filter.service";
import { CommunityKeywordFilterService } from "./community-keyword-filter.service";
import { CommunityPostService, POST_CREATE_RATE_LIMIT } from "./community-post.service";
import { CommunityTierService } from "./community-tier.service";

const describeIfDb = hasDb ? describe : describe.skip;
jest.setTimeout(30_000);

describeIfDb("CommunityPostService", () => {
  let svc: CommunityPostService;
  let ctx: Awaited<ReturnType<typeof setupCommunityCtx>>["ctx"];
  let author: string;
  let teardown: () => Promise<void>;
  const createdPostIds: string[] = [];

  beforeAll(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.RATE_LIMIT_ENABLED;
    const db = getDrizzleDb();
    const community = new CommunityService(db);
    svc = new CommunityPostService(
      db,
      community,
      new CommunityKeywordFilterService(db),
      new CommunityTierService(db),
      new CommunityContentModerationService(),
      new RateLimitService(db),
      new CommunityFilterService(db, community),
    );
  });

  beforeEach(async () => {
    const setup = await setupCommunityCtx("post");
    ctx = setup.ctx;
    teardown = setup.teardown;
    author = await addExtraMember("post", ctx.communityId);
    createdPostIds.length = 0;
  });

  afterEach(async () => {
    if (!ctx || !author || !teardown) return;

    const db = getDrizzleDb();
    await db.delete(communityModLogs).where(eq(communityModLogs.communityId, ctx.communityId));
    if (createdPostIds.length > 0) {
      await db.delete(communityPosts).where(inArray(communityPosts.id, createdPostIds));
    }
    await db.delete(communityPosts).where(eq(communityPosts.communityId, ctx.communityId));
    await db
      .delete(rateLimits)
      .where(eq(rateLimits.key, `${POST_CREATE_RATE_LIMIT.action}:${author}`));
    await db.delete(communityMemberships).where(eq(communityMemberships.userId, author));
    await cleanupExtraMember(author);
    await teardown();
  });

  afterAll(async () => {
    await endTestDb();
  });

  it("create() persists a post with the caller as author", async () => {
    const p = await svc.create(
      { communityId: ctx.communityId, title: "Hello", type: "text" } as never,
      author,
    );
    createdPostIds.push(p.id);
    expect(p.authorId).toBe(author);
    expect(p.title).toBe("Hello");
  });

  it("create() rejects with HTTP 429 once the per-user rate limit is exceeded", async () => {
    for (let i = 0; i < POST_CREATE_RATE_LIMIT.maxRequests; i++) {
      const p = await svc.create(
        { communityId: ctx.communityId, title: `RL ${i}`, type: "text" } as never,
        author,
      );
      createdPostIds.push(p.id);
    }

    await expect(
      svc.create(
        { communityId: ctx.communityId, title: "RL over limit", type: "text" } as never,
        author,
      ),
    ).rejects.toMatchObject({ status: 429 });

    // 다른 작성자는 동일 윈도우에서도 영향을 받지 않는다(키가 userId별 분리).
    const other = await addExtraMember("post-rl", ctx.communityId);
    try {
      const p = await svc.create(
        { communityId: ctx.communityId, title: "Other author", type: "text" } as never,
        other,
      );
      createdPostIds.push(p.id);
      expect(p.authorId).toBe(other);
    } finally {
      const db = getDrizzleDb();
      await db
        .delete(rateLimits)
        .where(eq(rateLimits.key, `${POST_CREATE_RATE_LIMIT.action}:${other}`));
      await cleanupExtraMember(other);
    }
  });

  it("create() surfaces the 429 as an HttpException instance", async () => {
    for (let i = 0; i < POST_CREATE_RATE_LIMIT.maxRequests; i++) {
      const p = await svc.create(
        { communityId: ctx.communityId, title: `H ${i}`, type: "text" } as never,
        author,
      );
      createdPostIds.push(p.id);
    }
    await expect(
      svc.create({ communityId: ctx.communityId, title: "over", type: "text" } as never, author),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it("findById() returns null for an unknown id", async () => {
    await expect(svc.findById("00000000-0000-0000-0000-000000000000")).resolves.toBeNull();
  });

  it("findAll() returns posts in the community", async () => {
    const p = await svc.create({ communityId: ctx.communityId, title: "A" } as never, author);
    createdPostIds.push(p.id);
    const list = await svc.findAll({ communityId: ctx.communityId });
    expect(list.items.some((x) => x.id === p.id)).toBe(true);
  });

  it("findAll() returns an empty page for an unknown community slug", async () => {
    const p = await svc.create({ communityId: ctx.communityId, title: "Hidden" } as never, author);
    createdPostIds.push(p.id);

    await expect(svc.findAll({ communitySlug: "missing-community" })).resolves.toEqual({
      items: [],
      nextCursor: null,
    });
  });

  it("findAll() rejects an out-of-range limit", async () => {
    await expect(svc.findAll({ communityId: ctx.communityId, limit: 0 })).rejects.toThrow(
      BadRequestException,
    );
    await expect(svc.findAll({ communityId: ctx.communityId, limit: 101 })).rejects.toThrow(
      BadRequestException,
    );
  });

  it("findAll() paginates top sort using a sort-specific cursor", async () => {
    const high = await svc.create({ communityId: ctx.communityId, title: "High" } as never, author);
    const low = await svc.create({ communityId: ctx.communityId, title: "Low" } as never, author);
    createdPostIds.push(high.id, low.id);

    const db = getDrizzleDb();
    await db
      .update(communityPosts)
      .set({ voteScore: 10, createdAt: new Date("2026-01-02T00:00:00.000Z") })
      .where(eq(communityPosts.id, high.id));
    await db
      .update(communityPosts)
      .set({ voteScore: 1, createdAt: new Date("2026-01-01T00:00:00.000Z") })
      .where(eq(communityPosts.id, low.id));

    const firstPage = await svc.findAll({ communityId: ctx.communityId, sort: "top", limit: 1 });
    expect(firstPage.items.map((p) => p.id)).toEqual([high.id]);
    expect(firstPage.nextCursor).toEqual(expect.any(String));

    const secondPage = await svc.findAll({
      communityId: ctx.communityId,
      sort: "top",
      cursor: firstPage.nextCursor ?? undefined,
      limit: 1,
    });
    expect(secondPage.items.map((p) => p.id)).toEqual([low.id]);
  });

  it("update() mutates title for the author", async () => {
    const p = await svc.create({ communityId: ctx.communityId, title: "Old" } as never, author);
    createdPostIds.push(p.id);
    const u = await svc.update(p.id, { title: "New" } as never, author);
    expect(u.title).toBe("New");
  });

  it("delete() throws NotFound for unknown id", async () => {
    await expect(svc.delete("00000000-0000-0000-0000-000000000000", author)).rejects.toThrow(
      NotFoundException,
    );
  });

  it("delete() soft-marks the post (findAll excludes deleted)", async () => {
    const p = await svc.create({ communityId: ctx.communityId, title: "X" } as never, author);
    createdPostIds.push(p.id);
    await svc.delete(p.id, author);
    const list = await svc.findAll({ communityId: ctx.communityId });
    expect(list.items.find((x) => x.id === p.id)).toBeUndefined();
  });

  // -- BBR-594: search + block/hide reflection + admin field separation -------

  it("findAll() filters by a case-insensitive search on the title", async () => {
    const a = await svc.create(
      { communityId: ctx.communityId, title: "Apple pie recipe" } as never,
      author,
    );
    const b = await svc.create(
      { communityId: ctx.communityId, title: "Banana bread" } as never,
      author,
    );
    createdPostIds.push(a.id, b.id);

    const list = await svc.findAll({ communityId: ctx.communityId, search: "apple" });
    const ids = list.items.map((x) => x.id);
    expect(ids).toContain(a.id);
    expect(ids).not.toContain(b.id);
  });

  it("findAll() search also matches the post content", async () => {
    const a = await svc.create(
      {
        communityId: ctx.communityId,
        title: "Untitled",
        content: "uniquetokenxyz inside",
      } as never,
      author,
    );
    createdPostIds.push(a.id);

    const list = await svc.findAll({ communityId: ctx.communityId, search: "uniquetokenxyz" });
    expect(list.items.map((x) => x.id)).toContain(a.id);
  });

  it("findAll() excludes posts authored by blocked users", async () => {
    const p = await svc.create(
      { communityId: ctx.communityId, title: "from a blocked author" } as never,
      author,
    );
    createdPostIds.push(p.id);

    const visible = await svc.findAll({ communityId: ctx.communityId });
    expect(visible.items.map((x) => x.id)).toContain(p.id);

    const filtered = await svc.findAll({
      communityId: ctx.communityId,
      blockedUserIds: [author],
    });
    expect(filtered.items.map((x) => x.id)).not.toContain(p.id);
  });

  it("adminFindAll() surfaces non-published posts that the public findAll hides", async () => {
    const p = await svc.create(
      { communityId: ctx.communityId, title: "hidden one" } as never,
      author,
    );
    createdPostIds.push(p.id);

    const db = getDrizzleDb();
    await db.update(communityPosts).set({ status: "hidden" }).where(eq(communityPosts.id, p.id));

    const publicList = await svc.findAll({ communityId: ctx.communityId });
    expect(publicList.items.map((x) => x.id)).not.toContain(p.id);

    const adminList = await svc.adminFindAll({ communityId: ctx.communityId });
    expect(adminList.items.map((x) => x.id)).toContain(p.id);
    expect(adminList.total).toBeGreaterThanOrEqual(1);
    expect(adminList.page).toBe(1);
  });

  it("adminFindAll() can filter by status and search together", async () => {
    const p = await svc.create(
      { communityId: ctx.communityId, title: "ZZsearchable admin post" } as never,
      author,
    );
    createdPostIds.push(p.id);

    const list = await svc.adminFindAll({
      communityId: ctx.communityId,
      status: "published",
      search: "ZZsearchable",
    });
    expect(list.items.map((x) => x.id)).toContain(p.id);
  });

  // -- BBR-598: moderator remove/restore + audit log preservation -------------

  it("remove() distinguishes admin removal (removed) from author delete (deleted)", async () => {
    const db = getDrizzleDb();

    const adminGone = await svc.create(
      { communityId: ctx.communityId, title: "admin will remove" } as never,
      author,
    );
    createdPostIds.push(adminGone.id);
    const removed = await svc.remove(adminGone.id, "정책 위반", ctx.ownerId);
    expect(removed.status).toBe("removed");
    expect(removed.removedBy).toBe(ctx.ownerId);

    const authorGone = await svc.create(
      { communityId: ctx.communityId, title: "author will delete" } as never,
      author,
    );
    createdPostIds.push(authorGone.id);
    await svc.delete(authorGone.id, author);
    const [row] = await db
      .select()
      .from(communityPosts)
      .where(eq(communityPosts.id, authorGone.id));
    expect(row?.status).toBe("deleted");
  });

  it("remove() writes an audit log entry that survives independently of the post", async () => {
    const db = getDrizzleDb();
    const p = await svc.create(
      { communityId: ctx.communityId, title: "audit me" } as never,
      author,
    );
    createdPostIds.push(p.id);

    await svc.remove(p.id, "스팸", ctx.ownerId);

    const logs = await db
      .select()
      .from(communityModLogs)
      .where(eq(communityModLogs.targetId, p.id));
    const removeLog = logs.find((l) => l.action === "remove_post");
    expect(removeLog).toBeDefined();
    expect(removeLog?.moderatorId).toBe(ctx.ownerId);
    expect(removeLog?.targetType).toBe("post");
    expect(removeLog?.reason).toBe("스팸");
  });

  it("restore() returns a removed post to published, clears removal fields, logs audit", async () => {
    const db = getDrizzleDb();
    const p = await svc.create(
      { communityId: ctx.communityId, title: "bring me back" } as never,
      author,
    );
    createdPostIds.push(p.id);
    await svc.remove(p.id, "오인 제거", ctx.ownerId);

    const restored = await svc.restore(p.id, ctx.ownerId);
    expect(restored.status).toBe("published");
    expect(restored.removedBy).toBeNull();
    expect(restored.removalReason).toBeNull();

    // findAll (public) now surfaces it again — comments/reports were never deleted.
    const list = await svc.findAll({ communityId: ctx.communityId });
    expect(list.items.map((x) => x.id)).toContain(p.id);

    const logs = await db
      .select()
      .from(communityModLogs)
      .where(eq(communityModLogs.targetId, p.id));
    expect(logs.some((l) => l.action === "other" && l.reason === "post_restored")).toBe(true);
  });

  it("restore() rejects an author-deleted post with Conflict", async () => {
    const p = await svc.create(
      { communityId: ctx.communityId, title: "author deleted, not restorable" } as never,
      author,
    );
    createdPostIds.push(p.id);
    await svc.delete(p.id, author);

    await expect(svc.restore(p.id, ctx.ownerId)).rejects.toThrow(ConflictException);
  });

  it("restore() rejects a non-moderator member", async () => {
    const p = await svc.create(
      { communityId: ctx.communityId, title: "members cannot restore" } as never,
      author,
    );
    createdPostIds.push(p.id);
    await svc.remove(p.id, "제거", ctx.ownerId);

    await expect(svc.restore(p.id, author)).rejects.toThrow(ForbiddenException);
  });

  it("restore() throws NotFound for an unknown id", async () => {
    await expect(svc.restore("00000000-0000-0000-0000-000000000000", ctx.ownerId)).rejects.toThrow(
      NotFoundException,
    );
  });

  // -- BBR-603: pin/lock toggle + crosspost ops audit (reason + before/after) --

  it("pin() toggles isPinned and writes a pin_post audit log with before/after + reason", async () => {
    const db = getDrizzleDb();
    const p = await svc.create({ communityId: ctx.communityId, title: "pin me" } as never, author);
    createdPostIds.push(p.id);
    expect(p.isPinned).toBe(false);

    const pinned = await svc.pin(p.id, ctx.ownerId, { reason: "공지 고정" });
    expect(pinned.isPinned).toBe(true);

    const logs = await db
      .select()
      .from(communityModLogs)
      .where(eq(communityModLogs.targetId, p.id));
    const pinLog = logs.find((l) => l.action === "pin_post");
    expect(pinLog).toBeDefined();
    expect(pinLog?.targetType).toBe("post");
    expect(pinLog?.moderatorId).toBe(ctx.ownerId);
    expect(pinLog?.reason).toBe("공지 고정");
    expect(pinLog?.details).toMatchObject({
      kind: "pin",
      before: { isPinned: false },
      after: { isPinned: true },
    });

    // No explicit value → toggles back off.
    const unpinned = await svc.pin(p.id, ctx.ownerId);
    expect(unpinned.isPinned).toBe(false);
  });

  it("pin() honors an explicit pinned=false idempotently", async () => {
    const p = await svc.create(
      { communityId: ctx.communityId, title: "explicit unpin" } as never,
      author,
    );
    createdPostIds.push(p.id);

    const stillUnpinned = await svc.pin(p.id, ctx.ownerId, { pinned: false });
    expect(stillUnpinned.isPinned).toBe(false);
  });

  it("pin() rejects a non-moderator member", async () => {
    const p = await svc.create(
      { communityId: ctx.communityId, title: "members cannot pin" } as never,
      author,
    );
    createdPostIds.push(p.id);

    await expect(svc.pin(p.id, author)).rejects.toThrow(ForbiddenException);
  });

  it("lock() toggles isLocked and writes a lock_post audit log capturing the new state", async () => {
    const db = getDrizzleDb();
    const p = await svc.create({ communityId: ctx.communityId, title: "lock me" } as never, author);
    createdPostIds.push(p.id);
    expect(p.isLocked).toBe(false);

    const locked = await svc.lock(p.id, ctx.ownerId, { reason: "과열 토론" });
    expect(locked.isLocked).toBe(true);

    const logs = await db
      .select()
      .from(communityModLogs)
      .where(eq(communityModLogs.targetId, p.id));
    const lockLog = logs.find((l) => l.action === "lock_post");
    expect(lockLog).toBeDefined();
    expect(lockLog?.reason).toBe("과열 토론");
    expect(lockLog?.details).toMatchObject({
      kind: "lock",
      before: { isLocked: false },
      after: { isLocked: true },
    });

    const unlocked = await svc.lock(p.id, ctx.ownerId);
    expect(unlocked.isLocked).toBe(false);
  });

  it("crosspost() creates a crosspost and records a crosspost audit log in the target community", async () => {
    const db = getDrizzleDb();
    const original = await svc.create(
      { communityId: ctx.communityId, title: "original" } as never,
      author,
    );
    createdPostIds.push(original.id);

    const cross = await svc.crosspost(original.id, ctx.communityId, author, "참고용 공유");
    createdPostIds.push(cross.id);
    expect(cross.crosspostParentId).toBe(original.id);
    expect(cross.title).toContain("[Crosspost]");

    const logs = await db
      .select()
      .from(communityModLogs)
      .where(eq(communityModLogs.targetId, cross.id));
    const crossLog = logs.find(
      (l) => l.action === "other" && (l.details as { kind?: string })?.kind === "crosspost",
    );
    expect(crossLog).toBeDefined();
    expect(crossLog?.reason).toBe("참고용 공유");
    expect(crossLog?.details).toMatchObject({
      kind: "crosspost",
      sourcePostId: original.id,
      sourceCommunityId: ctx.communityId,
      crosspostId: cross.id,
    });
  });
});
