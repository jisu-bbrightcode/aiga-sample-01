import { Injectable } from "@nestjs/common";
import { and, eq, inArray, sql, sum } from "drizzle-orm";
import { addSeconds } from "date-fns";
import {
  type DrizzleDB,
  paymentCreditLedger,
  paymentSubscriptions,
  paymentUsageLedger,
  paymentUsageReserves,
} from "@repo/drizzle";
import { calculateModelCost } from "../config/model-pricing";

export interface ReserveInput {
  orgId: string;
  refId: string;
  estimateCents: number;
  /** default 300 (5 min) */
  expiresInSec?: number;
}

export interface ReserveResult {
  reservationId: string;
  totalAvailable: number;
}

export interface ClaimInput {
  reservationId: string;
  actualInputTokens: number;
  actualOutputTokens: number;
  model: string;
}

@Injectable()
export class AiUsageMeterService {
  constructor(private readonly db: DrizzleDB) {}

  /**
   * Reserve usage before an AI call.
   * Idempotent: same (orgId, refId) with status='reserved' → returns existing reservation.
   * Throws 'insufficient_balance' when available < estimateCents.
   */
  async reserve(input: ReserveInput): Promise<ReserveResult> {
    const expiresInSec = input.expiresInSec ?? 300;

    return this.db.transaction(async (tx) => {
      // Fix C1: advisory lock — orgId 별 동시 reserve 직렬화
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${input.orgId}))`);

      // 1. Idempotency — return existing active reservation
      const [existing] = await tx
        .select()
        .from(paymentUsageReserves)
        .where(
          and(
            eq(paymentUsageReserves.organizationId, input.orgId),
            eq(paymentUsageReserves.refType, "ai_call"),
            eq(paymentUsageReserves.refId, input.refId),
            eq(paymentUsageReserves.status, "reserved"),
          ),
        )
        .limit(1);

      if (existing) {
        const totalAvailable = await this.computeAvailable(tx, input.orgId);
        return { reservationId: existing.id, totalAvailable };
      }

      // 2. Balance check
      const totalAvailable = await this.computeAvailable(tx, input.orgId);
      if (totalAvailable - input.estimateCents < 0) {
        throw new Error("insufficient_balance");
      }

      // 3. Insert reservation
      const [row] = await tx
        .insert(paymentUsageReserves)
        .values({
          organizationId: input.orgId,
          estimateCents: input.estimateCents,
          status: "reserved",
          refType: "ai_call",
          refId: input.refId,
          expiresAt: addSeconds(new Date(), expiresInSec),
        })
        .returning();

      if (!row) {
        throw new Error("failed to insert reservation");
      }

      return { reservationId: row.id, totalAvailable };
    });
  }

  /**
   * Claim actual usage after an AI call.
   * Deduction priority: included credit (paymentCreditLedger) first → shortfall → paid (paymentUsageLedger).
   * Single-tx atomicity: reserve update + credit ledger + usage ledger + cached_paid_balance.
   */
  async claim(input: ClaimInput, opts: { orgId: string }): Promise<{ balanceAfterCents: number }> {
    const actualCents = calculateModelCost(
      input.model,
      input.actualInputTokens,
      input.actualOutputTokens,
    );

    return this.db.transaction(async (tx) => {
      // 1. Reservation lookup + row lock
      const [reservation] = await tx
        .select()
        .from(paymentUsageReserves)
        .where(eq(paymentUsageReserves.id, input.reservationId))
        .for("update");

      if (!reservation) {
        throw new Error(`reservation ${input.reservationId} not found`);
      }

      // Fix C1: IDOR guard — org 소유 검증
      if (reservation.organizationId !== opts.orgId) {
        throw new Error("reservation_org_mismatch");
      }

      // 2. Idempotency — already claimed/cancelled → no-op
      if (reservation.status !== "reserved") {
        const [sub] = await tx
          .select({ cached: paymentSubscriptions.cachedPaidBalanceCents })
          .from(paymentSubscriptions)
          .where(eq(paymentSubscriptions.organizationId, reservation.organizationId))
          .limit(1);
        return { balanceAfterCents: sub?.cached ?? 0 };
      }

      // 3. Determine split: included vs paid
      const includedBalance = await this.getIncludedBalance(tx, reservation.organizationId);

      let includedConsumed = 0;
      let paidConsumed = 0;
      if (includedBalance >= actualCents) {
        includedConsumed = actualCents;
      } else if (includedBalance > 0) {
        includedConsumed = includedBalance;
        paidConsumed = actualCents - includedBalance;
      } else {
        paidConsumed = actualCents;
      }

      // 4. Included credit deduction (paymentCreditLedger)
      if (includedConsumed > 0) {
        await tx.insert(paymentCreditLedger).values({
          organizationId: reservation.organizationId,
          delta: -includedConsumed,
          balanceAfter: includedBalance - includedConsumed,
          reason: "spend",
          refType: "spend_event",
          refId: input.reservationId,
          spendMeta: {
            model: input.model,
            inputTokens: input.actualInputTokens,
            outputTokens: input.actualOutputTokens,
            includedConsumed,
            paidConsumed,
          },
        });
      }

      // 5. Paid usage deduction (paymentUsageLedger) + cached balance update
      let paidBalanceAfter = 0;

      if (paidConsumed > 0) {
        const [sub] = await tx
          .select()
          .from(paymentSubscriptions)
          .where(
            and(
              eq(paymentSubscriptions.organizationId, reservation.organizationId),
              inArray(paymentSubscriptions.status, ["trialing", "active", "past_due", "grace"]),
            ),
          )
          .limit(1);

        if (!sub) {
          throw new Error(`active subscription not found for org ${reservation.organizationId}`);
        }

        const paidBalanceBefore = sub.cachedPaidBalanceCents ?? 0;
        paidBalanceAfter = paidBalanceBefore - paidConsumed;

        await tx.insert(paymentUsageLedger).values({
          organizationId: reservation.organizationId,
          deltaCents: -paidConsumed,
          balanceAfterCents: paidBalanceAfter,
          reason: "ai_usage",
          refType: "usage_claim",
          refId: input.reservationId,
          periodStart: sub.currentPeriodStart,
          periodEnd: sub.currentPeriodEnd,
          metadata: {
            model: input.model,
            inputTokens: input.actualInputTokens,
            outputTokens: input.actualOutputTokens,
            includedConsumed,
            paidConsumed,
          },
        });

        await tx
          .update(paymentSubscriptions)
          .set({
            cachedPaidBalanceCents: paidBalanceAfter,
            cachedBalanceUpdatedAt: new Date(),
          })
          .where(eq(paymentSubscriptions.id, sub.id));
      } else {
        const [sub] = await tx
          .select({ cached: paymentSubscriptions.cachedPaidBalanceCents })
          .from(paymentSubscriptions)
          .where(eq(paymentSubscriptions.organizationId, reservation.organizationId))
          .limit(1);
        paidBalanceAfter = sub?.cached ?? 0;
      }

      // 6. Mark reservation as claimed
      await tx
        .update(paymentUsageReserves)
        .set({
          status: "claimed",
          claimedActualCents: actualCents,
          claimedAt: new Date(),
        })
        .where(eq(paymentUsageReserves.id, input.reservationId));

      return { balanceAfterCents: paidBalanceAfter };
    });
  }

  /**
   * Cancel a reservation. No ledger changes.
   */
  async cancel(input: { reservationId: string }, opts: { orgId: string }): Promise<void> {
    await this.db
      .update(paymentUsageReserves)
      .set({ status: "cancelled", cancelledAt: new Date() })
      .where(
        and(
          eq(paymentUsageReserves.id, input.reservationId),
          eq(paymentUsageReserves.organizationId, opts.orgId), // Fix C1: IDOR guard
          eq(paymentUsageReserves.status, "reserved"),
        ),
      );
  }

  // ──────── private helpers ────────

  // biome-ignore lint/suspicious/noExplicitAny: drizzle tx type is complex
  private async computeAvailable(tx: any, orgId: string): Promise<number> {
    const includedBalance = await this.getIncludedBalance(tx, orgId);

    const [sub] = await tx
      .select({ cached: paymentSubscriptions.cachedPaidBalanceCents })
      .from(paymentSubscriptions)
      .where(
        and(
          eq(paymentSubscriptions.organizationId, orgId),
          inArray(paymentSubscriptions.status, ["trialing", "active", "past_due", "grace"]),
        ),
      )
      .limit(1);
    const paidBalance = sub?.cached ?? 0;

    const [reservedRow] = await tx
      .select({
        activeReserved: sql<number>`COALESCE(${sum(paymentUsageReserves.estimateCents)}, 0)::int`,
      })
      .from(paymentUsageReserves)
      .where(
        and(
          eq(paymentUsageReserves.organizationId, orgId),
          eq(paymentUsageReserves.status, "reserved"),
        ),
      );
    const activeReserved: number = reservedRow?.activeReserved ?? 0;

    return includedBalance + paidBalance - activeReserved;
  }

  // biome-ignore lint/suspicious/noExplicitAny: drizzle tx type is complex
  private async getIncludedBalance(tx: any, orgId: string): Promise<number> {
    const [row] = await tx
      .select({
        s: sql<number>`COALESCE(${sum(paymentCreditLedger.delta)}, 0)::int`,
      })
      .from(paymentCreditLedger)
      .where(eq(paymentCreditLedger.organizationId, orgId));
    return Math.max(0, row?.s ?? 0);
  }
}
