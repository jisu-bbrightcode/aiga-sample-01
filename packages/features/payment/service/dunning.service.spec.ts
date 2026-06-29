/**
 * DunningService — state machine tests (Phase 6 / G5).
 *
 * Real DB. Each test uses fresh org/user/plan/sub ids so rows don't collide
 * across runs; afterEach cleans up.
 *
 *   1. markPastDue: active → past_due, pastDueSince set
 *   2. markPastDue idempotent: re-firing keeps the original pastDueSince
 *   3. tick: past_due (8 days old) → grace, grace_ends_at = pastDueSince + 7d
 *   4. tick: grace expired → canceled + data_purge_at = now + 30d
 *   5. reactivate: past_due → active (timestamps cleared)
 *   6. reactivate: grace → active (INV-2 satisfied — graceEndsAt cleared)
 *   7. releaseSoftSuspend writes audit log
 */
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { paymentAuditLog, paymentSubscriptions } from "@repo/drizzle";
import {
  cleanupOrg,
  cleanupPlan,
  cleanupUser,
  endTestDb,
  ensureOrg,
  ensurePlan,
  ensureSubscription,
  ensureUser,
  getDrizzleDb,
  hasDb,
  newOrgId,
  newUserId,
} from "../__tests__/test-db";
import { type AuditService, DunningService } from "./dunning.service";

const describeIfDb = hasDb ? describe : describe.skip;

const DAY_MS = 86_400_000;

