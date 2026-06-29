import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  paymentCreditLedger,
  paymentSubscriptions,
  paymentUsageLedger,
  paymentUsageReserves,
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
import { AiUsageMeterService } from "./ai-usage-meter.service";

// DB cold start 포함 hook timeout 대비 30s (subscription.service.spec 동일 패턴)
jest.setTimeout(30_000);

const describeIfDb = hasDb ? describe : describe.skip;

describeIfDb("AiUsageMeterService", () => {
  let svc: AiUsageMeterService;
  let orgId: string;
  let userId: string;
  let planId: string;

  beforeAll(() => {
    svc = new AiUsageMeterService(getDrizzleDb());
  });

  afterAll(async () => {
    await endTestDb();
  });

  beforeEach(async () => {
    orgId = newOrgId("usage-meter");
    userId = newUserId("usage-meter");
    planId = randomUUID();
    await ensureOrg(orgId);
    await ensureUser(userId);
    await ensurePlan(planId, { priceCents: 1999 });

    // active subscription
    await getDrizzleDb().insert(paymentSubscriptions).values({
      polarSubscriptionId: `sub_meter_${orgId}`,
      organizationId: orgId,
      userId,
      planId,
      status: "active",
      currentPeriodStart: new Date("2026-04-01"),
      currentPeriodEnd: new Date("2026-05-01"),
    });

    // included credit grant — 5000 credits (1 credit = 1 cent)
    await getDrizzleDb().insert(paymentCreditLedger).values({
      organizationId: orgId,
      delta: 5000,
      balanceAfter: 5000,
      reason: "subscription_grant",
      refType: "subscription",
      refId: `sub_meter_${orgId}:2026-04-01`,
    });
  });

  afterEach(async () => {
    const db = getDrizzleDb();
    // usage 테이블은 cleanupOrg 보다 먼저 삭제 (FK cascade 없음)
    await db.delete(paymentUsageReserves).where(eq(paymentUsageReserves.organizationId, orgId));
    await db.delete(paymentUsageLedger).where(eq(paymentUsageLedger.organizationId, orgId));
    await cleanupOrg(orgId);
    await cleanupUser(userId);
    await cleanupPlan(planId);
  });

  it("reserve — 새 reservation insert + reservationId 반환", async () => {
    const result = await svc.reserve({
      orgId,
      refId: "msg_001",
      estimateCents: 100,
      expiresInSec: 300,
    });

    expect(result.reservationId).toBeDefined();
    expect(result.totalAvailable).toBeGreaterThanOrEqual(100);

    const [row] = await getDrizzleDb()
      .select()
      .from(paymentUsageReserves)
      .where(eq(paymentUsageReserves.id, result.reservationId));
    expect(row).toBeDefined();
    expect(row!.status).toBe("reserved");
    expect(row!.estimateCents).toBe(100);
  });

  it("reserve 멱등 — 같은 refId 두번 reserve → 같은 reservationId", async () => {
    const first = await svc.reserve({
      orgId,
      refId: "msg_dup",
      estimateCents: 100,
      expiresInSec: 300,
    });
    const second = await svc.reserve({
      orgId,
      refId: "msg_dup",
      estimateCents: 100,
      expiresInSec: 300,
    });
    expect(second.reservationId).toBe(first.reservationId);
  });

  it("claim — included credit 우선 차감 (paid usage_ledger 없음)", async () => {
    const { reservationId } = await svc.reserve({
      orgId,
      refId: "msg_claim_1",
      estimateCents: 200,
      expiresInSec: 300,
    });
    // 100 input + 50 output = (100/1M)*300 + (50/1M)*1500 = 0.03+0.075 = 0.11 → ceil = 1 cent
    // included balance 5000 > 1 → included only
    await svc.claim({
      reservationId,
      actualInputTokens: 100,
      actualOutputTokens: 50,
      model: "claude-sonnet-4",
    }, { orgId });

    // included credit ledger에 spend row 존재
    const ledgerRows = await getDrizzleDb()
      .select()
      .from(paymentCreditLedger)
      .where(eq(paymentCreditLedger.organizationId, orgId));
    const spendRow = ledgerRows.find((r) => r.delta < 0 && r.refId === reservationId);
    expect(spendRow).toBeDefined();
    expect(spendRow!.delta).toBeLessThan(0);

    // included 가 충분 → payment_usage_ledger 없음
    const usageRows = await getDrizzleDb()
      .select()
      .from(paymentUsageLedger)
      .where(eq(paymentUsageLedger.organizationId, orgId));
    expect(usageRows.length).toBe(0);

    // reservation status = claimed
    const [reserve] = await getDrizzleDb()
      .select()
      .from(paymentUsageReserves)
      .where(eq(paymentUsageReserves.id, reservationId));
    expect(reserve).toBeDefined();
    expect(reserve!.status).toBe("claimed");
  });

  it("claim — included 부족 → 부분은 included, 나머지는 paid usage_ledger", async () => {
    // included 를 4900 소진 → 잔액 100
    await getDrizzleDb().insert(paymentCreditLedger).values({
      organizationId: orgId,
      delta: -4900,
      balanceAfter: 100,
      reason: "spend",
      refType: "spend_event",
      refId: `drain_${orgId}`,
    });
    // paid balance 충전 (subscription cached_paid_balance_cents = 10000)
    await getDrizzleDb()
      .update(paymentSubscriptions)
      .set({ cachedPaidBalanceCents: 10_000 })
      .where(eq(paymentSubscriptions.organizationId, orgId));

    const { reservationId } = await svc.reserve({
      orgId,
      refId: "msg_split",
      estimateCents: 250,
      expiresInSec: 300,
    });
    // 100k input + 100k output (claude-sonnet-4) → (0.1*300) + (0.1*1500) = 30+150 = 180 cents
    // included=100 < 180 → split: included 100 + paid 80
    await svc.claim({
      reservationId,
      actualInputTokens: 100_000,
      actualOutputTokens: 100_000,
      model: "claude-sonnet-4",
    }, { orgId });

    const creditRows = await getDrizzleDb()
      .select()
      .from(paymentCreditLedger)
      .where(eq(paymentCreditLedger.organizationId, orgId));
    const usageRows = await getDrizzleDb()
      .select()
      .from(paymentUsageLedger)
      .where(eq(paymentUsageLedger.organizationId, orgId));

    // included credit ledger에 deduct 존재 (refId = reservationId)
    expect(creditRows.find((r) => r.refId === reservationId)).toBeDefined();
    // paid usage_ledger에도 존재
    expect(usageRows.find((r) => r.refId === reservationId)).toBeDefined();
  });

  it("cancel — reserve status='cancelled', ledger 변경 없음", async () => {
    const { reservationId } = await svc.reserve({
      orgId,
      refId: "msg_cancel",
      estimateCents: 100,
      expiresInSec: 300,
    });
    await svc.cancel({ reservationId }, { orgId });

    const [row] = await getDrizzleDb()
      .select()
      .from(paymentUsageReserves)
      .where(eq(paymentUsageReserves.id, reservationId));
    expect(row).toBeDefined();
    expect(row!.status).toBe("cancelled");

    // ledger 변경 없음 — 초기 grant row 만 존재 (delta > 0)
    const ledgerRows = await getDrizzleDb()
      .select()
      .from(paymentCreditLedger)
      .where(eq(paymentCreditLedger.organizationId, orgId));
    const spendRow = ledgerRows.find((r) => r.delta < 0);
    expect(spendRow).toBeUndefined();
  });

  it("insufficient_balance — total available < estimate 시 throw", async () => {
    // available = 5000 → estimateCents = 6000 → insufficient
    await expect(
      svc.reserve({ orgId, refId: "msg_insuf", estimateCents: 6000 }),
    ).rejects.toThrow("insufficient_balance");
  });

  it("C1 claim IDOR guard — 다른 org 의 reservation claim 시 throw", async () => {
    const { reservationId } = await svc.reserve({
      orgId,
      refId: "msg_idor_claim",
      estimateCents: 100,
    });
    // 다른 org ID 로 claim 시도
    await expect(
      svc.claim(
        { reservationId, actualInputTokens: 100, actualOutputTokens: 50, model: "claude-sonnet-4" },
        { orgId: "other-org-id" },
      ),
    ).rejects.toThrow("reservation_org_mismatch");
  });

  it("C1 cancel IDOR guard — 다른 org 의 reservation cancel 시 no-op (행 변경 없음)", async () => {
    const { reservationId } = await svc.reserve({
      orgId,
      refId: "msg_idor_cancel",
      estimateCents: 100,
    });
    // 다른 org ID 로 cancel 시도 — WHERE 절 불일치로 no-op
    await svc.cancel({ reservationId }, { orgId: "other-org-id" });

    // 원본 reservation 여전히 reserved 상태
    const [row] = await getDrizzleDb()
      .select()
      .from(paymentUsageReserves)
      .where(eq(paymentUsageReserves.id, reservationId));
    expect(row).toBeDefined();
    expect(row!.status).toBe("reserved");
  });
});
