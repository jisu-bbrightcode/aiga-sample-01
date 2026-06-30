/**
 * CommunityService — 멤버십 (가입/탈퇴/구독/규칙 동의) — BBR-591.
 *
 * Covers the BBR-591 acceptance criteria on the membership write path:
 *   AC#1 제재/차단/비공개 커뮤니티 가입 제한
 *     - private community → join forbidden
 *     - active community ban (communityBans) → join forbidden
 *     - active suspension / permanent_ban sanction → join forbidden
 *     - warning sanction does NOT block join
 *   AC#2 탈퇴 후 게시글/댓글 이력 보존
 *     - leave() removes the membership row but preserves the user's posts/comments
 *
 * Plus the new delta endpoints:
 *   - acceptRules() records rulesAcceptedAt + onboardingCompletedAt
 *   - updateNotificationSettings() toggles the 구독/알림 flag
 *
 * Real-DB integration style (mirrors community.service.spec.ts): skipped when
 * DATABASE_URL is absent.
 */

import { ForbiddenException } from "@nestjs/common";
import {
  communities,
  communityBans,
  communityComments,
  communityMemberships,
  communityPosts,
  communitySanctions,
} from "@repo/drizzle";
import { eq } from "drizzle-orm";
import {
  cleanupUser,
  endTestDb,
  ensureUser,
  getDrizzleDb,
  hasDb,
  newUserId,
} from "../../payment/__tests__/test-db";
import { CommunityService } from "./community.service";

const describeIfDb = hasDb ? describe : describe.skip;
jest.setTimeout(30_000);

