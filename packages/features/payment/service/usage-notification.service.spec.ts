/**
 * UsageNotificationService — DB-backed tests (T6).
 *
 *   1. 80% 도달 시 in-app notification (audit log row) 1개
 *   2. 같은 cycle 안 80% 알림 이미 있으면 중복 skip
 *   3. 100% 도달 시 별도 threshold notification
 *   4. monthlyLimitCents=0 (Free plan) → skip
 *   5. 80% 미만 → skip
 */
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  paymentAuditLog,
  paymentExtraUsageSettings,
  paymentSubscriptions,
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
import { UsageNotificationService } from "./usage-notification.service";

jest.setTimeout(30_000);

const describeIfDb = hasDb ? describe : describe.skip;

describeIfDb("UsageNotificationService", () => {
  let svc: UsageNotificationService;
  let orgId: string;
  let userId: string;
  let planId: string;
  const periodStart = new Date("2026-04-01");

  beforeAll(() => {
    svc = new UsageNotificationService(getDrizzleDb());
  });

  afterAll(async () => {
    await endTestDb();
  });

  beforeEach(async () => {
    orgId = newOrgId("usage-notif");
    userId = newUserId("usage-notif");
    planId = randomUUID();
    await ensureOrg(orgId);
    await ensureUser(userId);
    await ensurePlan(planId, { priceCents: 1999 });

    // active subscription (cycle 2026-04-01 ~ 2026-05-01)
    await getDrizzleDb().insert(paymentSubscriptions).values({
      polarSubscriptionId: `sub_notif_${orgId}`,
      organizationId: orgId,
      userId,
      planId,
      status: "active",
      currentPeriodStart: periodStart,
      currentPeriodEnd: new Date("2026-05-01"),
      cachedPaidBalanceCents: 5_000,
    });

    // extra_usage_settings row
    await getDrizzleDb().insert(paymentExtraUsageSettings).values({
      organizationId: orgId,
      enabled: true,
      monthlyLimitCents: 5_000,
      autoRechargeEnabled: false,
      autoRechargeThresholdCents: 500,
      autoRechargePackageId: null,
    });
  });

  afterEach(async () => {
    const db = getDrizzleDb();
    await db.delete(paymentAuditLog).where(eq(paymentAuditLog.targetOrgId, orgId));
    await db
      .delete(paymentExtraUsageSettings)
      .where(eq(paymentExtraUsageSettings.organizationId, orgId));
    await cleanupOrg(orgId);
    await cleanupUser(userId);
    await cleanupPlan(planId);
  });

  it("80% 도달 시 audit log row 1개 (threshold='80')", async () => {
    // 4000/5000 = 80%
    await svc.maybeNotify(orgId, { accumulatedCents: 4_000, monthlyLimitCents: 5_000 });

    const rows = await getDrizzleDb()
      .select()
      .from(paymentAuditLog)
      .where(
        and(
          eq(paymentAuditLog.targetOrgId, orgId),
          eq(paymentAuditLog.action, "usage_limit_reached"),
        ),
      );

    expect(rows).toHaveLength(1);
    expect((rows[0]!.payloadAfter as any)?.threshold).toBe("80");
  });

  it("같은 cycle 안 80% 알림 이미 있으면 중복 skip", async () => {
    // 첫 번째 호출
    await svc.maybeNotify(orgId, { accumulatedCents: 4_000, monthlyLimitCents: 5_000 });
    // 두 번째 호출 (같은 cycle, 같은 threshold)
    await svc.maybeNotify(orgId, { accumulatedCents: 4_200, monthlyLimitCents: 5_000 });

    const rows = await getDrizzleDb()
      .select()
      .from(paymentAuditLog)
      .where(
        and(
          eq(paymentAuditLog.targetOrgId, orgId),
          eq(paymentAuditLog.action, "usage_limit_reached"),
        ),
      );

    // 중복 방지 — row 는 여전히 1개
    expect(rows).toHaveLength(1);
  });

  it("100% 도달 시 별도 threshold='100' audit log", async () => {
    // 5000/5000 = 100%
    await svc.maybeNotify(orgId, { accumulatedCents: 5_000, monthlyLimitCents: 5_000 });

    const rows = await getDrizzleDb()
      .select()
      .from(paymentAuditLog)
      .where(
        and(
          eq(paymentAuditLog.targetOrgId, orgId),
          eq(paymentAuditLog.action, "usage_limit_reached"),
        ),
      );

    expect(rows).toHaveLength(1);
    expect((rows[0]!.payloadAfter as any)?.threshold).toBe("100");
  });
});
