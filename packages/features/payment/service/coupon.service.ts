/**
 * CouponService — Polar discount mirror + redemption tracking (Phase 7 / G5).
 *
 * Spec §3.2.9 / §3.2.10 / §5.4 / §8.A5.
 *
 * Responsibilities:
 *   - createCoupon  → optionally call Polar to register the discount, then
 *                     mirror the resulting `polarDiscountId` to our table.
 *   - listCoupons   → admin pagination.
 *   - getCouponByCode / previewCoupon → checkout-time validation.
 *   - recordRedemption → called from the webhook dispatcher's
 *     `discount.applied` route. Idempotent on (coupon, org, sub, order)
 *     via a SELECT-then-INSERT pre-check inside a transaction (the
 *     uniqueIndex treats NULLs as distinct, so we can't lean on
 *     ON CONFLICT alone). Enforces INV-3
 *     (`redemption_count <= max_redemptions`) atomically via
 *     check-on-update: insert the redemption row first, then UPDATE the
 *     coupon counter with a WHERE clause that fails if the cap is reached;
 *     on cap-hit, delete the redemption row and throw.
 *   - archiveCoupon → soft delete (is_active=false) + audit log.
 *
 * Concurrency on max_redemptions:
 *   We deliberately separate the redemption row from the counter so the
 *   partial-unique index `payment_coupon_redemptions_uniq` can absorb
 *   webhook replays for free. Two concurrent first-time redemptions both
 *   insert their redemption rows; the UPDATE then races, but the
 *   `redemption_count < max_redemptions` predicate inside the UPDATE WHERE
 *   means at most `max_redemptions` increments succeed (Postgres serializes
 *   per-row updates). Whichever loses gets 0 affected rows back, deletes
 *   its redemption row, and throws "exhausted".
 *
 * PolarAdapter dependency:
 *   Injected as an interface. Tests pass a tiny mock; production code passes
 *   the real PolarAdapter. When omitted, createCoupon synthesizes a mock
 *   discount id (`mock_<uuid>`) so the row still has a unique value — handy
 *   for local dev / e2e without Polar credentials.
 */
import { randomUUID } from "node:crypto";
import { and, desc, eq, isNull, sql , type SQL} from "drizzle-orm";
import {
  type DrizzleDB,
  type PaymentCoupon,
  paymentCouponRedemptions,
  paymentCoupons,
} from "@repo/drizzle";

import type { AuditService } from "./audit.service";

/**
 * Polar discount code format. Per Polar docs, discount codes must be
 * uppercase alphanumeric + dashes/underscores, 3-50 chars. Validating
 * upfront surfaces a clear error to the admin instead of letting Polar's
 * API return a generic 422.
 */
const DISCOUNT_CODE_RE = /^[A-Z0-9_-]{3,50}$/;

export function isValidDiscountCode(code: string): boolean {
  return DISCOUNT_CODE_RE.test(code);
}

/** Slim subset of PolarAdapter we depend on. Lets tests pass a mock. */
export interface PolarDiscountAdapter {
  createDiscount(input: {
    code: string;
    type: "percentage" | "fixed";
    percentage?: number;
    amountCents?: number;
    duration: "once" | "repeating" | "forever";
    durationInMonths?: number;
    maxRedemptions?: number;
    expiresAt?: Date;
  }): Promise<{ id: string; code: string }>;
}

export interface CouponServiceDeps {
  polarAdapter?: PolarDiscountAdapter;
  audit?: AuditService;
}

export interface CreateCouponInput {
  code: string;
  type: "percent" | "amount";
  percentOff?: number;
  amountOffCents?: number;
  duration: "once" | "repeating" | "forever";
  durationInMonths?: number;
  appliesTo: "subscription" | "top_up" | "both";
  maxRedemptions?: number;
  expiresAt?: Date;
  createdByAdminId: string;
}

export interface DiscountInfo {
  couponId: string;
  type: "percent" | "amount";
  percentOff?: number;
  amountOffCents?: number;
  duration: "once" | "repeating" | "forever";
  durationInMonths?: number;
}

export type PreviewResult =
  | { valid: true; discountInfo: DiscountInfo }
  | {
      valid: false;
      reason: "not_found" | "expired" | "exhausted" | "scope_mismatch" | "inactive";
    };

export interface RecordRedemptionInput {
  polarDiscountId: string;
  polarEventRef: string;
  organizationId: string;
  subscriptionId?: string;
  orderId?: string;
}

export class CouponService {
  constructor(
    private readonly db: DrizzleDB,
    private readonly deps: CouponServiceDeps = {},
  ) {}

  // ──────────────────────────────────────────────────────────────────
  // createCoupon
  // ──────────────────────────────────────────────────────────────────

