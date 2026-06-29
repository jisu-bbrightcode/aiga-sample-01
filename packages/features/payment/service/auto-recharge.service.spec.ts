/**
 * AutoRechargeService — DB-backed tests (T5).
 *
 * 케이스:
 *   1. trigger — pending row insert + advisory lock + Polar createCheckout 호출
 *   2. trigger 동시 — 두 번째 throw 'auto_recharge_already_in_progress'
 *   3. trigger — monthly cap 초과 시 throw 'monthly_recharge_cap_exceeded'
 *   4. trigger — package=null → throw 'auto_recharge_package_not_configured'
 *   5. trigger — comp_* polarSubscriptionId 차단
 *   6. onOrderPaid — recharge_history.status='paid' + payment_usage_ledger insert + cached_paid_balance update
 */
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  paymentExtraUsageSettings,
  paymentRechargeHistory,
  paymentSubscriptions,
  paymentTopUpPackages,
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
import type { PolarAdapter } from "./polar.adapter";
import { AutoRechargeService } from "./auto-recharge.service";

jest.setTimeout(30_000);

const describeIfDb = hasDb ? describe : describe.skip;

describeIfDb("AutoRechargeService", () => {
  let svc: AutoRechargeService;
  let polarMock: { createCheckout: jest.Mock };
  let orgId: string;
  let userId: string;
  let planId: string;
  let packageId: string;

  beforeAll(() => {
    // polarMock 은 beforeEach 에서 초기화
  });

  afterAll(async () => {
    await endTestDb();
  });

  beforeEach(async () => {
    orgId = newOrgId("auto-recharge");
    userId = newUserId("auto-recharge");
    planId = randomUUID();
    packageId = randomUUID();

    polarMock = {
      createCheckout: jest.fn(async () => ({
        url: "https://polar.sh/checkout/x",
        checkoutId: "ck_1",
      })),
    };
    svc = new AutoRechargeService(getDrizzleDb(), polarMock as unknown as PolarAdapter);

    await ensureOrg(orgId);
    await ensureUser(userId);
    await ensurePlan(planId, { priceCents: 1999 });

    // top-up package 시드
    await getDrizzleDb().insert(paymentTopUpPackages).values({
      id: packageId,
      polarProductId: `prod_auto_${packageId.slice(0, 8)}`,
      polarPriceId: `price_auto_${packageId.slice(0, 8)}`,
      slug: `auto-pkg-${packageId.slice(0, 8)}`,
      name: "Auto Recharge Pack",
      credits: 1000,
      priceCents: 500,
      currency: "USD",
    });

    // extra_usage_settings 시드
    await getDrizzleDb().insert(paymentExtraUsageSettings).values({
      organizationId: orgId,
      enabled: true,
      monthlyLimitCents: 100_000,
      autoRechargeEnabled: true,
      autoRechargeThresholdCents: 500,
      autoRechargePackageId: packageId,
      monthlyRechargeCapCount: 3,
    });

    // active subscription 시드
    await getDrizzleDb().insert(paymentSubscriptions).values({
      polarSubscriptionId: `polar_sub_ar_${orgId.slice(0, 8)}`,
      organizationId: orgId,
      userId,
      planId,
      status: "active",
      currentPeriodStart: new Date("2026-04-01"),
      currentPeriodEnd: new Date("2026-05-01"),
      cachedPaidBalanceCents: 0,
    });
  });

  afterEach(async () => {
    const db = getDrizzleDb();
    // recharge_history 정리 (FK: package_id → top_up_packages, org_id → organizations)
    await db
      .delete(paymentRechargeHistory)
      .where(eq(paymentRechargeHistory.organizationId, orgId));
    // usage_ledger 정리
    await db
      .delete(paymentUsageLedger)
      .where(eq(paymentUsageLedger.organizationId, orgId));
    // extra_usage_settings 정리
    await db
      .delete(paymentExtraUsageSettings)
      .where(eq(paymentExtraUsageSettings.organizationId, orgId));
    // subscriptions 정리
    await db
      .delete(paymentSubscriptions)
      .where(eq(paymentSubscriptions.organizationId, orgId));
    // top_up_packages 정리
    await db
      .delete(paymentTopUpPackages)
      .where(eq(paymentTopUpPackages.id, packageId));
    await cleanupOrg(orgId);
    await cleanupUser(userId);
    await cleanupPlan(planId);
  });

  // ── 케이스 1: trigger — pending row insert + Polar createCheckout 호출 ──
  it("trigger — pending row insert + Polar createCheckout 호출", async () => {
    const result = await svc.trigger(orgId);

    expect(result.checkoutUrl).toBe("https://polar.sh/checkout/x");
    expect(result.rechargeHistoryId).toBeTruthy();
    expect(polarMock.createCheckout).toHaveBeenCalledTimes(1);

    const [history] = await getDrizzleDb()
      .select()
      .from(paymentRechargeHistory)
      .where(eq(paymentRechargeHistory.id, result.rechargeHistoryId));

    // trigger 호출 직후는 여전히 pending (onOrderPaid 전)
    expect(history).toBeTruthy();
    expect(history!.status).toBe("pending");
    expect(history!.organizationId).toBe(orgId);
    expect(history!.packageId).toBe(packageId);
    expect(history!.amountCents).toBe(500);
  });

  // ── 케이스 2: trigger 동시 — 두 번째 throw 'auto_recharge_already_in_progress' ──
  it("trigger 동시 — pending row 존재 시 두 번째 throw", async () => {
    await svc.trigger(orgId);

    await expect(svc.trigger(orgId)).rejects.toThrow("auto_recharge_already_in_progress");
    // Polar checkout 은 첫 번째만 호출
    expect(polarMock.createCheckout).toHaveBeenCalledTimes(1);
  });

  // ── 케이스 3: monthly cap 초과 ──
  it("trigger — monthly cap 초과 시 throw 'monthly_recharge_cap_exceeded'", async () => {
    // cap_count=3 + pending+paid 이미 3개 시드
    const periodStart = new Date("2026-04-01");
    const periodEnd = new Date("2026-05-01");
    const db = getDrizzleDb();

    for (let i = 0; i < 3; i++) {
      await db.insert(paymentRechargeHistory).values({
        organizationId: orgId,
        periodStart,
        periodEnd,
        triggerReason: "threshold",
        packageId,
        amountCents: 500,
        idempotencyKey: `${orgId}:${periodStart.toISOString()}:${i + 1}`,
        status: "paid",
        polarOrderId: `order_seed_${i}`,
        attemptedAt: new Date(),
        completedAt: new Date(),
      });
    }

    // 4번째 trigger → cap 초과
    await expect(svc.trigger(orgId)).rejects.toThrow("monthly_recharge_cap_exceeded");
    expect(polarMock.createCheckout).not.toHaveBeenCalled();
  });

  // ── 케이스 4: package=null → throw ──
  it("trigger — autoRechargePackageId=null → throw 'auto_recharge_package_not_configured'", async () => {
    await getDrizzleDb()
      .update(paymentExtraUsageSettings)
      .set({ autoRechargePackageId: null })
      .where(eq(paymentExtraUsageSettings.organizationId, orgId));

    await expect(svc.trigger(orgId)).rejects.toThrow("auto_recharge_package_not_configured");
    expect(polarMock.createCheckout).not.toHaveBeenCalled();
  });

  // ── 케이스 5: comp_* polarSubscriptionId 차단 ──
  it("trigger — comp_* polarSubscriptionId 차단", async () => {
    await getDrizzleDb()
      .update(paymentSubscriptions)
      .set({ polarSubscriptionId: "comp_admin_free_forever" })
      .where(eq(paymentSubscriptions.organizationId, orgId));

    await expect(svc.trigger(orgId)).rejects.toThrow(/non-Polar subscription/);
    expect(polarMock.createCheckout).not.toHaveBeenCalled();
  });

  // ── 케이스 6: onOrderPaid — status='paid' + ledger insert + cached_paid_balance update ──
  it("onOrderPaid — recharge_history.status='paid' + usage_ledger insert + cached_paid_balance update", async () => {
    // trigger → pending row 생성
    const { rechargeHistoryId } = await svc.trigger(orgId);
    const polarOrderId = `order_${randomUUID()}`;

    // paid 전 cached_balance 확인
    const [subBefore] = await getDrizzleDb()
      .select()
      .from(paymentSubscriptions)
      .where(eq(paymentSubscriptions.organizationId, orgId))
      .limit(1);
    const balanceBefore = subBefore!.cachedPaidBalanceCents ?? 0;

    // webhook 처리
    await svc.onOrderPaid(rechargeHistoryId, polarOrderId, 500);

    // recharge_history status='paid'
    const [history] = await getDrizzleDb()
      .select()
      .from(paymentRechargeHistory)
      .where(eq(paymentRechargeHistory.id, rechargeHistoryId));
    expect(history!.status).toBe("paid");
    expect(history!.polarOrderId).toBe(polarOrderId);

    // usage_ledger row insert
    const ledgerRows = await getDrizzleDb()
      .select()
      .from(paymentUsageLedger)
      .where(
        and(
          eq(paymentUsageLedger.organizationId, orgId),
          eq(paymentUsageLedger.reason, "auto_recharge"),
        ),
      );
    expect(ledgerRows).toHaveLength(1);
    expect(ledgerRows[0]!.deltaCents).toBe(500);
    expect(ledgerRows[0]!.refType).toBe("polar_order");
    expect(ledgerRows[0]!.refId).toBe(polarOrderId);

    // cached_paid_balance update
    const [subAfter] = await getDrizzleDb()
      .select()
      .from(paymentSubscriptions)
      .where(eq(paymentSubscriptions.organizationId, orgId))
      .limit(1);
    expect(subAfter!.cachedPaidBalanceCents).toBe(balanceBefore + 500);
  });

  // ── 케이스 6b: onOrderPaid 멱등 — 이미 paid 이면 no-op ──
  it("onOrderPaid — 이미 paid 이면 두 번째 호출 no-op (멱등)", async () => {
    const { rechargeHistoryId } = await svc.trigger(orgId);
    const polarOrderId = `order_${randomUUID()}`;

    await svc.onOrderPaid(rechargeHistoryId, polarOrderId, 500);
    // 두 번째 호출 — 예외 없이 return
    await expect(svc.onOrderPaid(rechargeHistoryId, polarOrderId, 500)).resolves.not.toThrow();

    // ledger row 는 1개만
    const ledgerRows = await getDrizzleDb()
      .select()
      .from(paymentUsageLedger)
      .where(
        and(
          eq(paymentUsageLedger.organizationId, orgId),
          eq(paymentUsageLedger.reason, "auto_recharge"),
        ),
      );
    expect(ledgerRows).toHaveLength(1);
  });
});
