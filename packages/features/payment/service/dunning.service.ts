/**
 * DunningService — subscription state machine for payment failure handling.
 *
 * State machine (spec §3.2.5 / §2 line 51 / §8.G4):
 *
 *   active|trialing  ──markPastDue──▶  past_due
 *                                        │
 *                            tick: past_due_since <= now ─▶ grace
 *                            (immediate next tick — past_due is only the
 *                             "we just learned" flag; spec §2 says
 *                             "Grace 7일 + Soft-suspend", so the user-visible
 *                             window of 7 days lives entirely inside grace.)
 *                                        │
 *                            grace_ends_at = past_due_since + 7d
 *                                        │
 *                            tick: grace_ends_at <= now ─▶ canceled
 *                                        │
 *                            data_purge_at = canceled_at + 30d (G4)
 *
 *   past_due|grace ──reactivate/releaseSoftSuspend──▶ active
 *     (clears past_due_since, grace_ends_at, data_purge_at)
 *
 * Grace timing decision (Phase 6 of payment-v1, intentionally documented):
 *   Spec §2 ("Grace 7일") and §8.G4 ("cancel 후 30일 데이터 read-only-archive")
 *   are explicit. Spec §4.4 ("past_due > 7일 → grace") and the plan §6 test
 *   stub ("past_due > 7일 → grace + grace_ends_at=+30days") differ on whether
 *   the 7 days live in past_due or in grace. We pick **past_due is brief,
 *   grace lasts 7 days** because that is what is user-visible per §2 ("7일 내
 *   정상화 시 자동 복원" = within the grace window the user can pay-and-resume),
 *   and it gives a single cron tick per state instead of two with similar UX.
 *
 *   Knock-on effect: a `markPastDue` followed immediately by `tick(now)` will
 *   move the sub through past_due → grace in the same tick (because
 *   past_due_since <= now is trivially true). That's intentional — Polar's own
 *   retry happens before they fire payment.failed, so by the time we see the
 *   webhook the user is already overdue. Marking grace immediately starts the
 *   7-day clock at the right wall-clock moment.
 *
 * Idempotency:
 *   - markPastDue: no-op if status is already past_due/grace/canceled. Only
 *     active/trialing → past_due (preserves original past_due_since).
 *   - tick: each transition guards on the current status, so re-running the
 *     same tick(now) twice produces the same end state.
 *   - reactivate: no-op if status is already active/trialing.
 *
 * Audit:
 *   releaseSoftSuspend writes to payment_audit_log so the admin action is
 *   discoverable in the Customer Ops console (spec §5.4). reactivate is the
 *   user-self-serve path and is NOT audited (Phase 8 will add it via
 *   @AuditLog on the tRPC procedure when applicable).
 */
import { and, eq, inArray, lte, sql } from "drizzle-orm";
import {
  type DrizzleDB,
  paymentAuditLog,
  paymentSubscriptions,
} from "@repo/drizzle";

import type { DunningService as DunningInterface } from "../webhooks/polar.webhook.dispatcher";

const DAY_MS = 86_400_000;
const GRACE_DAYS = 7;
const DATA_PURGE_DAYS = 30;

export interface AuditService {
  log(entry: {
    actorUserId: string;
    action: string;
    targetSubscriptionId?: string;
    targetOrgId?: string;
    payloadBefore?: unknown;
    payloadAfter?: unknown;
    reason?: string;
  }): Promise<void>;
}

export interface NotificationServiceForDunning {
  onSoftSuspend?(p: {
    id: string;
    organizationId: string;
    userEmail?: string;
  }): Promise<void>;
}

export interface DunningServiceDeps {
  notif?: NotificationServiceForDunning;
  audit?: AuditService;
}

export class DunningService implements DunningInterface {
  constructor(
    private readonly db: DrizzleDB,
    private readonly deps: DunningServiceDeps = {},
  ) {}

  // ──────────────────────────────────────────────────────────────────
  // markPastDue — payment.failed webhook entry point
  // ──────────────────────────────────────────────────────────────────