describeIfDb("DunningService", () => {
  let svc: DunningService;
  let orgId: string;
  let userId: string;
  let planId: string;
  let subId: string;
  let polarSubId: string;

  beforeAll(() => {
    svc = new DunningService(getDrizzleDb());
  });

  beforeEach(async () => {
    orgId = newOrgId("dun");
    userId = newUserId("dun");
    planId = randomUUID();
    subId = randomUUID();
    polarSubId = `polar_${subId}`;
    await ensureOrg(orgId);
    await ensureUser(userId);
    await ensurePlan(planId, { priceCents: 1999, slug: `dun-${planId.slice(0, 8)}` });
  });

  afterEach(async () => {
    await cleanupOrg(orgId);
    await cleanupPlan(planId);
    await cleanupUser(userId);
  });

  afterAll(async () => {
    await endTestDb();
  });

  // ── Helpers ────────────────────────────────────────────────────────

  async function readSub() {
    const rows = await getDrizzleDb()
      .select()
      .from(paymentSubscriptions)
      .where(eq(paymentSubscriptions.id, subId));
    return rows[0]!;
  }

  // ── Tests ──────────────────────────────────────────────────────────

  it("markPastDue: active → past_due + pastDueSince set", async () => {
    await ensureSubscription(subId, {
      orgId,
      userId,
      planId,
      polarSubId,
      status: "active",
    });

    await svc.markPastDue({ polarSubscriptionId: polarSubId, reason: "card declined" });

    const r = await readSub();
    expect(r.status).toBe("past_due");
    expect(r.pastDueSince).toBeInstanceOf(Date);
  });

  it("markPastDue is idempotent — second call keeps original pastDueSince", async () => {
    await ensureSubscription(subId, {
      orgId,
      userId,
      planId,
      polarSubId,
      status: "active",
    });

    await svc.markPastDue({ polarSubscriptionId: polarSubId });
    const first = (await readSub()).pastDueSince!;
    // Wait a few ms so a (broken) impl that re-stamps would visibly differ.
    await new Promise((r) => setTimeout(r, 25));
    await svc.markPastDue({ polarSubscriptionId: polarSubId });
    const second = (await readSub()).pastDueSince!;

    expect(second.getTime()).toBe(first.getTime());
  });

  it("tick: past_due → grace + grace_ends_at = pastDueSince + 7d", async () => {
    // 3-days-ago past_due — within the 7-day grace window so the same tick
    // doesn't immediately cascade to canceled.
    const threeDaysAgo = new Date(Date.now() - 3 * DAY_MS);
    await ensureSubscription(subId, {
      orgId,
      userId,
      planId,
      polarSubId,
      status: "past_due",
      pastDueSince: threeDaysAgo,
    });

    const out = await svc.tick(new Date());
    expect(out.enteredGrace).toBe(1);
    expect(out.canceledFromGrace).toBe(0);

    const r = await readSub();
    expect(r.status).toBe("grace");
    expect(r.graceEndsAt).toBeInstanceOf(Date);
    // grace_ends_at = past_due_since + 7d (within 1 second tolerance for round-trip)
    const expected = threeDaysAgo.getTime() + 7 * DAY_MS;
    expect(Math.abs(r.graceEndsAt!.getTime() - expected)).toBeLessThan(1000);
  });

  it("tick: past_due > 7d cascades past_due → grace → canceled in one tick", async () => {
    // 10-days-ago past_due — grace_ends_at would be 3 days ago, so the
    // grace→canceled pass picks it up in the same tick. This is intentional
    // (spec §4.4) — the cron is daily so we don't want a stale row to wait.
    const tenDaysAgo = new Date(Date.now() - 10 * DAY_MS);
    await ensureSubscription(subId, {
      orgId,
      userId,
      planId,
      polarSubId,
      status: "past_due",
      pastDueSince: tenDaysAgo,
    });

    const out = await svc.tick(new Date());
    expect(out.enteredGrace).toBe(1);
    expect(out.canceledFromGrace).toBe(1);

    const r = await readSub();
    expect(r.status).toBe("canceled");
    expect(r.dataPurgeAt).toBeInstanceOf(Date);
  });

  it("tick: grace 만료 → canceled + data_purge_at = now + 30d", async () => {
    const fifteenDaysAgo = new Date(Date.now() - 15 * DAY_MS);
    const yesterday = new Date(Date.now() - DAY_MS);
    await ensureSubscription(subId, {
      orgId,
      userId,
      planId,
      polarSubId,
      status: "grace",
      pastDueSince: fifteenDaysAgo,
      graceEndsAt: yesterday,
    });

    const now = new Date();
    const out = await svc.tick(now);
    expect(out.canceledFromGrace).toBe(1);

    const r = await readSub();
    expect(r.status).toBe("canceled");
    expect(r.canceledAt).toBeInstanceOf(Date);
    expect(r.dataPurgeAt).toBeInstanceOf(Date);
    const expectedPurge = now.getTime() + 30 * DAY_MS;
    expect(Math.abs(r.dataPurgeAt!.getTime() - expectedPurge)).toBeLessThan(1000);
  });

  it("reactivate: past_due → active, timestamps cleared", async () => {
    const yesterday = new Date(Date.now() - DAY_MS);
    await ensureSubscription(subId, {
      orgId,
      userId,
      planId,
      polarSubId,
      status: "past_due",
      pastDueSince: yesterday,
    });

    const out = await svc.reactivate({ subscriptionId: subId });
    expect(out.ok).toBe(true);

    const r = await readSub();
    expect(r.status).toBe("active");
    expect(r.pastDueSince).toBeNull();
    expect(r.graceEndsAt).toBeNull();
    expect(r.dataPurgeAt).toBeNull();
  });

  it("reactivate: grace → active (INV-2 satisfied — graceEndsAt cleared)", async () => {
    const tenDaysAgo = new Date(Date.now() - 10 * DAY_MS);
    const threeDaysAhead = new Date(Date.now() + 3 * DAY_MS);
    await ensureSubscription(subId, {
      orgId,
      userId,
      planId,
      polarSubId,
      status: "grace",
      pastDueSince: tenDaysAgo,
      graceEndsAt: threeDaysAhead,
    });

    const out = await svc.reactivate({ subscriptionId: subId });
    expect(out.ok).toBe(true);

    const r = await readSub();
    expect(r.status).toBe("active");
    expect(r.graceEndsAt).toBeNull(); // INV-2: status<>'grace' OR graceEndsAt NOT NULL
    expect(r.pastDueSince).toBeNull();
  });

  it("releaseSoftSuspend writes audit log via injected service", async () => {
    const tenDaysAgo = new Date(Date.now() - 10 * DAY_MS);
    const threeDaysAhead = new Date(Date.now() + 3 * DAY_MS);
    await ensureSubscription(subId, {
      orgId,
      userId,
      planId,
      polarSubId,
      status: "grace",
      pastDueSince: tenDaysAgo,
      graceEndsAt: threeDaysAhead,
    });

    const calls: Parameters<AuditService["log"]>[0][] = [];
    const audit: AuditService = {
      log: async (e) => {
        calls.push(e);
      },
    };
    const svcWithAudit = new DunningService(getDrizzleDb(), { audit });

    const out = await svcWithAudit.releaseSoftSuspend({
      subscriptionId: subId,
      actorUserId: userId,
      reason: "manual override after dispute",
    });
    expect(out.ok).toBe(true);
    expect(calls).toHaveLength(1);
    const entry = calls[0]!;
    expect(entry.actorUserId).toBe(userId);
    expect(entry.action).toBe("release_soft_suspend");
    expect(entry.targetSubscriptionId).toBe(subId);
    expect(entry.targetOrgId).toBe(orgId);
    expect(entry.reason).toBe("manual override after dispute");

    const r = await readSub();
    expect(r.status).toBe("active");

    // No DB-side audit row written when audit service is injected (the
    // injected callback is the system-of-record).
    const auditRows = await getDrizzleDb()
      .select()
      .from(paymentAuditLog)
      .where(eq(paymentAuditLog.targetSubscriptionId, subId));
    expect(auditRows).toHaveLength(0);
  });
});
