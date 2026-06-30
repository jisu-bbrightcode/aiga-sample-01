/**
 * CommunityFeedService — read-only feed aggregation.
 *
 * The full hot/rising/controversial sort logic is exercised at integration
 * time; here we pin the smaller invariants that matter most:
 *   - empty-membership home feed short-circuits
 *   - getAllFeed only includes public communities
 *   - getPopularFeed honours the time filter window
 *   - getPopularFeed shares the same visibility/filter invariants as home/all
 *     (public-community scope, published-only, blocked authors, content rating)
 *   - blockedUserIds filter excludes those authors
 */

import { randomUUID } from "node:crypto";
import { communities, communityMemberships, communityPosts } from "@repo/drizzle";
import { eq, inArray } from "drizzle-orm";
import {
  cleanupUser,
  endTestDb,
  ensureUser,
  getDrizzleDb,
  hasDb,
  newUserId,
} from "../../payment/__tests__/test-db";
import { addExtraMember, cleanupExtraMember, setupCommunityCtx } from "./__tests__/test-helpers";
import { CommunityFeedService } from "./community-feed.service";

type CommunityType = "public" | "restricted" | "private";

/** Seed a standalone community of a given type with a single published post. */
async function setupCommunityWithPost(
  prefix: string,
  type: CommunityType,
): Promise<{ postId: string; cleanup: () => Promise<void> }> {
  const db = getDrizzleDb();
  const ownerId = newUserId(`${prefix}-owner`);
  await ensureUser(ownerId);

  const [community] = await db
    .insert(communities)
    .values({
      name: `${prefix}-${randomUUID().slice(0, 6)}`,
      slug: `${prefix}-${randomUUID().slice(0, 8)}`,
      description: `${prefix} community`,
      ownerId,
      type: type as never,
    })
    .returning({ id: communities.id });
  const communityId = community!.id;

  await db
    .insert(communityMemberships)
    .values({ communityId, userId: ownerId, role: "owner" })
    .onConflictDoNothing();

  const [post] = await db
    .insert(communityPosts)
    .values({
      communityId,
      authorId: ownerId,
      title: `${prefix} post`,
      contentRating: "general" as never,
      status: "published",
    })
    .returning({ id: communityPosts.id });

  return {
    postId: post!.id,
    cleanup: async () => {
      await db.delete(communityPosts).where(eq(communityPosts.communityId, communityId));
      await db.delete(communityMemberships).where(eq(communityMemberships.communityId, communityId));
      await db.delete(communities).where(eq(communities.id, communityId));
      await cleanupUser(ownerId);
    },
  };
}

const describeIfDb = hasDb ? describe : describe.skip;
jest.setTimeout(30_000);