  async createCoupon(
    input: CreateCouponInput,
  ): Promise<{ couponId: string; polarDiscountId: string }> {
    // Validate type/value coherence before talking to Polar — avoids
    // creating a Polar discount we'd then fail to mirror.
    if (!isValidDiscountCode(input.code)) {
      throw new Error(
        `[coupon] invalid discount code format: must match ^[A-Z0-9_-]{3,50}$`,
      );
    }
    if (input.type === "percent") {
      if (
        input.percentOff === undefined ||
        input.percentOff < 1 ||
        input.percentOff > 100
      ) {
        throw new Error(
          "[coupon] percent coupons require percentOff in [1, 100]",
        );
      }
      if (input.amountOffCents !== undefined) {
        throw new Error(
          "[coupon] percent coupons must not set amountOffCents",
        );
      }
    } else {
      if (input.amountOffCents === undefined || input.amountOffCents <= 0) {
        throw new Error(
          "[coupon] amount coupons require amountOffCents > 0",
        );
      }
      if (input.percentOff !== undefined) {
        throw new Error("[coupon] amount coupons must not set percentOff");
      }
    }
    if (input.duration === "repeating" && !input.durationInMonths) {
      throw new Error(
        "[coupon] repeating coupons require durationInMonths",
      );
    }

    let polarDiscountId: string;
    if (this.deps.polarAdapter) {
      const polar = await this.deps.polarAdapter.createDiscount({
        code: input.code,
        type: input.type === "percent" ? "percentage" : "fixed",
        percentage: input.percentOff,
        amountCents: input.amountOffCents,
        duration: input.duration,
        durationInMonths: input.durationInMonths,
        maxRedemptions: input.maxRedemptions,
        expiresAt: input.expiresAt,
      });
      polarDiscountId = polar.id;
    } else {
      polarDiscountId = `mock_${randomUUID()}`;
    }

    const inserted = await this.db
      .insert(paymentCoupons)
      .values({
        polarDiscountId,
        code: input.code,
        type: input.type,
        percentOff: input.percentOff ?? null,
        amountOffCents: input.amountOffCents ?? null,
        duration: input.duration,
        durationInMonths: input.durationInMonths ?? null,
        appliesTo: input.appliesTo,
        maxRedemptions: input.maxRedemptions ?? null,
        expiresAt: input.expiresAt ?? null,
        createdByAdminId: input.createdByAdminId,
      })
      .returning({ id: paymentCoupons.id });
    return { couponId: inserted[0]!.id, polarDiscountId };
  }

  // ──────────────────────────────────────────────────────────────────
  // listCoupons
  // ──────────────────────────────────────────────────────────────────

  async listCoupons(
    filter: { isActive?: boolean; cursor?: string; limit?: number } = {},
  ): Promise<PaymentCoupon[]> {
    const limit = Math.min(filter.limit ?? 50, 200);
    const conditions: SQL[] = [];
    if (filter.isActive !== undefined) {
      conditions.push(eq(paymentCoupons.isActive, filter.isActive));
    }
    if (filter.cursor) {
      // String cursor = uuid; uuids aren't lexicographically meaningful for
      // pagination, so we use createdAt + id from the cursor row. To keep
      // the API simple here, the caller passes the last seen id and we
      // filter by `created_at < <that row's createdAt>`. This requires a
      // round trip; acceptable for admin pagination.
      const cursorRow = await this.db
        .select({ createdAt: paymentCoupons.createdAt })
        .from(paymentCoupons)
        .where(eq(paymentCoupons.id, filter.cursor));
      if (cursorRow[0]) {
        conditions.push(
          sql`${paymentCoupons.createdAt} < ${cursorRow[0].createdAt}`,
        );
      }
    }
    const where = conditions.length ? and(...conditions) : undefined;
    return this.db
      .select()
      .from(paymentCoupons)
      .where(where)
      .orderBy(desc(paymentCoupons.createdAt))
      .limit(limit);
  }

  // ──────────────────────────────────────────────────────────────────
  // getCouponByCode
  // ──────────────────────────────────────────────────────────────────

  async getCouponByCode(code: string): Promise<PaymentCoupon | null> {
    const rows = await this.db
      .select()
      .from(paymentCoupons)
      .where(eq(paymentCoupons.code, code))
      .limit(1);
    return rows[0] ?? null;
  }

  // ──────────────────────────────────────────────────────────────────
  // previewCoupon — checkout-time validation
  // ──────────────────────────────────────────────────────────────────

  async previewCoupon(input: {
    code: string;
    scope: "subscription" | "top_up";
  }): Promise<PreviewResult> {
    const c = await this.getCouponByCode(input.code);
    if (!c) return { valid: false, reason: "not_found" };
    if (!c.isActive) return { valid: false, reason: "inactive" };
    if (c.expiresAt && c.expiresAt.getTime() <= Date.now()) {
      return { valid: false, reason: "expired" };
    }
    if (
      c.maxRedemptions !== null &&
      c.redemptionCount >= c.maxRedemptions
    ) {
      return { valid: false, reason: "exhausted" };
    }
    if (c.appliesTo !== "both" && c.appliesTo !== input.scope) {
      return { valid: false, reason: "scope_mismatch" };
    }
    return {
      valid: true,
      discountInfo: {
        couponId: c.id,
        type: c.type,
        percentOff: c.percentOff ?? undefined,
        amountOffCents: c.amountOffCents ?? undefined,
        duration: c.duration,
        durationInMonths: c.durationInMonths ?? undefined,
      },
    };
  }