describeIfDb("CommunityService — membership (BBR-591)", () => {
  let svc: CommunityService;
  let owner: string;
  let joiner: string;
  let createdCommunityIds: string[] = [];
  let createdUserIds: string[] = [];

  beforeAll(() => {
    svc = new CommunityService(getDrizzleDb());
  });

  beforeEach(async () => {
    owner = newUserId("mem-owner");
    joiner = newUserId("mem-joiner");
    await ensureUser(owner);
    await ensureUser(joiner);
    createdCommunityIds = [];
    createdUserIds = [owner, joiner];
  });

  afterEach(async () => {
    const db = getDrizzleDb();
    for (const id of createdCommunityIds) {
      await db.delete(communityComments).where(eq(communityComments.authorId, joiner));
      await db.delete(communityPosts).where(eq(communityPosts.communityId, id));
      await db.delete(communitySanctions).where(eq(communitySanctions.communityId, id));
      await db.delete(communityBans).where(eq(communityBans.communityId, id));
      await db.delete(communityMemberships).where(eq(communityMemberships.communityId, id));
      await db.delete(communities).where(eq(communities.id, id));
    }
    for (const uid of createdUserIds) {
      await cleanupUser(uid);
    }
  });

  afterAll(async () => {
    await endTestDb();
  });

  async function makeCommunity(type: "public" | "restricted" | "private" = "public") {
    const suffix = Math.random().toString(36).slice(2, 8);
    const c = await svc.create(
      {
        name: `mem-comm-${suffix}`,
        slug: `mem-comm-${suffix}`,
        description: "membership test community",
        type,
      } as never,
      owner,
    );
    createdCommunityIds.push(c.id);
    return c;
  }

  // ── AC#1 가입 제한 ────────────────────────────────────────────────────────

  it("blocks joining a private community", async () => {
    const c = await makeCommunity("private");
    await expect(svc.join(c.slug, joiner)).rejects.toThrow(ForbiddenException);
    await expect(svc.isMember(c.id, joiner)).resolves.toBe(false);
  });

  it("blocks joining when the user has an active community ban", async () => {
    const c = await makeCommunity("public");
    await getDrizzleDb()
      .insert(communityBans)
      .values({
        communityId: c.id,
        userId: joiner,
        bannedBy: owner,
        reason: "spam",
        isPermanent: true,
      });
    await expect(svc.join(c.slug, joiner)).rejects.toThrow(ForbiddenException);
    await expect(svc.isMember(c.id, joiner)).resolves.toBe(false);
  });

  it("blocks joining when the user has an active suspension sanction", async () => {
    const c = await makeCommunity("public");
    await getDrizzleDb()
      .insert(communitySanctions)
      .values({
        communityId: c.id,
        userId: joiner,
        moderatorId: owner,
        type: "suspension",
        status: "active",
        reason: "rule violation",
        expiresAt: new Date(Date.now() + 86_400_000),
      });
    await expect(svc.join(c.slug, joiner)).rejects.toThrow(ForbiddenException);
  });

  it("blocks joining when the user has an active permanent_ban sanction", async () => {
    const c = await makeCommunity("public");
    await getDrizzleDb()
      .insert(communitySanctions)
      .values({
        communityId: c.id,
        userId: joiner,
        moderatorId: owner,
        type: "permanent_ban",
        status: "active",
        reason: "severe violation",
      });
    await expect(svc.join(c.slug, joiner)).rejects.toThrow(ForbiddenException);
  });

  it("allows joining when the only sanction is a warning", async () => {
    const c = await makeCommunity("public");
    await getDrizzleDb()
      .insert(communitySanctions)
      .values({
        communityId: c.id,
        userId: joiner,
        moderatorId: owner,
        type: "warning",
        status: "active",
        reason: "minor",
      });
    const membership = await svc.join(c.slug, joiner);
    expect(membership.userId).toBe(joiner);
    await expect(svc.isMember(c.id, joiner)).resolves.toBe(true);
  });

  // ── AC#2 탈퇴 후 이력 보존 ─────────────────────────────────────────────────

  it("preserves the user's posts and comments after they leave", async () => {
    const db = getDrizzleDb();
    const c = await makeCommunity("public");
    await svc.join(c.slug, joiner);

    const inserted = await db
      .insert(communityPosts)
      .values({ communityId: c.id, authorId: joiner, title: "my post", content: "hi" })
      .returning();
    const post = inserted[0];
    if (!post) throw new Error("post insert failed");
    await db
      .insert(communityComments)
      .values({ postId: post.id, authorId: joiner, content: "my comment" });

    await svc.leave(c.slug, joiner);

    // 멤버십은 삭제되지만 게시글/댓글 이력은 보존된다.
    await expect(svc.isMember(c.id, joiner)).resolves.toBe(false);
    const posts = await db
      .select()
      .from(communityPosts)
      .where(eq(communityPosts.id, post.id));
    expect(posts).toHaveLength(1);
    const comments = await db
      .select()
      .from(communityComments)
      .where(eq(communityComments.postId, post.id));
    expect(comments).toHaveLength(1);
  });

  // ── 규칙 동의 / 구독 설정 ──────────────────────────────────────────────────

  it("acceptRules() records rulesAcceptedAt + onboardingCompletedAt", async () => {
    const c = await makeCommunity("public");
    await svc.join(c.slug, joiner);

    const updated = await svc.acceptRules(c.slug, joiner);
    expect(updated.rulesAcceptedAt).toBeInstanceOf(Date);
    expect(updated.onboardingCompletedAt).toBeInstanceOf(Date);
  });

  it("acceptRules() forbids non-members", async () => {
    const c = await makeCommunity("public");
    await expect(svc.acceptRules(c.slug, joiner)).rejects.toThrow(ForbiddenException);
  });

  it("updateNotificationSettings() toggles the subscription flag", async () => {
    const c = await makeCommunity("public");
    await svc.join(c.slug, joiner);

    const off = await svc.updateNotificationSettings(c.slug, joiner, false);
    expect(off.notificationsEnabled).toBe(false);
    const on = await svc.updateNotificationSettings(c.slug, joiner, true);
    expect(on.notificationsEnabled).toBe(true);
  });

  it("updateNotificationSettings() forbids non-members", async () => {
    const c = await makeCommunity("public");
    await expect(svc.updateNotificationSettings(c.slug, joiner, false)).rejects.toThrow(
      ForbiddenException,
    );
  });
});