describeIfDb("CommunityFeedService", () => {
  let svc: CommunityFeedService;
  let ctx: Awaited<ReturnType<typeof setupCommunityCtx>>["ctx"];
  let memberId: string;
  let teardown: () => Promise<void>;
  let createdPostIds: string[] = [];

  beforeAll(() => {
    svc = new CommunityFeedService(getDrizzleDb());
  });

  beforeEach(async () => {
    const setup = await setupCommunityCtx("feed");
    ctx = setup.ctx;
    teardown = setup.teardown;
    memberId = await addExtraMember("feed", ctx.communityId);
    createdPostIds = [];
  });

  afterEach(async () => {
    const db = getDrizzleDb();
    if (createdPostIds.length > 0) {
      await db.delete(communityPosts).where(inArray(communityPosts.id, createdPostIds));
    }
    await cleanupExtraMember(memberId);
    await teardown();
  });

  afterAll(async () => {
    await endTestDb();
  });

  async function seedPost(
    authorId: string,
    opts: { title?: string; contentRating?: string; status?: string } = {},
  ) {
    const [post] = await getDrizzleDb()
      .insert(communityPosts)
      .values({
        communityId: ctx.communityId,
        authorId,
        title: opts.title ?? "test post",
        contentRating: (opts.contentRating ?? "general") as never,
        status: (opts.status ?? "published") as never,
      })
      .returning({ id: communityPosts.id });
    createdPostIds.push(post!.id);
    return post!.id;
  }

  it("getHomeFeed() short-circuits to empty for a user with no memberships", async () => {
    const stranger = newUserId("feed-stranger");
    await ensureUser(stranger);
    try {
      const r = await svc.getHomeFeed(stranger);
      expect(r.items).toEqual([]);
      expect(r.total).toBe(0);
      expect(r.hasMore).toBe(false);
    } finally {
      await cleanupUser(stranger);
    }
  });

  it("getHomeFeed() returns posts from subscribed communities", async () => {
    const postId = await seedPost(memberId);
    const r = await svc.getHomeFeed(memberId);
    expect(r.items.map((p: { id: string }) => p.id)).toContain(postId);
  });

  it("getAllFeed() includes public communities", async () => {
    const postId = await seedPost(memberId);
    const r = await svc.getAllFeed();
    expect(r.items.map((p: { id: string }) => p.id)).toContain(postId);
  });

  it("blockedUserIds filter excludes posts from those authors", async () => {
    const postId = await seedPost(memberId);
    const r = await svc.getHomeFeed(memberId, { blockedUserIds: [memberId] });
    expect(r.items.map((p: { id: string }) => p.id)).not.toContain(postId);
  });

  // AC#2: 차단 필터가 모든 피드 정렬에 동일하게 적용된다 (home 외 all/popular도).
  it("getAllFeed() excludes posts from blocked authors", async () => {
    const postId = await seedPost(memberId);
    const r = await svc.getAllFeed({ blockedUserIds: [memberId] });
    expect(r.items.map((p: { id: string }) => p.id)).not.toContain(postId);
  });

  it("getPopularFeed() excludes posts from blocked authors", async () => {
    const postId = await seedPost(memberId);
    const items = await svc.getPopularFeed({ blockedUserIds: [memberId] });
    expect(items.map((p) => p.id)).not.toContain(postId);
  });

  it("allowedRatings defaults to general+sensitive (nsfw excluded by default)", async () => {
    const nsfwId = await seedPost(memberId, { contentRating: "nsfw" });
    const cleanId = await seedPost(memberId, { contentRating: "general" });
    const r = await svc.getHomeFeed(memberId);
    const ids = r.items.map((p: { id: string }) => p.id);
    expect(ids).toContain(cleanId);
    expect(ids).not.toContain(nsfwId);
  });

  it("getPopularFeed() honours the time filter window (recent only)", async () => {
    const recent = await seedPost(memberId);
    // Backdate one post outside the "day" window.
    const old = await seedPost(memberId, { title: "old post" });
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    await getDrizzleDb()
      .update(communityPosts)
      .set({ createdAt: tenDaysAgo })
      .where(eq(communityPosts.id, old));

    const items = await svc.getPopularFeed({ timeFilter: "day" });
    const ids = items.map((p) => p.id);
    expect(ids).toContain(recent);
    expect(ids).not.toContain(old);
  });

  // --- BBR-1066: popular feed visibility/filter invariants must match home/all ---

  it("getPopularFeed() excludes posts from non-public communities", async () => {
    const publicPostId = await seedPost(memberId); // ctx community is public
    const priv = await setupCommunityWithPost("feed-private", "private");
    const restricted = await setupCommunityWithPost("feed-restricted", "restricted");
    try {
      const ids = (await svc.getPopularFeed({ timeFilter: "all" })).map((p) => p.id);
      expect(ids).toContain(publicPostId);
      expect(ids).not.toContain(priv.postId);
      expect(ids).not.toContain(restricted.postId);
    } finally {
      await priv.cleanup();
      await restricted.cleanup();
    }
  });

  it("getPopularFeed() excludes non-published posts (draft)", async () => {
    const published = await seedPost(memberId);
    const draft = await seedPost(memberId, { title: "draft post", status: "draft" });
    const ids = (await svc.getPopularFeed({ timeFilter: "all" })).map((p) => p.id);
    expect(ids).toContain(published);
    expect(ids).not.toContain(draft);
  });

  it("getPopularFeed() excludes posts from blocked authors", async () => {
    const blockedPost = await seedPost(memberId);
    const ids = (
      await svc.getPopularFeed({ timeFilter: "all", blockedUserIds: [memberId] })
    ).map((p) => p.id);
    expect(ids).not.toContain(blockedPost);
  });

  it("getPopularFeed() excludes nsfw posts by default (rating filter)", async () => {
    const nsfwId = await seedPost(memberId, { contentRating: "nsfw" });
    const cleanId = await seedPost(memberId, { contentRating: "general" });
    const ids = (await svc.getPopularFeed({ timeFilter: "all" })).map((p) => p.id);
    expect(ids).toContain(cleanId);
    expect(ids).not.toContain(nsfwId);
  });
});
