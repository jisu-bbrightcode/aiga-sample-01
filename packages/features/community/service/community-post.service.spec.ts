/**
 * CommunityPostService — happy-path smoke covering create / findAll /
 * findById / update / delete / pin / lock + key permission guards.
 *
 * 4-dep injection mirrors comment.service.spec — real implementations,
 * moderation skipped via missing OPENAI_API_KEY.
 */

import {
  BadRequestException,
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
    svc = new CommunityPostService(
      db,
      new CommunityService(db),
      new CommunityKeywordFilterService(db),
      new CommunityTierService(db),
      new CommunityContentModerationService(),
      new RateLimitService(db),
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

  it("update() marks an author self-edit as edited without a mod-log entry", async () => {
    const p = await svc.create({ communityId: ctx.communityId, title: "Old" } as never, author);
    createdPostIds.push(p.id);

    const u = await svc.update(p.id, { title: "New" } as never, author);

    expect(u.isEdited).toBe(true);
    expect(u.editedAt).toBeTruthy();
    expect(u.lastEditedBy).toBe(author);

    const logs = await getDrizzleDb()
      .select()
      .from(communityModLogs)
      .where(eq(communityModLogs.targetId, p.id));
    expect(logs).toHaveLength(0);
  });

  it("update() lets a moderator edit another user's post and writes an audit log", async () => {
    // ctx.ownerId is the community owner → counts as moderator.
    const p = await svc.create({ communityId: ctx.communityId, title: "Old" } as never, author);
    createdPostIds.push(p.id);

    const u = await svc.update(p.id, { title: "Moderated" } as never, ctx.ownerId);

    expect(u.title).toBe("Moderated");
    expect(u.isEdited).toBe(true);
    expect(u.lastEditedBy).toBe(ctx.ownerId);

    const logs = await getDrizzleDb()
      .select()
      .from(communityModLogs)
      .where(eq(communityModLogs.targetId, p.id));
    expect(logs).toHaveLength(1);
    expect(logs[0]?.action).toBe("other");
    expect(logs[0]?.targetType).toBe("post");
    expect(logs[0]?.moderatorId).toBe(ctx.ownerId);
    expect((logs[0]?.details as { kind?: string })?.kind).toBe("edit_post");
    expect((logs[0]?.details as { changedFields?: string[] })?.changedFields).toContain("title");
  });

  it("update() forbids a non-author non-moderator member", async () => {
    const p = await svc.create(
      { communityId: ctx.communityId, title: "Old" } as never,
      ctx.ownerId,
    );
    createdPostIds.push(p.id);

    // `author` is a plain member (not the author of this post, not a moderator).
    await expect(svc.update(p.id, { title: "Nope" } as never, author)).rejects.toThrow(
      ForbiddenException,
    );
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
});
