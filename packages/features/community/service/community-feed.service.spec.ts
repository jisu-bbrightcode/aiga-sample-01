/**
 * CommunityFeedService — read-only feed aggregation.
 *
 * The full hot/rising/controversial sort logic is exercised at integration
 * time; here we pin the smaller invariants that matter most:
 *   - empty-membership home feed short-circuits
 *   - getAllFeed only includes public communities
 *   - getPopularFeed honours the time filter window
 *   - blockedUserIds filter excludes those authors
 */

import { communityPosts } from "@repo/drizzle";
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

  async function seedPost(authorId: string, opts: { title?: string; contentRating?: string } = {}) {
    const [post] = await getDrizzleDb()
      .insert(communityPosts)
      .values({
        communityId: ctx.communityId,
        authorId,
        title: opts.title ?? "test post",
        contentRating: (opts.contentRating ?? "general") as never,
        status: "published",
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
});
