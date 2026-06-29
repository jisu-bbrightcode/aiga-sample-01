/**
 * ExtraUsageService — DB-backed tests (T4).
 *
 *   1. getSettings — org 의 row 반환
 *   2. updateSettings — partial update + audit log row 1개
 *   3. handleInsufficient — enabled=false → throw 'insufficient_balance'
 *   4. handleInsufficient — enabled=true, autoRechargeEnabled=false → throw 'limit_reached_extra_usage_disabled'
 *   5. handleInsufficient — enabled=true, autoRechargeEnabled=true, package=null → throw 'auto_recharge_package_not_configured'
 *   6. handleInsufficient — monthly_limit 초과 → throw 'monthly_limit_reached'
 *   7. getUsageStats — accumulated/cycleEnd/monthly_limit/paid_balance 정상 반환
 */
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  paymentAuditLog,
  paymentExtraUsageSettings,
  paymentSubscriptions,
  paymentUsageLedger,
} from "@repo/drizzle";
import {
  cleanupOrg,
  cleanupPlan,
  cleanupUser,
  endTestDb,
  ensureOrg,
  ensurePlan,
  ensureUser,
  getDrizzleDb,
  hasDb,
  newOrgId,
  newUserId,
} from "../__tests__/test-db";
import { ExtraUsageService } from "./extra-usage.service";

jest.setTimeout(30_000);

const describeIfDb = hasDb ? describe : describe.skip;