  // ──────────────────────────────────────────────────────────────────
  // recordRedemption — webhook entry point
  // ──────────────────────────────────────────────────────────────────

  /**
   * Insert a redemption row + atomically increment `redemption_count`,
   * enforcing the cap. See class doc for the concurrency story.
   *
   * Idempotent on the (coupon, org, sub, order) tuple — webhook replays
   * are absorbed by the partial-unique index.
   */
  async recordRedemption(input: RecordRedemptionInput): Promise<void> {
    return this.db.transaction(async (tx) => {
      const couponRows = await tx
        .select({
          id: paymentCoupons.id,
          maxRedemptions: paymentCoupons.maxRedemptions,
        })
        .from(paymentCoupons)
        .where(eq(paymentCoupons.polarDiscountId, input.polarDiscountId))
        .limit(1);
      const coupon = couponRows[0];
      if (!coupon) {
        // Unknown discount id from Polar — log and drop. Not throwing keeps
        // the webhook 200 so Polar doesn't retry indefinitely on a coupon
        // we never mirrored locally (e.g. legacy or out-of-band).
        return;
      }

      // Service-level dedup. The schema's uniqueIndex on
      // (coupon, org, sub, order) treats NULLs as DISTINCT (Postgres
      // default), so two redemptions with identical sub but null order
      // would NOT trip ON CONFLICT. We pre-check existence with proper
      // IS NULL semantics, then INSERT. Inside the transaction this is
      // race-safe enough for our use case — webhook replays from Polar
      // arrive serially per (event,delivery) and the redemption row is
      // the canonical anti-duplicate marker.
      const existing = await tx
        .select({ id: paymentCouponRedemptions.id })
        .from(paymentCouponRedemptions)
        .where(
          and(
            eq(paymentCouponRedemptions.couponId, coupon.id),
            eq(paymentCouponRedemptions.organizationId, input.organizationId),
            input.subscriptionId
              ? eq(paymentCouponRedemptions.subscriptionId, input.subscriptionId)
              : isNull(paymentCouponRedemptions.subscriptionId),
            input.orderId
              ? eq(paymentCouponRedemptions.orderId, input.orderId)
              : isNull(paymentCouponRedemptions.orderId),
          ),
        )
        .limit(1);
      if (existing[0]) {
        // Duplicate (replay). No counter increment — spec §8.A5.
        return;
      }

      const insertedRedemption = await tx
        .insert(paymentCouponRedemptions)
        .values({
          couponId: coupon.id,
          organizationId: input.organizationId,
          subscriptionId: input.subscriptionId ?? null,
          orderId: input.orderId ?? null,
          polarEventRef: input.polarEventRef,
        })
        .returning({ id: paymentCouponRedemptions.id });

      const newRedemptionId = insertedRedemption[0]!.id;

      // Atomic check-and-increment. If max_redemptions is null, the second
      // disjunct of the OR is always true → unbounded.
      const updated = await tx
        .update(paymentCoupons)
        .set({ redemptionCount: sql`${paymentCoupons.redemptionCount} + 1` })
        .where(
          and(
            eq(paymentCoupons.id, coupon.id),
            sql`(${paymentCoupons.maxRedemptions} IS NULL OR ${paymentCoupons.redemptionCount} < ${paymentCoupons.maxRedemptions})`,
          ),
        )
        .returning({ id: paymentCoupons.id });

      if (updated.length === 0) {
        // Cap was hit between our SELECT and UPDATE. Roll back our
        // redemption row so INV-3 holds and the caller learns to fail.
        await tx
          .delete(paymentCouponRedemptions)
          .where(eq(paymentCouponRedemptions.id, newRedemptionId));
        throw new Error(
          `[coupon] exhausted: ${input.polarDiscountId} reached max_redemptions`,
        );
      }
    });
  }

  // ──────────────────────────────────────────────────────────────────
  // archiveCoupon
  // ──────────────────────────────────────────────────────────────────

  async archiveCoupon(input: {
    couponId: string;
    actorUserId: string;
    reason?: string;
  }): Promise<void> {
    const before = await this.db
      .select()
      .from(paymentCoupons)
      .where(eq(paymentCoupons.id, input.couponId));
    if (!before[0]) {
      throw new Error(`[coupon] not found: ${input.couponId}`);
    }
    await this.db
      .update(paymentCoupons)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(paymentCoupons.id, input.couponId));

    if (this.deps.audit) {
      await this.deps.audit.log({
        actorUserId: input.actorUserId,
        action: "archive_coupon",
        payloadBefore: { isActive: before[0].isActive, code: before[0].code },
        payloadAfter: { isActive: false, code: before[0].code },
        reason: input.reason,
      });
    }
  }
}

