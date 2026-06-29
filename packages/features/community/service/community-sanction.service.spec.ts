/**
 * CommunitySanctionService — warn / suspend / ban + appeal flow.
 */

import { communityAppeals, communityModLogs, communitySanctions } from "@repo/drizzle";
import { eq, inArray } from "drizzle-orm";
import { endTestDb, getDrizzleDb, hasDb } from "../../payment/__tests__/test-db";
import { addExtraMember, cleanupExtraMember, setupCommunityCtx } from "./__tests__/test-helpers";
import { CommunitySanctionService } from "./community-sanction.service";

const describeIfDb = hasDb ? describe : describe.skip;
jest.setTimeout(30_000);

describeIfDb("CommunitySanctionService", () => {
  let svc: CommunitySanctionService;
  let ctx: Awaited<ReturnType<typeof setupCommunityCtx>>["ctx"];
  let target: string;
  let teardown: () => Promise<void>;
  const createdSanctionIds: string[] = [];

  beforeAll(() => {
    svc = new CommunitySanctionService(getDrizzleDb());
  });

  beforeEach(async () => {
    const setup = await setupCommunityCtx("sanc");
    ctx = setup.ctx;
    teardown = setup.teardown;
    target = await addExtraMember("sanc", ctx.communityId);
    createdSanctionIds.length = 0;
  });

  afterEach(async () => {
    const db = getDrizzleDb();
    if (createdSanctionIds.length > 0) {
      await db
        .delete(communityAppeals)
        .where(inArray(communityAppeals.sanctionId, createdSanctionIds));
      await db.delete(communitySanctions).where(inArray(communitySanctions.id, createdSanctionIds));
    }
    await db.delete(communityModLogs).where(eq(communityModLogs.communityId, ctx.communityId));
    await cleanupExtraMember(target);
    await teardown();
  });

  afterAll(async () => {
    await endTestDb();
  });

  async function warn(reason = "rule violation") {
    const s = await svc.applySanction({
      communityId: ctx.communityId,
      userId: target,
      moderatorId: ctx.ownerId,
      type: "warning",
      reason,
    });
    createdSanctionIds.push(s.id);
    return s;
  }

  it("applySanction(warning) creates an active sanction without expiry", async () => {
    const s = await warn();
    expect(s.type).toBe("warning");
    expect(s.status).toBe("active");
    expect(s.expiresAt).toBeNull();
  });

  it("applySanction(suspension) sets expiresAt to ~7 days from now", async () => {
    const s = await svc.applySanction({
      communityId: ctx.communityId,
      userId: target,
      moderatorId: ctx.ownerId,
      type: "suspension",
      reason: "x",
    });
    createdSanctionIds.push(s.id);
    expect(s.expiresAt).toBeInstanceOf(Date);
    const diffDays = (s.expiresAt!.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    expect(diffDays).toBeGreaterThan(6.9);
    expect(diffDays).toBeLessThan(7.1);
  });

  it("getActiveSanction() returns the most recent active sanction", async () => {
    await warn("first");
    const active = await svc.getActiveSanction(ctx.communityId, target);
    expect(active?.reason).toBe("first");
  });

  it("getSanctionHistory() returns rows in newest-first order", async () => {
    const a = await warn("a");
    // Small delay so the second insert has a strictly later timestamp.
    await new Promise((r) => setTimeout(r, 5));
    const b = await warn("b");
    const history = await svc.getSanctionHistory(ctx.communityId, target);
    expect(history.map((s) => s.id)).toEqual([b.id, a.id]);
  });

  it("submitAppeal() creates a pending appeal row", async () => {
    const s = await warn();
    const a = await svc.submitAppeal(s.id, target, "this is unfair");
    expect(a.sanctionId).toBe(s.id);
    expect(a.userId).toBe(target);
    expect(a.status).toBe("pending");
  });

  it("resolveAppeal() forbids the original moderator from reviewing their own sanction", async () => {
    const s = await warn();
    const a = await svc.submitAppeal(s.id, target, "please");
    // ctx.ownerId is the moderator who issued the sanction. Same-actor review
    // is blocked at the service layer (ForbiddenException).
    await expect(
      svc.resolveAppeal({
        appealId: a.id,
        reviewerId: ctx.ownerId,
        status: "overturned",
        reviewNote: "ok",
      }),
    ).rejects.toThrow();
  });

  it("getPendingAppeals() returns only pending appeals for the community", async () => {
    const s = await warn();
    const a = await svc.submitAppeal(s.id, target, "x");
    const pending = await svc.getPendingAppeals(ctx.communityId);
    expect(pending.some((p) => p.id === a.id)).toBe(true);
  });
});