  /**
   * Flag a Polar subscription as past_due. Idempotent: a sub already in
   * past_due / grace / canceled is a no-op (preserves the original
   * past_due_since).
   */
  async markPastDue(input: {
    polarSubscriptionId: string;
    reason?: string;
  }): Promise<void> {
    const now = new Date();
    await this.db
      .update(paymentSubscriptions)
      .set({
        status: "past_due",
        pastDueSince: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(
            paymentSubscriptions.polarSubscriptionId,
            input.polarSubscriptionId,
          ),
          inArray(paymentSubscriptions.status, ["active", "trialing"]),
        ),
      );
    // No throw on miss — webhook re-deliveries against an already-past_due
    // sub are normal.
  }

  // ──────────────────────────────────────────────────────────────────
  // tick — daily cron entry point. Drives past_due → grace → canceled.
  // ──────────────────────────────────────────────────────────────────

  /**
   * Move overdue subscriptions through their next state. `now` is injected so
   * tests don't need to mock Date.now(); production cron passes new Date().
   *
   * Returns the count of transitions made for observability (spec §8.H3).
   */
  async tick(
    now: Date,
  ): Promise<{ enteredGrace: number; canceledFromGrace: number }> {
    const enteredGrace = await this.transitionPastDueToGrace(now);
    const canceledFromGrace = await this.transitionGraceToCanceled(now);
    return { enteredGrace, canceledFromGrace };
  }

  private async transitionPastDueToGrace(now: Date): Promise<number> {
    // past_due rows transition immediately on the next tick. grace_ends_at is
    // computed SQL-side from past_due_since (not now) so the user always gets
    // the full 7-day window measured from when payment actually failed.
    //
    // INV-2 (CHECK): status='grace' implies grace_ends_at NOT NULL — we must
    // set status and grace_ends_at in the SAME UPDATE statement. Using a
    // raw `sql` fragment for the column-references-itself math.
    const rows = await this.db
      .update(paymentSubscriptions)
      .set({
        status: "grace",
        graceEndsAt: sql`${paymentSubscriptions.pastDueSince} + (${GRACE_DAYS} || ' days')::interval`,
        updatedAt: now,
      })
      .where(
        and(
          eq(paymentSubscriptions.status, "past_due"),
          lte(paymentSubscriptions.pastDueSince, now),
        ),
      )
      .returning({ id: paymentSubscriptions.id });
    return rows.length;
  }

  private async transitionGraceToCanceled(now: Date): Promise<number> {
    const rows = await this.db
      .update(paymentSubscriptions)
      .set({
        status: "canceled",
        canceledAt: now,
        dataPurgeAt: new Date(now.getTime() + DATA_PURGE_DAYS * DAY_MS),
        updatedAt: now,
      })
      .where(
        and(
          eq(paymentSubscriptions.status, "grace"),
          lte(paymentSubscriptions.graceEndsAt, now),
        ),
      )
      .returning({ id: paymentSubscriptions.id });
    return rows.length;
  }

  // ──────────────────────────────────────────────────────────────────
  // reactivate — user pays during grace (or admin force-clears past_due)
  // ──────────────────────────────────────────────────────────────────

  /**
   * Move a past_due or grace subscription back to active and clear the dunning
   * timestamps. No-op if the sub is already in a non-dunning state.
   *
   * NOTE: this does NOT verify with Polar that the user actually paid — that
   * is the caller's responsibility (the tRPC procedure
   * `payment.reactivateSubscription` will be wired in Phase 8 to call Polar
   * first, then us).
   */
  async reactivate(input: { subscriptionId: string }): Promise<{ ok: boolean }> {
    const now = new Date();
    const result = await this.db
      .update(paymentSubscriptions)
      .set({
        status: "active",
        pastDueSince: null,
        graceEndsAt: null,
        dataPurgeAt: null,
        updatedAt: now,
      })
      .where(
        and(
          eq(paymentSubscriptions.id, input.subscriptionId),
          inArray(paymentSubscriptions.status, ["past_due", "grace"]),
        ),
      )
      .returning({ id: paymentSubscriptions.id });
    return { ok: result.length > 0 };
  }

