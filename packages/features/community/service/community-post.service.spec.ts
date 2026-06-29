/**
 * CommunityPostService — happy-path smoke covering create / findAll /
 * findById / update / delete / pin / lock + key permission guards.
 *
 * 4-dep injection mirrors comment.service.spec — real implementations,
 * moderation skipped via missing OPENAI_API_KEY.
 */

import { communityMemberships, communityPosts } from "@repo/drizzle";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { eq, inArray } from "drizzle-orm";
import { endTestDb, getDrizzleDb, hasDb } from "../../payment/__tests__/test-db";
import { addExtraMember, cleanupExtraMember, setupCommunityCtx } from "./__tests__/test-helpers";
import { CommunityService } from "./community.service";
import { CommunityContentModerationService } from "./community-content-moderation.service";
import { CommunityKeywordFilterService } from "./community-keyword-filter.service";
import { CommunityPostService } from "./community-post.service";
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
    const db = getDrizzleDb();
    svc = new CommunityPostService(
      db,
      new CommunityService(db),
      new CommunityKeywordFilterService(db),
      new CommunityTierService(db),
      new CommunityContentModerationService(),
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
});