describeIfDb("ExtraUsageService", () => {
  let svc: ExtraUsageService;
  let orgId: string;
  let userId: string;
  let planId: string;

  beforeAll(() => {
    svc = new ExtraUsageService(getDrizzleDb());
  });

  afterAll(async () => {
    await endTestDb();
  });

  beforeEach(async () => {
    orgId = newOrgId("extra-usage");
    userId = newUserId("extra-usage");
    planId = randomUUID();
    await ensureOrg(orgId);
    await ensureUser(userId);
    await ensurePlan(planId, { priceCents: 1999 });

    // extra_usage_settings row 시드
    await getDrizzleDb().insert(paymentExtraUsageSettings).values({
      organizationId: orgId,
      enabled: false,
      monthlyLimitCents: 10_000,
      autoRechargeEnabled: false,
      autoRechargeThresholdCents: 500,
      autoRechargePackageId: null,
    });

    // active subscription
    await getDrizzleDb().insert(paymentSubscriptions).values({
      polarSubscriptionId: `sub_extra_${orgId}`,
      organizationId: orgId,
      userId,
      planId,
      status: "active",
      currentPeriodStart: new Date("2026-04-01"),
      currentPeriodEnd: new Date("2026-05-01"),
      cachedPaidBalanceCents: 5_000,
    });
  });

  afterEach(async () => {
    const db = getDrizzleDb();
    await db
      .delete(paymentUsageLedger)
      .where(eq(paymentUsageLedger.organizationId, orgId));
    await db
      .delete(paymentAuditLog)
      .where(eq(paymentAuditLog.targetOrgId, orgId));
    await db
      .delete(paymentExtraUsageSettings)
      .where(eq(paymentExtraUsageSettings.organizationId, orgId));
    await cleanupOrg(orgId);
    await cleanupUser(userId);
    await cleanupPlan(planId);
  });

  it("getSettings — org 의 row 반환", async () => {
    const row = await svc.getSettings(orgId);
    expect(row.organizationId).toBe(orgId);
    expect(row.monthlyLimitCents).toBe(10_000);
    expect(row.enabled).toBe(false);
  });

  it("updateSettings — partial update + audit log row 1개", async () => {
    await svc.updateSettings(orgId, { enabled: true, monthlyLimitCents: 20_000 }, userId);

    const row = await svc.getSettings(orgId);
    expect(row.enabled).toBe(true);
    expect(row.monthlyLimitCents).toBe(20_000);
    // autoRechargeEnabled 는 변경되지 않아야 함
    expect(row.autoRechargeEnabled).toBe(false);

    const auditRows = await getDrizzleDb()
      .select()
      .from(paymentAuditLog)
      .where(
        and(
          eq(paymentAuditLog.targetOrgId, orgId),
          eq(paymentAuditLog.action, "extra_usage_settings_updated"),
        ),
      );
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]!.actorUserId).toBe(userId);
  });

  it("handleInsufficient — enabled=false → throw 'insufficient_balance'", async () => {
    // enabled=false, monthly_limit=10000, accumulated=0 → monthly 미초과이지만 enabled=false
    await expect(svc.handleInsufficient(orgId, 100)).rejects.toThrow("insufficient_balance");
  });

  it("handleInsufficient — enabled=true, autoRechargeEnabled=false → throw 'limit_reached_extra_usage_disabled'", async () => {
    await getDrizzleDb()
      .update(paymentExtraUsageSettings)
      .set({ enabled: true, autoRechargeEnabled: false })
      .where(eq(paymentExtraUsageSettings.organizationId, orgId));

    await expect(svc.handleInsufficient(orgId, 100)).rejects.toThrow(
      "limit_reached_extra_usage_disabled",
    );
  });

  it("handleInsufficient — enabled=true, autoRechargeEnabled=true, package=null → throw 'auto_recharge_package_not_configured'", async () => {
    await getDrizzleDb()
      .update(paymentExtraUsageSettings)
      .set({ enabled: true, autoRechargeEnabled: true, autoRechargePackageId: null })
      .where(eq(paymentExtraUsageSettings.organizationId, orgId));

    await expect(svc.handleInsufficient(orgId, 100)).rejects.toThrow(
      "auto_recharge_package_not_configured",
    );
  });

  it("handleInsufficient — monthly_limit 초과 → throw 'monthly_limit_reached'", async () => {
    // monthly_limit=10000, estimateCents=10001 → 0+10001 > 10000
    await expect(svc.handleInsufficient(orgId, 10_001)).rejects.toThrow("monthly_limit_reached");
  });

  it("getSettings — row 없으면 lazy init (Free = 0 cents)", async () => {
    // 이미 beforeEach 가 settings row 를 삽입했으므로, 별도 orgId 사용
    const lazyOrgId = newOrgId("lazy-free");
    await ensureOrg(lazyOrgId);
    try {
      // settings row 없음 → lazy init → Free 기본값 monthlyLimitCents=0
      const settings = await svc.getSettings(lazyOrgId);
      expect(settings.organizationId).toBe(lazyOrgId);
      expect(settings.monthlyLimitCents).toBe(0);
      expect(settings.enabled).toBe(false);
    } finally {
      await getDrizzleDb()
        .delete(paymentExtraUsageSettings)
        .where(eq(paymentExtraUsageSettings.organizationId, lazyOrgId));
      await cleanupOrg(lazyOrgId);
    }
  });

  it("getSettings — row 없으면 lazy init (Pro plan = 5000 cents)", async () => {
    const lazyOrgId = newOrgId("lazy-pro");
    const lazyUserId = newUserId("lazy-pro");
    const lazyPlanId = randomUUID();
    await ensureOrg(lazyOrgId);
    await ensureUser(lazyUserId);
    await ensurePlan(lazyPlanId, { slug: `pro_monthly_${lazyPlanId.slice(0, 8)}`, priceCents: 1999 });
    await getDrizzleDb().insert(paymentSubscriptions).values({
      polarSubscriptionId: `sub_lazy_${lazyOrgId}`,
      organizationId: lazyOrgId,
      userId: lazyUserId,
      planId: lazyPlanId,
      status: "active",
      currentPeriodStart: new Date("2026-04-01"),
      currentPeriodEnd: new Date("2026-05-01"),
      cachedPaidBalanceCents: 0,
    });
    try {
      const settings = await svc.getSettings(lazyOrgId);
      expect(settings.monthlyLimitCents).toBe(5_000);
      expect(settings.enabled).toBe(false);
    } finally {
      await getDrizzleDb()
        .delete(paymentExtraUsageSettings)
        .where(eq(paymentExtraUsageSettings.organizationId, lazyOrgId));
      await getDrizzleDb()
        .delete(paymentSubscriptions)
        .where(eq(paymentSubscriptions.organizationId, lazyOrgId));
      await cleanupOrg(lazyOrgId);
      await cleanupUser(lazyUserId);
      await cleanupPlan(lazyPlanId);
    }
  });

  it("getUsageStats — accumulated/cycleEnd/monthly_limit/paid_balance 정상 반환", async () => {
    // payment_usage_ledger 에 ai_usage row 삽입 (delta_cents=-300 = 300 cents 사용)
    await getDrizzleDb().insert(paymentUsageLedger).values({
      organizationId: orgId,
      deltaCents: -300,
      balanceAfterCents: 4_700,
      reason: "ai_usage",
      refType: "usage_claim",
      refId: `claim_stats_${orgId}`,
      periodStart: new Date("2026-04-01"),
      periodEnd: new Date("2026-05-01"),
    });

    const stats = await svc.getUsageStats(orgId);
    expect(stats.monthlyLimitCents).toBe(10_000);
    expect(stats.accumulatedCents).toBe(300);
    expect(stats.remainingCents).toBe(9_700);
    expect(stats.paidBalanceCents).toBe(5_000);
    expect(stats.cycleEnd).toEqual(new Date("2026-05-01"));
  });
});
