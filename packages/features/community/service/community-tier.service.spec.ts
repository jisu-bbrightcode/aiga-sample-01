import { NotFoundException } from "@nestjs/common";
import { communityMemberships, userKarma } from "@repo/drizzle";
import { and, eq, inArray } from "drizzle-orm";
import { endTestDb, getDrizzleDb, hasDb, newUserId } from "../../payment/__tests__/test-db";
import { addExtraMember, cleanupExtraMember, setupCommunityCtx } from "./__tests__/test-helpers";
import { CommunityTierService } from "./community-tier.service";

const describeIfDb = hasDb ? describe : describe.skip;
jest.setTimeout(30_000);

describeIfDb("CommunityTierService", () => {
  let svc: CommunityTierService;
  let ctx: Awaited<ReturnType<typeof setupCommunityCtx>>["ctx"];
  let teardown: () => Promise<void>;
  let memberId: string;
  const userIdsForKarma: string[] = [];

  beforeAll(() => {
    svc = new CommunityTierService(getDrizzleDb());
  });

  beforeEach(async () => {
    const setup = await setupCommunityCtx("tier");
    ctx = setup.ctx;
    teardown = setup.teardown;
    memberId = await addExtraMember("tier", ctx.communityId);
    userIdsForKarma.length = 0;
  });

  afterEach(async () => {
    const db = getDrizzleDb();
    if (userIdsForKarma.length > 0) {
      await db.delete(userKarma).where(inArray(userKarma.userId, userIdsForKarma));
    }
    await cleanupExtraMember(memberId);
    await teardown();
  });

  afterAll(async () => {
    await endTestDb();
  });

  async function setKarma(userId: string, total: number) {
    userIdsForKarma.push(userId);
    await getDrizzleDb()
      .insert(userKarma)
      .values({ userId, postKarma: total, commentKarma: 0, totalKarma: total })
      .onConflictDoUpdate({
        target: userKarma.userId,
        set: { totalKarma: total },
      });
  }

  it("refreshTier() maps totalKarma onto the right tier", async () => {
    await setKarma(memberId, 0);
    await expect(svc.refreshTier(ctx.communityId, memberId)).resolves.toBe("newcomer");

    await setKarma(memberId, 10);
    await expect(svc.refreshTier(ctx.communityId, memberId)).resolves.toBe("member");

    await setKarma(memberId, 100);
    await expect(svc.refreshTier(ctx.communityId, memberId)).resolves.toBe("contributor");

    await setKarma(memberId, 500);
    await expect(svc.refreshTier(ctx.communityId, memberId)).resolves.toBe("trusted");

    await setKarma(memberId, 1000);
    await expect(svc.refreshTier(ctx.communityId, memberId)).resolves.toBe("leader");
  });

  it("refreshTier() persists tier on the membership row", async () => {
    await setKarma(memberId, 100);
    await svc.refreshTier(ctx.communityId, memberId);
    const [row] = await getDrizzleDb()
      .select({ tier: communityMemberships.tier })
      .from(communityMemberships)
      .where(
        and(
          eq(communityMemberships.communityId, ctx.communityId),
          eq(communityMemberships.userId, memberId),
        ),
      );
    expect(row?.tier).toBe("contributor");
  });

  it("getTierInfo() returns tier + privileges", async () => {
    await setKarma(memberId, 100);
    await svc.refreshTier(ctx.communityId, memberId);
    const info = await svc.getTierInfo(ctx.communityId, memberId);
    expect(info.tier).toBe("contributor");
    expect(info.privileges).toBeDefined();
    expect(info.privileges.maxPostsPerDay).toBeGreaterThan(0);
  });

  it("getTierInfo() falls back to 'newcomer' for non-members", async () => {
    const stranger = newUserId("tier-stranger");
    const info = await svc.getTierInfo(ctx.communityId, stranger);
    expect(info.tier).toBe("newcomer");
  });

  it("completeOnboarding + acceptRules + getOnboardingStatus round-trip", async () => {
    const beforeOb = await svc.getOnboardingStatus(ctx.communityId, memberId);
    expect(beforeOb.isOnboarded).toBe(false);
    expect(beforeOb.hasAcceptedRules).toBe(false);

    await svc.completeOnboarding(ctx.communityId, memberId);
    await svc.acceptRules(ctx.communityId, memberId);

    const after = await svc.getOnboardingStatus(ctx.communityId, memberId);
    expect(after.isOnboarded).toBe(true);
    expect(after.hasAcceptedRules).toBe(true);
  });

  it("getOnboardingStatus() throws NotFoundException for non-members", async () => {
    const stranger = newUserId("tier-no-member");
    await expect(svc.getOnboardingStatus(ctx.communityId, stranger)).rejects.toThrow(
      NotFoundException,
    );
  });
});