  // ──────────────────────────────────────────────────────────────────
  // listPurgeTargets — read-side for the data-purge cron (Phase 6 / G4)
  // ──────────────────────────────────────────────────────────────────

  /**
   * Canceled subs whose data_purge_at <= now. The data-purge cron iterates
   * these to perform the read-only-archive (TODO Phase 12+ once the storage
   * boundary is defined) and then calls `markPurged` to clear the timestamp.
   */
  async listPurgeTargets(
    now: Date,
  ): Promise<Array<{ id: string; organizationId: string; dataPurgeAt: Date }>> {
    const rows = await this.db
      .select({
        id: paymentSubscriptions.id,
        organizationId: paymentSubscriptions.organizationId,
        dataPurgeAt: paymentSubscriptions.dataPurgeAt,
      })
      .from(paymentSubscriptions)
      .where(
        and(
          eq(paymentSubscriptions.status, "canceled"),
          lte(paymentSubscriptions.dataPurgeAt, now),
        ),
      );
    return rows
      .filter((r): r is { id: string; organizationId: string; dataPurgeAt: Date } =>
        r.dataPurgeAt instanceof Date,
      );
  }

  /**
   * Clear data_purge_at after the data-purge cron has done its archive work.
   * Idempotent — re-running on an already-purged sub is a no-op.
   */
  async markPurged(input: { subscriptionId: string }): Promise<void> {
    const now = new Date();
    await this.db
      .update(paymentSubscriptions)
      .set({ dataPurgeAt: null, updatedAt: now })
      .where(eq(paymentSubscriptions.id, input.subscriptionId));
  }

  // ──────────────────────────────────────────────────────────────────
  // releaseSoftSuspend — admin manual override (spec §5.4)
  // ──────────────────────────────────────────────────────────────────

  /**
   * Admin clears the soft-suspend (grace) on a sub even if Polar hasn't
   * confirmed payment yet — typical use is comp / dispute resolution. Writes
   * a payment_audit_log row.
   */
  async releaseSoftSuspend(input: {
    subscriptionId: string;
    actorUserId: string;
    reason?: string;
  }): Promise<{ ok: boolean }> {
    const before = await this.db
      .select()
      .from(paymentSubscriptions)
      .where(eq(paymentSubscriptions.id, input.subscriptionId))
      .limit(1);
    const beforeRow = before[0];
    if (!beforeRow) return { ok: false };

    const out = await this.reactivate({ subscriptionId: input.subscriptionId });

    if (this.deps.audit) {
      await this.deps.audit.log({
        actorUserId: input.actorUserId,
        action: "release_soft_suspend",
        targetSubscriptionId: input.subscriptionId,
        targetOrgId: beforeRow.organizationId,
        payloadBefore: {
          status: beforeRow.status,
          pastDueSince: beforeRow.pastDueSince,
          graceEndsAt: beforeRow.graceEndsAt,
        },
        payloadAfter: { status: "active" },
        reason: input.reason,
      });
    } else {
      // Fallback path so callers without an injected audit service still get
      // an append-only record (Phase 7 will provide AuditService and inject it).
      await this.db.insert(paymentAuditLog).values({
        actorUserId: input.actorUserId,
        action: "release_soft_suspend",
        targetSubscriptionId: input.subscriptionId,
        targetOrgId: beforeRow.organizationId,
        payloadBefore: {
          status: beforeRow.status,
          pastDueSince: beforeRow.pastDueSince,
          graceEndsAt: beforeRow.graceEndsAt,
        } as unknown as Record<string, unknown>,
        payloadAfter: { status: "active" } as unknown as Record<string, unknown>,
        reason: input.reason,
      });
    }
    return out;
  }
}

export const __testHelpers = { GRACE_DAYS, DATA_PURGE_DAYS, DAY_MS };
