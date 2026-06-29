/**
 * SubscriptionService — webhook idempotency + admin runtime ops.
 *
 * Tests run against the real Postgres DB (DATABASE_URL). Each test uses
 * a fresh org / user / plan id triple so rows from different tests cannot
 * collide; afterEach deletes them.
 *
 *  Task 4.1 — webhook idempotency
 *    1. processEvent idempotent on duplicate polar_event_id
 *    2. processEvent: subscription.updated changes status (no duplicate row)
 *    3. processEvent: subscription.canceled propagates cancelAtPeriodEnd / status
 *
 *  Task 4.2 — admin / runtime ops
 *    4. compSubscription creates active sub without polar; throws on second comp
 *    5. cancelSubscriptionNow sets status=canceled + canceledAt
 *    6. extendTrialEnd updates trial_end
 *    7. changePlan upgrade returns effectiveAt='now' and updates plan_id;
 *       downgrade returns 'cycle_end' (DB-only path; Polar wiring TODO Phase 8)
 */
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  paymentAuditLog,
  paymentCreditLedger,
  paymentOrders,
  paymentPendingPlanChanges,
  paymentPlans,
  paymentSubscriptionEvents,
  paymentSubscriptions,
} from "@repo/drizzle";
import {
  cleanupEventsByPrefix,
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
import { AuditService } from "./audit.service";
import { SubscriptionService } from "./subscription.service";

// payment service spec 들은 real Postgres 사용 — cold start 시 fixture (org/user/plan
// insert + cleanup) 만 5초 hook timeout 을 초과할 수 있음. T7 의 paymentOrders fixture
// 추가가 cold path 를 더 늘려 첫 it() 이 timeout 으로 fail 했음. audit/coupon spec 과
// 동일한 30s 로 상향 (T7 추가 변경).
jest.setTimeout(30_000);

const describeIfDb = hasDb ? describe : describe.skip;

describeIfDb("SubscriptionService", () => {
  let svc: SubscriptionService;
  let orgId: string;
  let userId: string;
  let planId: string;
  let altPlanId: string;
  // Per-test polar event prefix so cleanup can sweep by LIKE.
  let evtPrefix: string;

  beforeAll(() => {
    svc = new SubscriptionService(getDrizzleDb());
  });

  beforeEach(async () => {
    orgId = newOrgId("subs");
    userId = newUserId("subs");
    planId = randomUUID();
    altPlanId = randomUUID();
    evtPrefix = `evt_${randomUUID()}_`;
    await ensureOrg(orgId);
    await ensureUser(userId);
    await ensurePlan(planId, { priceCents: 1000 });
    await ensurePlan(altPlanId, { priceCents: 5000, slug: `alt-${planId.slice(0, 8)}` });
  });

  afterEach(async () => {
    // Order matters — events FK to subs; subs FK to plan/user/org; user/plan are independent.
    await cleanupEventsByPrefix(evtPrefix);
    await cleanupOrg(orgId);
    await cleanupPlan(planId);
    await cleanupPlan(altPlanId);
    await cleanupUser(userId);
  });

  afterAll(async () => {
    await endTestDb();
  });

  // ── Helpers ────────────────────────────────────────────────────────

  const makeEvent = (overrides: {
    polarEventId: string;
    type?: "subscription.created" | "subscription.updated" | "subscription.canceled" | "subscription.trial_end";
    polarSubId?: string;
    status?: "trialing" | "active" | "past_due" | "canceled";
    cancelAtPeriodEnd?: boolean;
  }) => {
    const now = new Date();
    const end = new Date(now.getTime() + 30 * 86_400_000);
    return {
      polarEventId: overrides.polarEventId,
      type: overrides.type ?? ("subscription.created" as const),
      payload: {
        id: overrides.polarSubId ?? `polar_sub_${orgId}`,
        organizationId: orgId,
        userId,
        planId,
        status: overrides.status ?? ("active" as const),
        currentPeriodStart: now,
        currentPeriodEnd: end,
        trialEnd: null,
        cancelAtPeriodEnd: overrides.cancelAtPeriodEnd ?? false,
      },
    };
  };

  // ── Task 4.1 ───────────────────────────────────────────────────────

  it("processEvent idempotent on duplicate polar_event_id", async () => {
    const evt = makeEvent({ polarEventId: `${evtPrefix}dup1` });

    const r1 = await svc.processEvent(evt);
    expect(r1.processed).toBe(true);
    expect(r1.subscriptionId).toBeDefined();

    const r2 = await svc.processEvent(evt);
    expect(r2.processed).toBe(false);
    expect(r2.reason).toBe("duplicate");

    const db = getDrizzleDb();
    const events = await db
      .select()
      .from(paymentSubscriptionEvents)
      .where(eq(paymentSubscriptionEvents.polarEventId, evt.polarEventId));
    expect(events.length).toBe(1);

    const subs = await db
      .select()
      .from(paymentSubscriptions)
      .where(eq(paymentSubscriptions.polarSubscriptionId, evt.payload.id));
    expect(subs.length).toBe(1);
  });

  it("processEvent: subscription.updated changes status without duplicating row", async () => {
    const polarSubId = `polar_sub_upd_${orgId}`;
    await svc.processEvent(
      makeEvent({ polarEventId: `${evtPrefix}u1`, polarSubId, status: "active" }),
    );
    await svc.processEvent(
      makeEvent({
        polarEventId: `${evtPrefix}u2`,
        type: "subscription.updated",
        polarSubId,
        status: "past_due",
      }),
    );
    const db = getDrizzleDb();
    const subs = await db
      .select()
      .from(paymentSubscriptions)
      .where(eq(paymentSubscriptions.polarSubscriptionId, polarSubId));
    expect(subs.length).toBe(1);
    expect(subs[0]!.status).toBe("past_due");
  });

  it("processEvent: subscription.canceled propagates cancelAtPeriodEnd + status", async () => {
    const polarSubId = `polar_sub_cancel_${orgId}`;
    await svc.processEvent(
      makeEvent({ polarEventId: `${evtPrefix}c1`, polarSubId, status: "active" }),
    );
    await svc.processEvent(
      makeEvent({
        polarEventId: `${evtPrefix}c2`,
        type: "subscription.canceled",
        polarSubId,
        status: "canceled",
        cancelAtPeriodEnd: true,
      }),
    );
    const db = getDrizzleDb();
    const subs = await db
      .select()
      .from(paymentSubscriptions)
      .where(eq(paymentSubscriptions.polarSubscriptionId, polarSubId));
    expect(subs.length).toBe(1);
    expect(subs[0]!.status).toBe("canceled");
    expect(subs[0]!.cancelAtPeriodEnd).toBe(true);
  });

  // ── Task 4.2 ───────────────────────────────────────────────────────

  it("compSubscription creates active sub without polar; throws when org already has one", async () => {
    const r = await svc.compSubscription({
      organizationId: orgId,
      userId,
      planId,
      durationMonths: 3,
      reason: "marketing comp",
      actorUserId: "admin_u",
    });
    expect(r.subscriptionId).toBeDefined();
    const db = getDrizzleDb();
    const subs = await db
      .select()
      .from(paymentSubscriptions)
      .where(eq(paymentSubscriptions.id, r.subscriptionId));
    expect(subs.length).toBe(1);
    expect(subs[0]!.status).toBe("active");
    expect(subs[0]!.polarSubscriptionId).toMatch(/^comp_/);

    await expect(
      svc.compSubscription({
        organizationId: orgId,
        userId,
        planId,
        durationMonths: 1,
        reason: "second",
        actorUserId: "admin_u",
      }),
    ).rejects.toThrow(/already has/);
  });

  it("cancelSubscriptionNow sets status=canceled + canceledAt", async () => {
    const { subscriptionId } = await svc.compSubscription({
      organizationId: orgId,
      userId,
      planId,
      durationMonths: 1,
      reason: "test",
      actorUserId: "admin_u",
    });
    await svc.cancelSubscriptionNow({ subscriptionId, reason: "ops" });
    const db = getDrizzleDb();
    const subs = await db
      .select()
      .from(paymentSubscriptions)
      .where(eq(paymentSubscriptions.id, subscriptionId));
    expect(subs[0]!.status).toBe("canceled");
    expect(subs[0]!.canceledAt).not.toBeNull();
  });

  it("extendTrialEnd updates trial_end", async () => {
    const { subscriptionId } = await svc.compSubscription({
      organizationId: orgId,
      userId,
      planId,
      durationMonths: 1,
      reason: "test",
      actorUserId: "admin_u",
    });
    const newTrialEnd = new Date(Date.now() + 7 * 86_400_000);
    await svc.extendTrialEnd({ subscriptionId, newTrialEnd, reason: "VIP" });
    const db = getDrizzleDb();
    const subs = await db
      .select()
      .from(paymentSubscriptions)
      .where(eq(paymentSubscriptions.id, subscriptionId));
    expect(subs[0]!.trialEnd).not.toBeNull();
    expect(subs[0]!.trialEnd!.getTime()).toBe(newTrialEnd.getTime());
  });

  it("changePlan: upgrade applies immediately, downgrade defers to cycle_end", async () => {
    // start on cheap plan (priceCents=1000), comp it.
    const { subscriptionId } = await svc.compSubscription({
      organizationId: orgId,
      userId,
      planId,
      durationMonths: 1,
      reason: "test",
      actorUserId: "admin_u",
    });
    // Upgrade → altPlanId is 5000, current is 1000 → upgrade.
    const up = await svc.changePlan({
      subscriptionId,
      targetPlanId: altPlanId,
      billingCycle: "monthly",
    });
    expect(up.effectiveAt).toBe("now");
    const db = getDrizzleDb();
    let subs = await db
      .select()
      .from(paymentSubscriptions)
      .where(eq(paymentSubscriptions.id, subscriptionId));
    expect(subs[0]!.planId).toBe(altPlanId);

    // Downgrade back to cheap plan.
    const down = await svc.changePlan({
      subscriptionId,
      targetPlanId: planId,
      billingCycle: "monthly",
    });
    expect(down.effectiveAt).toBe("cycle_end");
    subs = await db
      .select()
      .from(paymentSubscriptions)
      .where(eq(paymentSubscriptions.id, subscriptionId));
    // Downgrade is deferred — plan_id unchanged in v1.
    expect(subs[0]!.planId).toBe(altPlanId);
  }, 30_000);

  // ── Task 3 (Option A) — plan_id mirror via polarProductId lookup ────

  describe("upsertSubscription plan_id mirror (v2)", () => {
    // Polar product ids for the two plans we create in each test. Suffixed
    // with the test orgId so parallel test runs don't collide on the
    // payment_plans.polar_product_id UNIQUE constraint.
    let basicProductId: string;
    let premiumProductId: string;
    let basicPlanId: string;
    let premiumPlanId: string;
    let polarSubId: string;

    beforeEach(async () => {
      basicProductId = `prod_basic_${randomUUID()}`;
      premiumProductId = `prod_premium_${randomUUID()}`;
      basicPlanId = randomUUID();
      premiumPlanId = randomUUID();
      polarSubId = `polar_sub_mirror_${orgId}`;
      await ensurePlan(basicPlanId, {
        priceCents: 1999,
        slug: `basic-${basicPlanId.slice(0, 8)}`,
        polarProductId: basicProductId,
      });
      await ensurePlan(premiumPlanId, {
        priceCents: 4999,
        slug: `premium-${premiumPlanId.slice(0, 8)}`,
        polarProductId: premiumProductId,
      });
    });

    afterEach(async () => {
      // Inner afterEach runs BEFORE the parent's cleanupOrg, so basic/premium
      // plans cannot be deleted while payment_subscriptions still references
      // them (FK). Run cleanupOrg here first to drop events + subs, then drop
      // the plans; the parent's cleanupOrg becomes a no-op for this org.
      await cleanupOrg(orgId);
      await cleanupPlan(basicPlanId);
      await cleanupPlan(premiumPlanId);
    });

    const makeMirrorEvent = (overrides: {
      polarEventId: string;
      type?:
        | "subscription.created"
        | "subscription.updated"
        | "subscription.canceled"
        | "subscription.trial_end";
      planIdInPayload: string;
      polarProductId?: string;
    }) => {
      const now = new Date();
      const end = new Date(now.getTime() + 30 * 86_400_000);
      return {
        polarEventId: overrides.polarEventId,
        type: overrides.type ?? ("subscription.updated" as const),
        payload: {
          id: polarSubId,
          organizationId: orgId,
          userId,
          planId: overrides.planIdInPayload,
          polarProductId: overrides.polarProductId,
          status: "active" as const,
          currentPeriodStart: now,
          currentPeriodEnd: end,
          trialEnd: null,
          cancelAtPeriodEnd: false,
        },
      };
    };

    it("polarProductId 가 paymentPlans.polarProductId 와 매핑되면 planId 갱신 (primary truth)", async () => {
      // 1) Create on basic
      await svc.processEvent(
        makeMirrorEvent({
          polarEventId: `${evtPrefix}mir_create`,
          type: "subscription.created",
          planIdInPayload: basicPlanId,
          polarProductId: basicProductId,
        }),
      );

      // 2) subscription.updated — Polar reports the customer is now on
      //    premium (product_id changed). metadata.plan_id is left stale on
      //    purpose to verify the lookup wins over the fallback.
      await svc.processEvent(
        makeMirrorEvent({
          polarEventId: `${evtPrefix}mir_change`,
          type: "subscription.updated",
          planIdInPayload: basicPlanId, // stale fallback
          polarProductId: premiumProductId, // new truth
        }),
      );

      const db = getDrizzleDb();
      const subs = await db
        .select()
        .from(paymentSubscriptions)
        .where(eq(paymentSubscriptions.polarSubscriptionId, polarSubId));
      expect(subs.length).toBe(1);
      expect(subs[0]!.planId).toBe(premiumPlanId);
    });

    it("polarProductId 가 unknown 이면 fallback (payload.planId) 사용 + sub 안 깨짐", async () => {
      await svc.processEvent(
        makeMirrorEvent({
          polarEventId: `${evtPrefix}mir_unknown`,
          type: "subscription.created",
          planIdInPayload: basicPlanId,
          polarProductId: `prod_unknown_${randomUUID()}`,
        }),
      );

      const db = getDrizzleDb();
      const subs = await db
        .select()
        .from(paymentSubscriptions)
        .where(eq(paymentSubscriptions.polarSubscriptionId, polarSubId));
      expect(subs.length).toBe(1);
      expect(subs[0]!.planId).toBe(basicPlanId);
    });
  });

  // ── Task 4 (v2) — previewPlanChange ────────────────────────────────

  describe("previewPlanChange", () => {
    let basicMonthlyId: string;
    let proMonthlyId: string;
    let proYearlyId: string;
    let polarSubId: string;
    let subRowId: string;

    beforeEach(async () => {
      basicMonthlyId = randomUUID();
      proMonthlyId = randomUUID();
      proYearlyId = randomUUID();
      polarSubId = `polar_sub_preview_${orgId}`;

      const db = getDrizzleDb();
      await db.insert(paymentPlans).values({
        id: basicMonthlyId,
        slug: `basic-monthly-${basicMonthlyId.slice(0, 8)}`,
        cycle: "monthly",
        name: "Basic Monthly",
        priceCents: 1999,
        currency: "USD",
        includedCreditsPerCycle: 1000,
        seats: 1,
        trialDays: 0,
        polarProductId: `prod_basic_m_${basicMonthlyId.slice(0, 8)}`,
      });
      await db.insert(paymentPlans).values({
        id: proMonthlyId,
        slug: `pro-monthly-${proMonthlyId.slice(0, 8)}`,
        cycle: "monthly",
        name: "Pro Monthly",
        priceCents: 4999,
        currency: "USD",
        includedCreditsPerCycle: 5000,
        seats: 5,
        trialDays: 0,
        polarProductId: `prod_pro_m_${proMonthlyId.slice(0, 8)}`,
      });
      await db.insert(paymentPlans).values({
        id: proYearlyId,
        slug: `pro-yearly-${proYearlyId.slice(0, 8)}`,
        cycle: "yearly",
        name: "Pro Yearly",
        priceCents: 49990,
        currency: "USD",
        includedCreditsPerCycle: 5000,
        seats: 5,
        trialDays: 0,
        polarProductId: `prod_pro_y_${proYearlyId.slice(0, 8)}`,
      });

      const inserted = await db
        .insert(paymentSubscriptions)
        .values({
          polarSubscriptionId: polarSubId,
          organizationId: orgId,
          userId,
          planId: basicMonthlyId,
          status: "active",
          currentPeriodStart: new Date("2026-04-01T00:00:00Z"),
          currentPeriodEnd: new Date("2026-05-01T00:00:00Z"),
        })
        .returning({ id: paymentSubscriptions.id });
      subRowId = inserted[0]!.id;
    });

    afterEach(async () => {
      // Inner afterEach runs BEFORE the parent's cleanup. Drop the sub
      // row + the three preview plans we created so the parent's
      // cleanupOrg/cleanupPlan calls don't trip FK constraints.
      const db = getDrizzleDb();
      await db
        .delete(paymentSubscriptions)
        .where(eq(paymentSubscriptions.id, subRowId));
      await db.delete(paymentPlans).where(eq(paymentPlans.id, basicMonthlyId));
      await db.delete(paymentPlans).where(eq(paymentPlans.id, proMonthlyId));
      await db.delete(paymentPlans).where(eq(paymentPlans.id, proYearlyId));
    });

    it("upgrade — 같은 cycle, 더 비싼 plan, 일할 비례 차액 계산", async () => {
      const result = await svc.previewPlanChange(
        { subscriptionId: subRowId, targetPlanId: proMonthlyId },
        { now: new Date("2026-04-15T00:00:00Z") },
      );
      expect(result.kind).toBe("upgrade");
      expect(result.effectiveAt).toBe("now");
      // 차액 = (4999 - 1999) * (16/30) ≈ 1600
      expect(result.prorationCents).toBeGreaterThan(1500);
      expect(result.prorationCents).toBeLessThan(1700);
    });

    it("downgrade — 같은 cycle, 더 싼 plan, prorationCents=0, effectiveAt=cycle_end", async () => {
      const db = getDrizzleDb();
      await db
        .update(paymentSubscriptions)
        .set({ planId: proMonthlyId })
        .where(eq(paymentSubscriptions.id, subRowId));
      const result = await svc.previewPlanChange(
        { subscriptionId: subRowId, targetPlanId: basicMonthlyId },
        { now: new Date("2026-04-15T00:00:00Z") },
      );
      expect(result.kind).toBe("downgrade");
      expect(result.effectiveAt).toBe("cycle_end");
      expect(result.prorationCents).toBe(0);
      expect(result.nextChargeAt.toISOString()).toBe("2026-05-01T00:00:00.000Z");
    });

    it("cycle-up — monthly→yearly, 즉시 큰 금액 결제", async () => {
      const db = getDrizzleDb();
      await db
        .update(paymentSubscriptions)
        .set({ planId: proMonthlyId })
        .where(eq(paymentSubscriptions.id, subRowId));
      const result = await svc.previewPlanChange(
        { subscriptionId: subRowId, targetPlanId: proYearlyId },
        { now: new Date("2026-04-15T00:00:00Z") },
      );
      expect(result.kind).toBe("cycle-up");
      expect(result.effectiveAt).toBe("now");
      // yearly 즉시 결제 ~ 49990 - (4999 * 16/30) ≈ 47326
      expect(result.prorationCents).toBeGreaterThan(45000);
      expect(result.prorationCents).toBeLessThan(50000);
    });

    it("cycle-down — yearly→monthly, 잔액 크레딧 (음수 prorationCents)", async () => {
      const db = getDrizzleDb();
      await db
        .update(paymentSubscriptions)
        .set({
          planId: proYearlyId,
          currentPeriodEnd: new Date("2027-04-01T00:00:00Z"),
        })
        .where(eq(paymentSubscriptions.id, subRowId));
      const result = await svc.previewPlanChange(
        { subscriptionId: subRowId, targetPlanId: proMonthlyId },
        { now: new Date("2026-04-15T00:00:00Z") },
      );
      expect(result.kind).toBe("cycle-down");
      expect(result.effectiveAt).toBe("now");
      expect(result.prorationCents).toBeLessThan(0);
    });

    it("noop — 동일 plan_id 면 throw", async () => {
      await expect(
        svc.previewPlanChange(
          { subscriptionId: subRowId, targetPlanId: basicMonthlyId },
          { now: new Date("2026-04-15T00:00:00Z") },
        ),
      ).rejects.toThrow("already on this plan");
    });

    it("throws — expired subscription (now > currentPeriodEnd)", async () => {
      // currentPeriodEnd 가 2026-05-01 인데 now=2026-06-01 → 만료된 sub
      await expect(
        svc.previewPlanChange(
          { subscriptionId: subRowId, targetPlanId: proMonthlyId },
          { now: new Date("2026-06-01T00:00:00Z") },
        ),
      ).rejects.toThrow(/already expired/i);
    });

    it("throws — invalid period (currentPeriodStart >= currentPeriodEnd)", async () => {
      const db = getDrizzleDb();
      await db
        .update(paymentSubscriptions)
        .set({
          currentPeriodStart: new Date("2026-05-01T00:00:00Z"),
          currentPeriodEnd: new Date("2026-04-01T00:00:00Z"),
        })
        .where(eq(paymentSubscriptions.id, subRowId));
      await expect(
        svc.previewPlanChange(
          { subscriptionId: subRowId, targetPlanId: proMonthlyId },
          { now: new Date("2026-04-15T00:00:00Z") },
        ),
      ).rejects.toThrow(/invalid period/i);
    });

    it("throws — lateral plan change (same cycle + same price)", async () => {
      // basicMonthly (1999) 과 같은 가격 + 같은 cycle 의 sibling plan
      const siblingMonthlyId = randomUUID();
      const db = getDrizzleDb();
      await db.insert(paymentPlans).values({
        id: siblingMonthlyId,
        slug: `basic-monthly-sibling-${siblingMonthlyId.slice(0, 8)}`,
        cycle: "monthly",
        name: "Basic Monthly Sibling",
        priceCents: 1999,
        currency: "USD",
        includedCreditsPerCycle: 1000,
        seats: 1,
        trialDays: 0,
        polarProductId: `prod_basic_m_sibling_${siblingMonthlyId.slice(0, 8)}`,
      });
      try {
        await expect(
          svc.previewPlanChange(
            { subscriptionId: subRowId, targetPlanId: siblingMonthlyId },
            { now: new Date("2026-04-15T00:00:00Z") },
          ),
        ).rejects.toThrow(/lateral plan change/i);
      } finally {
        await db
          .delete(paymentPlans)
          .where(eq(paymentPlans.id, siblingMonthlyId));
      }
    });

    it("throws — cycle change with no price difference (different cycle + same price)", async () => {
      // basicMonthly (1999, monthly) 과 같은 가격이지만 cycle 만 다른 yearly plan
      const siblingYearlyId = randomUUID();
      const db = getDrizzleDb();
      await db.insert(paymentPlans).values({
        id: siblingYearlyId,
        slug: `basic-yearly-equiprice-${siblingYearlyId.slice(0, 8)}`,
        cycle: "yearly",
        name: "Basic Yearly Equiprice",
        priceCents: 1999,
        currency: "USD",
        includedCreditsPerCycle: 1000,
        seats: 1,
        trialDays: 0,
        polarProductId: `prod_basic_y_equi_${siblingYearlyId.slice(0, 8)}`,
      });
      try {
        await expect(
          svc.previewPlanChange(
            { subscriptionId: subRowId, targetPlanId: siblingYearlyId },
            { now: new Date("2026-04-15T00:00:00Z") },
          ),
        ).rejects.toThrow(/cycle change has no price difference/i);
      } finally {
        await db
          .delete(paymentPlans)
          .where(eq(paymentPlans.id, siblingYearlyId));
      }
    });
  });

  // ── Task 5 (v2) — changePlanV2 ────────────────────────────────────

  describe("changePlanV2", () => {
    let basicMonthlyId: string;
    let proMonthlyId: string;
    let proYearlyId: string;
    let basicProductId: string;
    let proMonthlyProductId: string;
    let proYearlyProductId: string;
    let polarSubId: string;
    let subRowId: string;
    let polarMock: { updateSubscription: jest.Mock };
    let svcWithPolar: SubscriptionService;

    beforeEach(async () => {
      basicMonthlyId = randomUUID();
      proMonthlyId = randomUUID();
      proYearlyId = randomUUID();
      basicProductId = `prod_basic_${basicMonthlyId.slice(0, 8)}`;
      proMonthlyProductId = `prod_pro_m_${proMonthlyId.slice(0, 8)}`;
      proYearlyProductId = `prod_pro_y_${proYearlyId.slice(0, 8)}`;
      polarSubId = `polar_sub_changev2_${orgId}`;

      polarMock = {
        updateSubscription: jest.fn(async () => ({
          id: polarSubId,
          customerId: "cust_test",
          productId: proMonthlyProductId,
          status: "active" as const,
          currentPeriodStart: new Date("2026-04-15T00:00:00Z"),
          currentPeriodEnd: new Date("2026-05-15T00:00:00Z"),
          trialEnd: null,
          cancelAtPeriodEnd: false,
          metadata: {},
        })),
      };
      svcWithPolar = new SubscriptionService(
        getDrizzleDb(),
        polarMock as unknown as PolarAdapter,
      );

      const db = getDrizzleDb();
      await db.insert(paymentPlans).values({
        id: basicMonthlyId,
        slug: `basic-monthly-v2-${basicMonthlyId.slice(0, 8)}`,
        cycle: "monthly",
        name: "Basic Monthly v2",
        priceCents: 1999,
        currency: "USD",
        includedCreditsPerCycle: 1000,
        seats: 1,
        trialDays: 0,
        polarProductId: basicProductId,
      });
      await db.insert(paymentPlans).values({
        id: proMonthlyId,
        slug: `pro-monthly-v2-${proMonthlyId.slice(0, 8)}`,
        cycle: "monthly",
        name: "Pro Monthly v2",
        priceCents: 4999,
        currency: "USD",
        includedCreditsPerCycle: 5000,
        seats: 5,
        trialDays: 0,
        polarProductId: proMonthlyProductId,
      });
      await db.insert(paymentPlans).values({
        id: proYearlyId,
        slug: `pro-yearly-v2-${proYearlyId.slice(0, 8)}`,
        cycle: "yearly",
        name: "Pro Yearly v2",
        priceCents: 49990,
        currency: "USD",
        includedCreditsPerCycle: 5000,
        seats: 5,
        trialDays: 0,
        polarProductId: proYearlyProductId,
      });

      const inserted = await db
        .insert(paymentSubscriptions)
        .values({
          polarSubscriptionId: polarSubId,
          organizationId: orgId,
          userId,
          planId: basicMonthlyId,
          status: "active",
          currentPeriodStart: new Date("2026-04-01T00:00:00Z"),
          currentPeriodEnd: new Date("2026-05-01T00:00:00Z"),
        })
        .returning({ id: paymentSubscriptions.id });
      subRowId = inserted[0]!.id;
    });

    afterEach(async () => {
      // Inner afterEach runs BEFORE the parent's cleanupOrg. Drop pending rows
      // (FK to paymentSubscriptions has ON DELETE CASCADE, but the parent
      // cleanupOrg deletes payment_subscriptions explicitly so cascade fires.
      // Belt-and-braces: also wipe any pending rows directly here.) Then drop
      // the sub row + the three plans we created so the parent's cleanup
      // doesn't trip FK constraints.
      const db = getDrizzleDb();
      await db
        .delete(paymentPendingPlanChanges)
        .where(eq(paymentPendingPlanChanges.subscriptionId, subRowId));
      await db
        .delete(paymentSubscriptions)
        .where(eq(paymentSubscriptions.id, subRowId));
      await db.delete(paymentPlans).where(eq(paymentPlans.id, basicMonthlyId));
      await db.delete(paymentPlans).where(eq(paymentPlans.id, proMonthlyId));
      await db.delete(paymentPlans).where(eq(paymentPlans.id, proYearlyId));
    });

    it("upgrade → polar invoice + DB plan_id mirror + effectiveAt=now", async () => {
      const result = await svcWithPolar.changePlanV2(
        {
          subscriptionId: subRowId,
          targetPlanId: proMonthlyId,
          actorUserId: userId,
        },
        { now: new Date("2026-04-15T00:00:00Z") },
      );

      expect(result.effectiveAt).toBe("now");
      expect(result.newPlanId).toBe(proMonthlyId);
      expect(polarMock.updateSubscription).toHaveBeenCalledTimes(1);
      expect(polarMock.updateSubscription).toHaveBeenCalledWith(polarSubId, {
        product_id: proMonthlyProductId,
        proration_behavior: "invoice",
      });

      const db = getDrizzleDb();
      const subs = await db
        .select()
        .from(paymentSubscriptions)
        .where(eq(paymentSubscriptions.id, subRowId));
      expect(subs[0]!.planId).toBe(proMonthlyId);
    });

    it("cycle-up (monthly→yearly) → polar invoice + 즉시 mirror", async () => {
      const db = getDrizzleDb();
      await db
        .update(paymentSubscriptions)
        .set({ planId: proMonthlyId })
        .where(eq(paymentSubscriptions.id, subRowId));

      const result = await svcWithPolar.changePlanV2(
        {
          subscriptionId: subRowId,
          targetPlanId: proYearlyId,
          actorUserId: userId,
        },
        { now: new Date("2026-04-15T00:00:00Z") },
      );

      expect(result.effectiveAt).toBe("now");
      expect(result.newPlanId).toBe(proYearlyId);
      expect(polarMock.updateSubscription).toHaveBeenCalledWith(polarSubId, {
        product_id: proYearlyProductId,
        proration_behavior: "invoice",
      });

      const subs = await db
        .select()
        .from(paymentSubscriptions)
        .where(eq(paymentSubscriptions.id, subRowId));
      expect(subs[0]!.planId).toBe(proYearlyId);
    });

    it("cycle-down (yearly→monthly) → polar prorate + 즉시 mirror", async () => {
      const db = getDrizzleDb();
      await db
        .update(paymentSubscriptions)
        .set({
          planId: proYearlyId,
          currentPeriodEnd: new Date("2027-04-01T00:00:00Z"),
        })
        .where(eq(paymentSubscriptions.id, subRowId));

      const result = await svcWithPolar.changePlanV2(
        {
          subscriptionId: subRowId,
          targetPlanId: proMonthlyId,
          actorUserId: userId,
        },
        { now: new Date("2026-04-15T00:00:00Z") },
      );

      expect(result.effectiveAt).toBe("now");
      expect(result.newPlanId).toBe(proMonthlyId);
      expect(polarMock.updateSubscription).toHaveBeenCalledWith(polarSubId, {
        product_id: proMonthlyProductId,
        proration_behavior: "prorate",
      });

      const subs = await db
        .select()
        .from(paymentSubscriptions)
        .where(eq(paymentSubscriptions.id, subRowId));
      expect(subs[0]!.planId).toBe(proMonthlyId);
    });

    it("downgrade → polar 호출 없음 + pending row insert + effectiveAt=cycle_end", async () => {
      const db = getDrizzleDb();
      await db
        .update(paymentSubscriptions)
        .set({ planId: proMonthlyId })
        .where(eq(paymentSubscriptions.id, subRowId));

      const result = await svcWithPolar.changePlanV2(
        {
          subscriptionId: subRowId,
          targetPlanId: basicMonthlyId,
          actorUserId: userId,
        },
        { now: new Date("2026-04-15T00:00:00Z") },
      );

      expect(result.effectiveAt).toBe("cycle_end");
      // downgrade → cycle_end variant; narrow the union so pendingChangeId is visible to TS
      if (result.effectiveAt !== "cycle_end") {
        throw new Error("expected cycle_end change result");
      }
      expect(result.pendingChangeId).toBeDefined();
      expect(result.newPlanId).toBe(proMonthlyId); // 현재 plan 유지
      expect(polarMock.updateSubscription).not.toHaveBeenCalled();

      const pendings = await db
        .select()
        .from(paymentPendingPlanChanges)
        .where(eq(paymentPendingPlanChanges.id, result.pendingChangeId!));
      expect(pendings.length).toBe(1);
      expect(pendings[0]!.targetPlanId).toBe(basicMonthlyId);
      expect(pendings[0]!.applyAt.toISOString()).toBe(
        "2026-05-01T00:00:00.000Z",
      );
      expect(pendings[0]!.status).toBe("pending");

      // sub plan_id 는 미변경 (cycle_end 까지 유지)
      const subs = await db
        .select()
        .from(paymentSubscriptions)
        .where(eq(paymentSubscriptions.id, subRowId));
      expect(subs[0]!.planId).toBe(proMonthlyId);
    });

    it("연속 downgrade — 기존 pending 'canceled' 마크 후 새 row insert (sub 당 동시 1건 INV)", async () => {
      const db = getDrizzleDb();
      // sub 를 pro_monthly 로 시작 → 첫 downgrade target = basic
      await db
        .update(paymentSubscriptions)
        .set({ planId: proMonthlyId })
        .where(eq(paymentSubscriptions.id, subRowId));

      const first = await svcWithPolar.changePlanV2(
        {
          subscriptionId: subRowId,
          targetPlanId: basicMonthlyId,
          actorUserId: userId,
        },
        { now: new Date("2026-04-15T00:00:00Z") },
      );
      if (first.effectiveAt !== "cycle_end") {
        throw new Error("expected cycle_end change result");
      }
      expect(first.pendingChangeId).toBeDefined();

      // 두 번째 downgrade — 같은 target. partial unique index (subscriptionId
      // WHERE status='pending') 는 기존 pending 이 'canceled' 마크되어야 INSERT 가능.
      const second = await svcWithPolar.changePlanV2(
        {
          subscriptionId: subRowId,
          targetPlanId: basicMonthlyId,
          actorUserId: userId,
        },
        { now: new Date("2026-04-16T00:00:00Z") },
      );
      if (second.effectiveAt !== "cycle_end") {
        throw new Error("expected cycle_end change result");
      }
      expect(second.pendingChangeId).toBeDefined();
      expect(second.pendingChangeId).not.toBe(first.pendingChangeId);

      const oldRows = await db
        .select()
        .from(paymentPendingPlanChanges)
        .where(eq(paymentPendingPlanChanges.id, first.pendingChangeId!));
      expect(oldRows[0]!.status).toBe("canceled");
      expect(oldRows[0]!.canceledAt).not.toBeNull();

      // 활성 pending 은 second 한 개만 (INV)
      const activeRows = await db
        .select()
        .from(paymentPendingPlanChanges)
        .where(
          and(
            eq(paymentPendingPlanChanges.subscriptionId, subRowId),
            eq(paymentPendingPlanChanges.status, "pending"),
          ),
        );
      expect(activeRows.length).toBe(1);
      expect(activeRows[0]!.id).toBe(second.pendingChangeId);
    }, 30_000);

    it("Polar 실패 시 트랜잭션 롤백 → DB plan_id 변경 없음", async () => {
      polarMock.updateSubscription.mockRejectedValueOnce(
        new Error("Polar 500"),
      );

      await expect(
        svcWithPolar.changePlanV2(
          {
            subscriptionId: subRowId,
            targetPlanId: proMonthlyId,
            actorUserId: userId,
          },
          { now: new Date("2026-04-15T00:00:00Z") },
        ),
      ).rejects.toThrow("Polar 500");

      const db = getDrizzleDb();
      const subs = await db
        .select()
        .from(paymentSubscriptions)
        .where(eq(paymentSubscriptions.id, subRowId));
      expect(subs[0]!.planId).toBe(basicMonthlyId);
    });

    // ── Review fixes — comp 차단, idempotent race, propagate ────────────
    it("throws — comp_* polarSubscriptionId 는 changePlanV2 미지원 (Polar 호출 0)", async () => {
      const db = getDrizzleDb();
      // admin compSubscription 으로 만든 sub 의 polarSubscriptionId 패턴 모사
      await db
        .update(paymentSubscriptions)
        .set({ polarSubscriptionId: `comp_test_admin_${orgId}` })
        .where(eq(paymentSubscriptions.id, subRowId));

      await expect(
        svcWithPolar.changePlanV2(
          {
            subscriptionId: subRowId,
            targetPlanId: proMonthlyId,
            actorUserId: userId,
          },
          { now: new Date("2026-04-15T00:00:00Z") },
        ),
      ).rejects.toThrow(/non-Polar subscription|not supported/i);
      expect(polarMock.updateSubscription).not.toHaveBeenCalled();
    });

    it("idempotent — preview 후 race 로 다른 process 가 이미 target 으로 변경 (no-op return)", async () => {
      // race simulation: polar.updateSubscription mock 안에서 DB plan_id 를 직접 target 으로
      // 변경 (다른 connection 이 mirror 한 효과). Polar 응답은 정상 — service 는 이후 tx 안
      // 에서 sub.planId === target 을 발견하고 no-op return.
      const db = getDrizzleDb();
      polarMock.updateSubscription.mockImplementationOnce(async () => {
        await db
          .update(paymentSubscriptions)
          .set({ planId: proMonthlyId })
          .where(eq(paymentSubscriptions.id, subRowId));
        return {
          id: polarSubId,
          customerId: "cust_test",
          productId: proMonthlyProductId,
          status: "active" as const,
          currentPeriodStart: new Date("2026-04-15T00:00:00Z"),
          currentPeriodEnd: new Date("2026-05-15T00:00:00Z"),
          trialEnd: null,
          cancelAtPeriodEnd: false,
          metadata: {},
        };
      });

      const result = await svcWithPolar.changePlanV2(
        {
          subscriptionId: subRowId,
          targetPlanId: proMonthlyId,
          actorUserId: userId,
        },
        { now: new Date("2026-04-15T00:00:00Z") },
      );
      expect(result.effectiveAt).toBe("now");
      expect(result.newPlanId).toBe(proMonthlyId);

      const subs = await db
        .select()
        .from(paymentSubscriptions)
        .where(eq(paymentSubscriptions.id, subRowId));
      expect(subs[0]!.planId).toBe(proMonthlyId);
    });

    it("propagates — noop preview throw + Polar 호출 0 (preview 가 tx/Polar 전에 차단)", async () => {
      // 동일 plan_id 로 changePlanV2 호출 → previewPlanChange 가 throw.
      await expect(
        svcWithPolar.changePlanV2(
          {
            subscriptionId: subRowId,
            targetPlanId: basicMonthlyId, // 현재 sub.planId 와 동일
            actorUserId: userId,
          },
          { now: new Date("2026-04-15T00:00:00Z") },
        ),
      ).rejects.toThrow(/already on this plan/i);
      expect(polarMock.updateSubscription).not.toHaveBeenCalled();
    });

    it("propagates — expired sub preview throw + Polar 호출 0", async () => {
      // currentPeriodEnd=2026-05-01 인데 now=2026-06-01 → preview 가 expired throw
      await expect(
        svcWithPolar.changePlanV2(
          {
            subscriptionId: subRowId,
            targetPlanId: proMonthlyId,
            actorUserId: userId,
          },
          { now: new Date("2026-06-01T00:00:00Z") },
        ),
      ).rejects.toThrow(/already expired/i);
      expect(polarMock.updateSubscription).not.toHaveBeenCalled();
    });

    // ── T8: plan-credit 규칙 ─────────────────────────────────────────

    it("T8 upgrade — 차액 includedCreditsPerCycle 즉시 grant (paymentCreditLedger)", async () => {
      // basicMonthly (1000) → proMonthly (5000) upgrade → diff=4000
      const now = new Date("2026-04-15T12:00:00Z");
      await svcWithPolar.changePlanV2(
        { subscriptionId: subRowId, targetPlanId: proMonthlyId, actorUserId: userId },
        { now },
      );
      const db = getDrizzleDb();
      const ledgerRows = await db
        .select()
        .from(paymentCreditLedger)
        .where(
          and(
            eq(paymentCreditLedger.organizationId, orgId),
            eq(paymentCreditLedger.reason, "plan_change_grant"),
          ),
        );
      expect(ledgerRows).toHaveLength(1);
      expect(ledgerRows[0]!.delta).toBe(4000);
      expect(ledgerRows[0]!.balanceAfter).toBe(4000);
    });

    it("T8 downgrade — credit 즉시 grant 없음 (cycle_end cron 영역)", async () => {
      // proMonthly → basicMonthly downgrade: pending row 만 insert, ledger 0건
      // sub 을 먼저 proMonthly 로 올린 뒤 downgrade 시도
      const db = getDrizzleDb();
      await db
        .update(paymentSubscriptions)
        .set({ planId: proMonthlyId })
        .where(eq(paymentSubscriptions.id, subRowId));

      await svcWithPolar.changePlanV2(
        { subscriptionId: subRowId, targetPlanId: basicMonthlyId, actorUserId: userId },
        { now: new Date("2026-04-15T12:00:00Z") },
      );
      const ledgerRows = await db
        .select()
        .from(paymentCreditLedger)
        .where(
          and(
            eq(paymentCreditLedger.organizationId, orgId),
            eq(paymentCreditLedger.reason, "plan_change_grant"),
          ),
        );
      expect(ledgerRows).toHaveLength(0);
    });

    it("T8 cycle-up — yearly included 즉시 grant + 기존 잔액 없을 때 revoke 생략", async () => {
      // basicMonthly → proYearly: cycle-up. 기존 잔액 0 → revoke 없음, grant proYearly.includedCreditsPerCycle=5000
      const now = new Date("2026-04-15T12:00:00Z");
      await svcWithPolar.changePlanV2(
        { subscriptionId: subRowId, targetPlanId: proYearlyId, actorUserId: userId },
        { now },
      );
      const db = getDrizzleDb();
      const grantRows = await db
        .select()
        .from(paymentCreditLedger)
        .where(
          and(
            eq(paymentCreditLedger.organizationId, orgId),
            eq(paymentCreditLedger.reason, "plan_change_grant"),
          ),
        );
      const revokeRows = await db
        .select()
        .from(paymentCreditLedger)
        .where(
          and(
            eq(paymentCreditLedger.organizationId, orgId),
            eq(paymentCreditLedger.reason, "plan_change_revoke"),
          ),
        );
      expect(grantRows).toHaveLength(1);
      expect(grantRows[0]!.delta).toBe(5000);
      expect(revokeRows).toHaveLength(0); // 잔액 0 → revoke 없음
    });
  });

  // ── Task 6 (v2) — scheduleCancelAtPeriodEnd ───────────────────────

  describe("scheduleCancelAtPeriodEnd", () => {
    let proMonthlyId: string;
    let proMonthlyProductId: string;
    let polarSubId: string;
    let subRowId: string;
    let polarMock: { updateSubscription: jest.Mock };
    let svcWithPolar: SubscriptionService;

    beforeEach(async () => {
      proMonthlyId = randomUUID();
      proMonthlyProductId = `prod_pro_m_${proMonthlyId.slice(0, 8)}`;
      polarSubId = `polar_sub_cancel_${orgId}`;

      polarMock = {
        updateSubscription: jest.fn(async () => ({
          id: polarSubId,
          customerId: "cust_test",
          productId: proMonthlyProductId,
          status: "active" as const,
          currentPeriodStart: new Date("2026-04-01T00:00:00Z"),
          currentPeriodEnd: new Date("2026-05-01T00:00:00Z"),
          trialEnd: null,
          cancelAtPeriodEnd: true,
          metadata: {},
        })),
      };
      svcWithPolar = new SubscriptionService(
        getDrizzleDb(),
        polarMock as unknown as PolarAdapter,
      );

      const db = getDrizzleDb();
      await db.insert(paymentPlans).values({
        id: proMonthlyId,
        slug: `pro-monthly-cancel-${proMonthlyId.slice(0, 8)}`,
        cycle: "monthly",
        name: "Pro Monthly Cancel",
        priceCents: 4999,
        currency: "USD",
        includedCreditsPerCycle: 5000,
        seats: 5,
        trialDays: 0,
        polarProductId: proMonthlyProductId,
      });

      const inserted = await db
        .insert(paymentSubscriptions)
        .values({
          polarSubscriptionId: polarSubId,
          organizationId: orgId,
          userId,
          planId: proMonthlyId,
          status: "active",
          currentPeriodStart: new Date("2026-04-01T00:00:00Z"),
          currentPeriodEnd: new Date("2026-05-01T00:00:00Z"),
        })
        .returning({ id: paymentSubscriptions.id });
      subRowId = inserted[0]!.id;
    });

    afterEach(async () => {
      const db = getDrizzleDb();
      await db
        .delete(paymentSubscriptions)
        .where(eq(paymentSubscriptions.id, subRowId));
      await db.delete(paymentPlans).where(eq(paymentPlans.id, proMonthlyId));
    });

    it("active sub (5일차) → polar PATCH cancel_at_period_end=true + DB mirror + refundEligible=true", async () => {
      const result = await svcWithPolar.scheduleCancelAtPeriodEnd(
        { subscriptionId: subRowId, reason: "too expensive", actorUserId: userId },
        { now: new Date("2026-04-06T00:00:00Z") },
      );

      expect(polarMock.updateSubscription).toHaveBeenCalledTimes(1);
      expect(polarMock.updateSubscription).toHaveBeenCalledWith(polarSubId, {
        cancel_at_period_end: true,
      });
      expect(result.effectiveAt).toBe("cycle_end");
      expect(result.cancelAt.toISOString()).toBe("2026-05-01T00:00:00.000Z");
      expect(result.refundEligible).toBe(true);

      const db = getDrizzleDb();
      const subs = await db
        .select()
        .from(paymentSubscriptions)
        .where(eq(paymentSubscriptions.id, subRowId));
      expect(subs[0]!.cancelAtPeriodEnd).toBe(true);
      expect(subs[0]!.canceledAt).not.toBeNull();
    });

    it("16일차 → refundEligible=false (14일 윈도우 만료)", async () => {
      const result = await svcWithPolar.scheduleCancelAtPeriodEnd(
        { subscriptionId: subRowId, reason: "x", actorUserId: userId },
        { now: new Date("2026-04-17T00:00:00Z") },
      );

      expect(result.refundEligible).toBe(false);
    });

    it("정확히 14일째 (start+14d) → refundEligible=true (boundary inclusive)", async () => {
      const result = await svcWithPolar.scheduleCancelAtPeriodEnd(
        { subscriptionId: subRowId, reason: "x", actorUserId: userId },
        // sub.currentPeriodStart=2026-04-01, +14d=2026-04-15 0:00 UTC
        { now: new Date("2026-04-15T00:00:00Z") },
      );

      expect(result.refundEligible).toBe(true);
    });

    it("Polar 실패 시 rollback → DB cancelAtPeriodEnd 변경 없음", async () => {
      polarMock.updateSubscription.mockRejectedValueOnce(
        new Error("Polar 500"),
      );

      await expect(
        svcWithPolar.scheduleCancelAtPeriodEnd(
          { subscriptionId: subRowId, reason: "x", actorUserId: userId },
          { now: new Date("2026-04-06T00:00:00Z") },
        ),
      ).rejects.toThrow("Polar 500");

      const db = getDrizzleDb();
      const subs = await db
        .select()
        .from(paymentSubscriptions)
        .where(eq(paymentSubscriptions.id, subRowId));
      expect(subs[0]!.cancelAtPeriodEnd).toBe(false);
      expect(subs[0]!.canceledAt).toBeNull();
    });

    it("throws — comp_* polarSubscriptionId 는 미지원 (Polar 호출 0)", async () => {
      const db = getDrizzleDb();
      await db
        .update(paymentSubscriptions)
        .set({ polarSubscriptionId: `comp_test_admin_${orgId}` })
        .where(eq(paymentSubscriptions.id, subRowId));

      await expect(
        svcWithPolar.scheduleCancelAtPeriodEnd(
          { subscriptionId: subRowId, reason: "x", actorUserId: userId },
          { now: new Date("2026-04-06T00:00:00Z") },
        ),
      ).rejects.toThrow(/non-Polar subscription|not supported/i);
      expect(polarMock.updateSubscription).not.toHaveBeenCalled();
    });

    it("propagates — sub 미존재 시 throw + Polar 호출 0", async () => {
      const fake = randomUUID();
      await expect(
        svcWithPolar.scheduleCancelAtPeriodEnd(
          { subscriptionId: fake, reason: "x", actorUserId: userId },
          { now: new Date("2026-04-06T00:00:00Z") },
        ),
      ).rejects.toThrow(/not found/i);
      expect(polarMock.updateSubscription).not.toHaveBeenCalled();
    });
  });

  // ── Task 7 (v2) — cancelImmediatelyWithRefund ─────────────────────

  describe("cancelImmediatelyWithRefund", () => {
    let proMonthlyId: string;
    let proMonthlyProductId: string;
    let polarSubId: string;
    let subRowId: string;
    let orderRowId: string;
    let polarOrderId: string;
    let polarMock: {
      revokeSubscription: jest.Mock;
      refundOrder: jest.Mock;
    };
    let svcWithPolar: SubscriptionService;

    beforeEach(async () => {
      proMonthlyId = randomUUID();
      proMonthlyProductId = `prod_pro_m_${proMonthlyId.slice(0, 8)}`;
      polarSubId = `polar_sub_refund_${orgId}`;
      polarOrderId = `polar_order_${orgId}`;

      polarMock = {
        revokeSubscription: jest.fn(async () => ({})),
        refundOrder: jest.fn(async () => ({ id: "ref_1", status: "succeeded" })),
      };
      svcWithPolar = new SubscriptionService(
        getDrizzleDb(),
        polarMock as unknown as PolarAdapter,
      );

      const db = getDrizzleDb();
      await db.insert(paymentPlans).values({
        id: proMonthlyId,
        slug: `pro-monthly-refund-${proMonthlyId.slice(0, 8)}`,
        cycle: "monthly",
        name: "Pro Monthly Refund",
        priceCents: 4999,
        currency: "USD",
        includedCreditsPerCycle: 5000,
        seats: 5,
        trialDays: 0,
        polarProductId: proMonthlyProductId,
      });

      const insertedSub = await db
        .insert(paymentSubscriptions)
        .values({
          polarSubscriptionId: polarSubId,
          organizationId: orgId,
          userId,
          planId: proMonthlyId,
          status: "active",
          currentPeriodStart: new Date("2026-04-01T00:00:00Z"),
          currentPeriodEnd: new Date("2026-05-01T00:00:00Z"),
        })
        .returning({ id: paymentSubscriptions.id });
      subRowId = insertedSub[0]!.id;

      const insertedOrder = await db
        .insert(paymentOrders)
        .values({
          polarOrderId,
          organizationId: orgId,
          userId,
          subscriptionId: subRowId,
          amountCents: 4999,
          currency: "USD",
          status: "paid",
        })
        .returning({ id: paymentOrders.id });
      orderRowId = insertedOrder[0]!.id;
    });

    afterEach(async () => {
      const db = getDrizzleDb();
      await db.delete(paymentOrders).where(eq(paymentOrders.id, orderRowId));
      await db
        .delete(paymentSubscriptions)
        .where(eq(paymentSubscriptions.id, subRowId));
      await db.delete(paymentPlans).where(eq(paymentPlans.id, proMonthlyId));
    });

    it("14일 이내 → polar revoke + refund + DB status='canceled' + currentPeriodEnd=now", async () => {
      const now = new Date("2026-04-06T00:00:00Z");
      const result = await svcWithPolar.cancelImmediatelyWithRefund(
        { subscriptionId: subRowId, reason: "withdraw", actorUserId: userId },
        { now },
      );

      expect(polarMock.revokeSubscription).toHaveBeenCalledWith(polarSubId);
      expect(polarMock.refundOrder).toHaveBeenCalledWith(
        polarOrderId,
        undefined,
        "withdraw",
      );
      expect(result.refundedCents).toBe(4999);
      expect(result.orderId).toBe(orderRowId);

      const db = getDrizzleDb();
      const subs = await db
        .select()
        .from(paymentSubscriptions)
        .where(eq(paymentSubscriptions.id, subRowId));
      expect(subs[0]!.status).toBe("canceled");
      expect(subs[0]!.currentPeriodEnd.getTime()).toBeLessThanOrEqual(
        now.getTime(),
      );
      expect(subs[0]!.canceledAt).not.toBeNull();
    });

    it("16일차 → throw 'refund_window_closed', polar 호출 0", async () => {
      await expect(
        svcWithPolar.cancelImmediatelyWithRefund(
          { subscriptionId: subRowId, reason: "x", actorUserId: userId },
          { now: new Date("2026-04-17T00:00:00Z") },
        ),
      ).rejects.toThrow(/refund_window_closed/);

      expect(polarMock.revokeSubscription).not.toHaveBeenCalled();
      expect(polarMock.refundOrder).not.toHaveBeenCalled();

      const db = getDrizzleDb();
      const subs = await db
        .select()
        .from(paymentSubscriptions)
        .where(eq(paymentSubscriptions.id, subRowId));
      expect(subs[0]!.status).toBe("active");
    });

    it("revoke 성공 + refund 실패 → tx rollback, DB sub 그대로 active", async () => {
      polarMock.refundOrder.mockRejectedValueOnce(new Error("refund failed"));

      await expect(
        svcWithPolar.cancelImmediatelyWithRefund(
          { subscriptionId: subRowId, reason: "x", actorUserId: userId },
          { now: new Date("2026-04-06T00:00:00Z") },
        ),
      ).rejects.toThrow(/refund failed/);

      expect(polarMock.revokeSubscription).toHaveBeenCalledTimes(1);

      const db = getDrizzleDb();
      const subs = await db
        .select()
        .from(paymentSubscriptions)
        .where(eq(paymentSubscriptions.id, subRowId));
      expect(subs[0]!.status).toBe("active");
      expect(subs[0]!.canceledAt).toBeNull();
    });

    it("throws — comp_* polarSubscriptionId 는 미지원 (Polar 호출 0)", async () => {
      const db = getDrizzleDb();
      await db
        .update(paymentSubscriptions)
        .set({ polarSubscriptionId: `comp_test_admin_${orgId}` })
        .where(eq(paymentSubscriptions.id, subRowId));

      await expect(
        svcWithPolar.cancelImmediatelyWithRefund(
          { subscriptionId: subRowId, reason: "x", actorUserId: userId },
          { now: new Date("2026-04-06T00:00:00Z") },
        ),
      ).rejects.toThrow(/non-Polar subscription|not supported/i);
      expect(polarMock.revokeSubscription).not.toHaveBeenCalled();
      expect(polarMock.refundOrder).not.toHaveBeenCalled();
    });

    it("propagates — sub 미존재 시 throw + Polar 호출 0", async () => {
      const fake = randomUUID();
      await expect(
        svcWithPolar.cancelImmediatelyWithRefund(
          { subscriptionId: fake, reason: "x", actorUserId: userId },
          { now: new Date("2026-04-06T00:00:00Z") },
        ),
      ).rejects.toThrow(/not found/i);
      expect(polarMock.revokeSubscription).not.toHaveBeenCalled();
      expect(polarMock.refundOrder).not.toHaveBeenCalled();
    });
  });

  // ── Task 7 (v2) — uncancelSubscription ─────────────────────────────

  describe("uncancelSubscription", () => {
    let polarSubId: string;
    let subRowId: string;
    let polarMock: { updateSubscription: jest.Mock };
    let svcWithPolar: SubscriptionService;

    beforeEach(async () => {
      polarSubId = `polar_sub_uncancel_${orgId}`;
      polarMock = {
        updateSubscription: jest.fn(async () => ({
          id: polarSubId,
          customerId: "cust_test",
          productId: "prod_test",
          status: "active" as const,
          currentPeriodStart: new Date("2026-04-01T00:00:00Z"),
          currentPeriodEnd: new Date("2026-05-01T00:00:00Z"),
          trialEnd: null,
          cancelAtPeriodEnd: false,
          metadata: {},
        })),
      };
      svcWithPolar = new SubscriptionService(
        getDrizzleDb(),
        polarMock as unknown as PolarAdapter,
      );
    });

    afterEach(async () => {
      if (subRowId) {
        const db = getDrizzleDb();
        await db
          .delete(paymentSubscriptions)
          .where(eq(paymentSubscriptions.id, subRowId));
      }
    });

    it("cancelAtPeriodEnd=true 인 sub → polar PATCH false + DB mirror (cancelAtPeriodEnd=false, canceledAt=null)", async () => {
      const db = getDrizzleDb();
      const inserted = await db
        .insert(paymentSubscriptions)
        .values({
          polarSubscriptionId: polarSubId,
          organizationId: orgId,
          userId,
          planId,
          status: "active",
          cancelAtPeriodEnd: true,
          canceledAt: new Date("2026-04-06T00:00:00Z"),
          currentPeriodStart: new Date("2026-04-01T00:00:00Z"),
          currentPeriodEnd: new Date("2026-05-01T00:00:00Z"),
        })
        .returning({ id: paymentSubscriptions.id });
      subRowId = inserted[0]!.id;

      await svcWithPolar.uncancelSubscription({
        subscriptionId: subRowId,
        actorUserId: userId,
      });

      expect(polarMock.updateSubscription).toHaveBeenCalledTimes(1);
      expect(polarMock.updateSubscription).toHaveBeenCalledWith(polarSubId, {
        cancel_at_period_end: false,
      });

      const subs = await db
        .select()
        .from(paymentSubscriptions)
        .where(eq(paymentSubscriptions.id, subRowId));
      expect(subs[0]!.cancelAtPeriodEnd).toBe(false);
      expect(subs[0]!.canceledAt).toBeNull();
    });

    it("cancelAtPeriodEnd=false 인 sub → idempotent (Polar 호출 없음)", async () => {
      const db = getDrizzleDb();
      const inserted = await db
        .insert(paymentSubscriptions)
        .values({
          polarSubscriptionId: polarSubId,
          organizationId: orgId,
          userId,
          planId,
          status: "active",
          cancelAtPeriodEnd: false,
          currentPeriodStart: new Date("2026-04-01T00:00:00Z"),
          currentPeriodEnd: new Date("2026-05-01T00:00:00Z"),
        })
        .returning({ id: paymentSubscriptions.id });
      subRowId = inserted[0]!.id;

      const result = await svcWithPolar.uncancelSubscription({
        subscriptionId: subRowId,
        actorUserId: userId,
      });

      expect(result.ok).toBe(true);
      expect(polarMock.updateSubscription).not.toHaveBeenCalled();
    });
  });

  it("cancel/extend/changePlan throw when subscription does not exist", async () => {
    const fake = randomUUID();
    await expect(
      svc.cancelSubscriptionNow({ subscriptionId: fake, reason: "x" }),
    ).rejects.toThrow(/not found/);
    await expect(
      svc.extendTrialEnd({ subscriptionId: fake, newTrialEnd: new Date(), reason: "x" }),
    ).rejects.toThrow(/not found/);
    await expect(
      svc.changePlan({ subscriptionId: fake, targetPlanId: planId, billingCycle: "monthly" }),
    ).rejects.toThrow(/not found/);
  });

  // ── Task 14 — audit row 검증 ──────────────────────────────────────

  describe("T14: audit row insert 검증", () => {
    let auditSvc: AuditService;

    // changePlanV2 + cancel/uncancel 용 plans/sub
    let basicMonthlyId: string;
    let proMonthlyId: string;
    let basicProductId: string;
    let proMonthlyProductId: string;
    let polarSubId: string;
    let subRowId: string;
    let polarMock: {
      updateSubscription: jest.Mock;
      revokeSubscription: jest.Mock;
      refundOrder: jest.Mock;
    };
    let svcAudit: SubscriptionService;

    beforeEach(async () => {
      const db = getDrizzleDb();
      auditSvc = new AuditService(db);

      basicMonthlyId = randomUUID();
      proMonthlyId = randomUUID();
      basicProductId = `prod_basic_t14_${basicMonthlyId.slice(0, 8)}`;
      proMonthlyProductId = `prod_pro_t14_${proMonthlyId.slice(0, 8)}`;
      polarSubId = `polar_sub_t14_${orgId}`;

      polarMock = {
        updateSubscription: jest.fn(async () => ({
          id: polarSubId,
          customerId: "cust_t14",
          productId: proMonthlyProductId,
          status: "active" as const,
          currentPeriodStart: new Date("2026-04-01T00:00:00Z"),
          currentPeriodEnd: new Date("2026-05-01T00:00:00Z"),
          trialEnd: null,
          cancelAtPeriodEnd: false,
          metadata: {},
        })),
        revokeSubscription: jest.fn(async () => ({})),
        refundOrder: jest.fn(async () => ({ id: "ref_t14", status: "succeeded" })),
      };
      svcAudit = new SubscriptionService(
        db,
        polarMock as unknown as PolarAdapter,
        auditSvc,
      );

      await db.insert(paymentPlans).values({
        id: basicMonthlyId,
        slug: `basic-t14-${basicMonthlyId.slice(0, 8)}`,
        cycle: "monthly",
        name: "Basic T14",
        priceCents: 1999,
        currency: "USD",
        includedCreditsPerCycle: 1000,
        seats: 1,
        trialDays: 0,
        polarProductId: basicProductId,
      });
      await db.insert(paymentPlans).values({
        id: proMonthlyId,
        slug: `pro-t14-${proMonthlyId.slice(0, 8)}`,
        cycle: "monthly",
        name: "Pro T14",
        priceCents: 4999,
        currency: "USD",
        includedCreditsPerCycle: 5000,
        seats: 5,
        trialDays: 0,
        polarProductId: proMonthlyProductId,
      });

      const inserted = await db
        .insert(paymentSubscriptions)
        .values({
          polarSubscriptionId: polarSubId,
          organizationId: orgId,
          userId,
          planId: basicMonthlyId,
          status: "active",
          currentPeriodStart: new Date("2026-04-01T00:00:00Z"),
          currentPeriodEnd: new Date("2026-05-01T00:00:00Z"),
        })
        .returning({ id: paymentSubscriptions.id });
      subRowId = inserted[0]!.id;
    });

    afterEach(async () => {
      const db = getDrizzleDb();
      // audit rows cleanup
      await db
        .delete(paymentAuditLog)
        .where(eq(paymentAuditLog.targetSubscriptionId, subRowId));
      await db
        .delete(paymentPendingPlanChanges)
        .where(eq(paymentPendingPlanChanges.subscriptionId, subRowId));
      await db
        .delete(paymentOrders)
        .where(eq(paymentOrders.subscriptionId, subRowId));
      await db
        .delete(paymentSubscriptions)
        .where(eq(paymentSubscriptions.id, subRowId));
      await db.delete(paymentPlans).where(eq(paymentPlans.id, basicMonthlyId));
      await db.delete(paymentPlans).where(eq(paymentPlans.id, proMonthlyId));
    });

    it("changePlanV2 upgrade → audit row 'change_plan_v2' insert", async () => {
      await svcAudit.changePlanV2(
        { subscriptionId: subRowId, targetPlanId: proMonthlyId, actorUserId: userId },
        { now: new Date("2026-04-15T00:00:00Z") },
      );
      const db = getDrizzleDb();
      const audits = await db
        .select()
        .from(paymentAuditLog)
        .where(
          and(
            eq(paymentAuditLog.action, "change_plan_v2"),
            eq(paymentAuditLog.targetSubscriptionId, subRowId),
          ),
        );
      expect(audits.length).toBe(1);
      expect(audits[0]!.actorUserId).toBe(userId);
      const payload = audits[0]!.payloadAfter as Record<string, unknown>;
      expect(payload.kind).toBe("upgrade");
      expect(typeof payload.prorationCents).toBe("number");
      // T14: credit grant 정보가 payloadAfter.creditChanges 에 기록되어야 함
      // basic(1000) → pro(5000) diff=4000
      const cc = payload.creditChanges as Record<string, unknown>;
      expect(cc.grant).toBe(4000);
      expect(cc.revoke).toBeUndefined();
    });

    it("changePlanV2 downgrade → audit row 'schedule_downgrade' insert", async () => {
      // sub 를 pro 로 먼저 이동 (direct DB update)
      const db = getDrizzleDb();
      await db
        .update(paymentSubscriptions)
        .set({ planId: proMonthlyId })
        .where(eq(paymentSubscriptions.id, subRowId));

      await svcAudit.changePlanV2(
        { subscriptionId: subRowId, targetPlanId: basicMonthlyId, actorUserId: userId },
        { now: new Date("2026-04-15T00:00:00Z") },
      );
      const audits = await db
        .select()
        .from(paymentAuditLog)
        .where(
          and(
            eq(paymentAuditLog.action, "schedule_downgrade"),
            eq(paymentAuditLog.targetSubscriptionId, subRowId),
          ),
        );
      expect(audits.length).toBe(1);
      const payload = audits[0]!.payloadAfter as Record<string, unknown>;
      expect(payload.toPlanId).toBe(basicMonthlyId);
    });

    it("scheduleCancelAtPeriodEnd → audit row 'cancel_at_period_end' insert", async () => {
      await svcAudit.scheduleCancelAtPeriodEnd(
        { subscriptionId: subRowId, reason: "cost", actorUserId: userId },
        { now: new Date("2026-04-06T00:00:00Z") },
      );
      const db = getDrizzleDb();
      const audits = await db
        .select()
        .from(paymentAuditLog)
        .where(
          and(
            eq(paymentAuditLog.action, "cancel_at_period_end"),
            eq(paymentAuditLog.targetSubscriptionId, subRowId),
          ),
        );
      expect(audits.length).toBe(1);
      expect(audits[0]!.reason).toBe("cost");
      const payload = audits[0]!.payloadAfter as Record<string, unknown>;
      expect(payload.refundEligible).toBe(true);
    });

    it("cancelImmediatelyWithRefund → audit row 'cancel_with_refund' insert", async () => {
      const db = getDrizzleDb();
      // paid order 필요
      await db.insert(paymentOrders).values({
        polarOrderId: `polar_order_t14_${orgId}`,
        organizationId: orgId,
        userId,
        subscriptionId: subRowId,
        amountCents: 1999,
        currency: "USD",
        status: "paid",
      });

      await svcAudit.cancelImmediatelyWithRefund(
        { subscriptionId: subRowId, reason: "withdraw", actorUserId: userId },
        { now: new Date("2026-04-06T00:00:00Z") },
      );
      const audits = await db
        .select()
        .from(paymentAuditLog)
        .where(
          and(
            eq(paymentAuditLog.action, "cancel_with_refund"),
            eq(paymentAuditLog.targetSubscriptionId, subRowId),
          ),
        );
      expect(audits.length).toBe(1);
      expect(audits[0]!.reason).toBe("withdraw");
      const payload = audits[0]!.payloadAfter as Record<string, unknown>;
      expect(payload.refundedCents).toBe(1999);
    });

    it("uncancelSubscription → audit row 'uncancel' insert", async () => {
      const db = getDrizzleDb();
      // cancelAtPeriodEnd=true 로 먼저 설정
      await db
        .update(paymentSubscriptions)
        .set({ cancelAtPeriodEnd: true, canceledAt: new Date() })
        .where(eq(paymentSubscriptions.id, subRowId));

      await svcAudit.uncancelSubscription({ subscriptionId: subRowId, actorUserId: userId });

      const audits = await db
        .select()
        .from(paymentAuditLog)
        .where(
          and(
            eq(paymentAuditLog.action, "uncancel"),
            eq(paymentAuditLog.targetSubscriptionId, subRowId),
          ),
        );
      expect(audits.length).toBe(1);
      expect(audits[0]!.actorUserId).toBe(userId);
    });
  });
});
