/**
 * CouponService — DB-backed tests (Phase 7 Task 7.2).
 *
 *   1. createCoupon mirrors Polar discount + writes coupons row
 *   2. previewCoupon: not_found
 *   3. previewCoupon: scope_mismatch (top_up code applied to subscription)
 *   4. previewCoupon: exhausted (max_redemptions reached)
 *   5. previewCoupon: expired
 *   6. previewCoupon: valid happy path returns discountInfo
 *   7. recordRedemption increments redemption_count + inserts redemption row
 *   8. recordRedemption idempotent on duplicate (coupon, org, sub) tuple
 *   9. recordRedemption rejects when max_redemptions exceeded
 *  10. archiveCoupon sets is_active=false + emits audit log entry
 */
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { paymentCouponRedemptions, paymentCoupons } from "@repo/drizzle";
import {
  cleanupAuditByActor,
  cleanupCouponByCode,
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
import type { AuditEntry, AuditService } from "./audit.service";
import type { DrizzleDB } from "@repo/drizzle";
import {
  CouponService,
  type CreateCouponInput,
  isValidDiscountCode,
  type PolarDiscountAdapter,
} from "./coupon.service";

const describeIfDb = hasDb ? describe : describe.skip;

jest.setTimeout(30_000);

function makePolarMock(): jest.Mocked<PolarDiscountAdapter> {
  return {
    createDiscount: jest.fn(async (input) => ({
      id: `polar_disc_${randomUUID()}`,
      code: input.code,
    })),
  };
}

function uniqueCode(prefix: string): string {
  return `${prefix.toUpperCase()}_${randomUUID().slice(0, 8).toUpperCase()}`;
}

describeIfDb("CouponService", () => {
  let svc: CouponService;
  let polar: jest.Mocked<PolarDiscountAdapter>;
  let adminId: string;
  // Track every coupon code created in a test so afterEach can drop it
  // (and cascade redemptions).
  const codesToCleanup: string[] = [];

  beforeAll(() => {
    polar = makePolarMock();
    svc = new CouponService(getDrizzleDb(), { polarAdapter: polar });
  });

  beforeEach(async () => {
    adminId = newUserId("coupon-admin");
    await ensureUser(adminId);
    polar.createDiscount.mockClear();
  });

  afterEach(async () => {
    for (const code of codesToCleanup.splice(0)) {
      await cleanupCouponByCode(code);
    }
    await cleanupAuditByActor(adminId);
    await cleanupUser(adminId);
  });

  afterAll(async () => {
    await endTestDb();
  });

  function trackCode(code: string): string {
    codesToCleanup.push(code);
    return code;
  }

  // Seeds org + user + plan + subscription so a redemption row's FKs all
  // resolve. Returns ids + an idempotent cleanup that drops all of them.
  async function seedOrgWithSub(prefix: string): Promise<{
    orgId: string;
    subId: string;
    cleanup: () => Promise<void>;
  }> {
    const orgId = newOrgId(prefix);
    const userId = newUserId(`${prefix}-u`);
    const planId = randomUUID();
    const subId = randomUUID();
    await ensureOrg(orgId);
    await ensureUser(userId);
    await ensurePlan(planId, { slug: `coupon-${planId.slice(0, 8)}` });
    await ensureSubscription(subId, { orgId, userId, planId });
    return {
      orgId,
      subId,
      cleanup: async () => {
        await cleanupOrg(orgId);
        await cleanupPlan(planId);
        await cleanupUser(userId);
      },
    };
  }

  // Helper — minimal valid input that can be overridden per-test.
  function makeInput(overrides: Partial<CreateCouponInput> = {}): CreateCouponInput {
    const code = trackCode(uniqueCode("save"));
    return {
      code,
      type: "percent",
      percentOff: 20,
      duration: "once",
      appliesTo: "subscription",
      createdByAdminId: adminId,
      ...overrides,
    };
  }

  // ── 1 ────────────────────────────────────────────────────────────
  it("createCoupon: calls Polar + mirrors row to payment_coupons", async () => {
    const input = makeInput();
    const out = await svc.createCoupon(input);

    expect(polar.createDiscount).toHaveBeenCalledTimes(1);
    expect(polar.createDiscount).toHaveBeenCalledWith(
      expect.objectContaining({
        code: input.code,
        type: "percentage",
        percentage: 20,
        duration: "once",
      }),
    );
    expect(out.couponId).toMatch(/^[0-9a-f-]{36}$/);
    expect(out.polarDiscountId).toMatch(/^polar_disc_/);

    const rows = await getDrizzleDb()
      .select()
      .from(paymentCoupons)
      .where(eq(paymentCoupons.id, out.couponId));
    expect(rows).toHaveLength(1);
    const r = rows[0]!;
    expect(r.code).toBe(input.code);
    expect(r.type).toBe("percent");
    expect(r.percentOff).toBe(20);
    expect(r.amountOffCents).toBeNull();
    expect(r.polarDiscountId).toBe(out.polarDiscountId);
    expect(r.isActive).toBe(true);
    expect(r.redemptionCount).toBe(0);
  });

  // ── 2 ────────────────────────────────────────────────────────────
  it("previewCoupon: not_found for unknown code", async () => {
    const out = await svc.previewCoupon({
      code: "NOPE_DOES_NOT_EXIST",
      scope: "subscription",
    });
    expect(out).toEqual({ valid: false, reason: "not_found" });
  });

  // ── 3 ────────────────────────────────────────────────────────────
  it("previewCoupon: scope_mismatch when top_up code is applied to subscription", async () => {
    const input = makeInput({ appliesTo: "top_up" });
    await svc.createCoupon(input);
    const out = await svc.previewCoupon({
      code: input.code,
      scope: "subscription",
    });
    expect(out).toEqual({ valid: false, reason: "scope_mismatch" });
  });

  // ── 4 ────────────────────────────────────────────────────────────
  it("previewCoupon: exhausted when redemption_count >= max_redemptions", async () => {
    const input = makeInput({ maxRedemptions: 1 });
    const { couponId } = await svc.createCoupon(input);
    // Manually bump the count to the cap (avoid threading a redemption
    // through here — that's exercised by tests 7-9).
    await getDrizzleDb()
      .update(paymentCoupons)
      .set({ redemptionCount: 1 })
      .where(eq(paymentCoupons.id, couponId));

    const out = await svc.previewCoupon({
      code: input.code,
      scope: "subscription",
    });
    expect(out).toEqual({ valid: false, reason: "exhausted" });
  });

  // ── 5 ────────────────────────────────────────────────────────────
  it("previewCoupon: expired when expiresAt in the past", async () => {
    const yesterday = new Date(Date.now() - 86_400_000);
    const input = makeInput({ expiresAt: yesterday });
    await svc.createCoupon(input);
    const out = await svc.previewCoupon({
      code: input.code,
      scope: "subscription",
    });
    expect(out).toEqual({ valid: false, reason: "expired" });
  });

  // ── 6 ────────────────────────────────────────────────────────────
  it("previewCoupon: valid happy path returns full discountInfo", async () => {
    const input = makeInput({
      type: "amount",
      percentOff: undefined,
      amountOffCents: 500,
      appliesTo: "both",
      duration: "repeating",
      durationInMonths: 3,
    });
    const { couponId } = await svc.createCoupon(input);
    const out = await svc.previewCoupon({
      code: input.code,
      scope: "subscription",
    });
    expect(out).toEqual({
      valid: true,
      discountInfo: {
        couponId,
        type: "amount",
        amountOffCents: 500,
        percentOff: undefined,
        duration: "repeating",
        durationInMonths: 3,
      },
    });
  });

  // ── 7 ────────────────────────────────────────────────────────────
  it("recordRedemption: inserts redemption row + increments redemption_count", async () => {
    const input = makeInput();
    const { couponId, polarDiscountId } = await svc.createCoupon(input);
    const ctx = await seedOrgWithSub("redeem");
    try {
      await svc.recordRedemption({
        polarDiscountId,
        polarEventRef: "evt_redeem_1",
        organizationId: ctx.orgId,
        subscriptionId: ctx.subId,
      });

      const rRows = await getDrizzleDb()
        .select()
        .from(paymentCouponRedemptions)
        .where(eq(paymentCouponRedemptions.couponId, couponId));
      expect(rRows).toHaveLength(1);
      expect(rRows[0]!.organizationId).toBe(ctx.orgId);
      expect(rRows[0]!.polarEventRef).toBe("evt_redeem_1");

      const c = await getDrizzleDb()
        .select()
        .from(paymentCoupons)
        .where(eq(paymentCoupons.id, couponId));
      expect(c[0]!.redemptionCount).toBe(1);
    } finally {
      await ctx.cleanup();
    }
  });

  // ── 8 ────────────────────────────────────────────────────────────
  it("recordRedemption: idempotent on duplicate (coupon, org, sub) tuple", async () => {
    const input = makeInput();
    const { couponId, polarDiscountId } = await svc.createCoupon(input);
    const ctx = await seedOrgWithSub("redeem-dup");
    try {
      // Fire twice with identical tuple — second is a webhook replay.
      await svc.recordRedemption({
        polarDiscountId,
        polarEventRef: "evt_dup_1",
        organizationId: ctx.orgId,
        subscriptionId: ctx.subId,
      });
      await svc.recordRedemption({
        polarDiscountId,
        polarEventRef: "evt_dup_2", // different event, same tuple
        organizationId: ctx.orgId,
        subscriptionId: ctx.subId,
      });

      const rRows = await getDrizzleDb()
        .select()
        .from(paymentCouponRedemptions)
        .where(eq(paymentCouponRedemptions.couponId, couponId));
      expect(rRows).toHaveLength(1);

      const c = await getDrizzleDb()
        .select()
        .from(paymentCoupons)
        .where(eq(paymentCoupons.id, couponId));
      expect(c[0]!.redemptionCount).toBe(1);
    } finally {
      await ctx.cleanup();
    }
  });

  // ── 9 ────────────────────────────────────────────────────────────
  it("recordRedemption: throws 'exhausted' when max_redemptions exceeded", async () => {
    const input = makeInput({ maxRedemptions: 1 });
    const { couponId, polarDiscountId } = await svc.createCoupon(input);
    const ctxA = await seedOrgWithSub("cap-a");
    const ctxB = await seedOrgWithSub("cap-b");
    try {
      // First org redeems — fine.
      await svc.recordRedemption({
        polarDiscountId,
        polarEventRef: "evt_cap_1",
        organizationId: ctxA.orgId,
        subscriptionId: ctxA.subId,
      });
      // Second org redeems — should hit the cap and throw.
      await expect(
        svc.recordRedemption({
          polarDiscountId,
          polarEventRef: "evt_cap_2",
          organizationId: ctxB.orgId,
          subscriptionId: ctxB.subId,
        }),
      ).rejects.toThrow(/exhausted/);

      // The redemption we tried to add for orgB was rolled back.
      const rRows = await getDrizzleDb()
        .select()
        .from(paymentCouponRedemptions)
        .where(eq(paymentCouponRedemptions.couponId, couponId));
      expect(rRows).toHaveLength(1);
      expect(rRows[0]!.organizationId).toBe(ctxA.orgId);

      // Counter stayed at 1.
      const c = await getDrizzleDb()
        .select()
        .from(paymentCoupons)
        .where(eq(paymentCoupons.id, couponId));
      expect(c[0]!.redemptionCount).toBe(1);
    } finally {
      await ctxA.cleanup();
      await ctxB.cleanup();
    }
  });

  // ── 10 ───────────────────────────────────────────────────────────
  it("archiveCoupon: sets is_active=false + emits audit log via injected service", async () => {
    const input = makeInput();
    const { couponId } = await svc.createCoupon(input);

    const calls: AuditEntry[] = [];
    const audit: AuditService = {
      log: jest.fn(async (e: AuditEntry) => {
        calls.push(e);
      }),
    } as unknown as AuditService;
    const svcWithAudit = new CouponService(getDrizzleDb(), {
      polarAdapter: polar,
      audit,
    });

    await svcWithAudit.archiveCoupon({
      couponId,
      actorUserId: adminId,
      reason: "promotion ended",
    });

    const c = await getDrizzleDb()
      .select()
      .from(paymentCoupons)
      .where(eq(paymentCoupons.id, couponId));
    expect(c[0]!.isActive).toBe(false);

    expect(calls).toHaveLength(1);
    expect(calls[0]!.action).toBe("archive_coupon");
    expect(calls[0]!.actorUserId).toBe(adminId);
    expect(calls[0]!.reason).toBe("promotion ended");
  });
});

// ──────────────────────────────────────────────────────────────────
// Discount code format validation [I] — pure unit, no DB required.
// ──────────────────────────────────────────────────────────────────

describe("CouponService — discount code format [I]", () => {
  it.each([
    ["VALID_CODE_123", true],
    ["a", false], // too short, lowercase
    ["", false], // empty
    ["LOWER-case", false], // lowercase mixed
    [`EXACTLY-50-CHARS_${"A".repeat(33)}`, true], // exactly 50 (17 + 33 = 50)
    [`TOO_LONG_${"X".repeat(60)}`, false], // > 50
    ["WITH SPACE", false],
    ["WITH+SYMBOL", false],
  ])("isValidDiscountCode(%s) === %s", (code, expected) => {
    expect(isValidDiscountCode(code)).toBe(expected);
  });

  it("createCoupon rejects invalid code upfront (does not call adapter or db)", async () => {
    const polarMock: jest.Mocked<PolarDiscountAdapter> = {
      createDiscount: jest.fn(),
    };
    // Stub DB — should never be reached because validation throws first.
    const dbStub = {
      insert: jest.fn(() => {
        throw new Error("db.insert should not be called");
      }),
    } as unknown as DrizzleDB;
    const svc = new CouponService(dbStub, { polarAdapter: polarMock });

    await expect(
      svc.createCoupon({
        code: "lower-case", // invalid format
        type: "percent",
        percentOff: 20,
        duration: "once",
        appliesTo: "subscription",
        createdByAdminId: randomUUID(),
      }),
    ).rejects.toThrow(/invalid discount code format/);

    expect(polarMock.createDiscount).not.toHaveBeenCalled();
  });
});
