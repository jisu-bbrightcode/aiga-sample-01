/**
 * SubscriptionService — webhook event ledger + admin runtime ops.
 *
 * Responsibilities (Phase 4 of payment-v1):
 *  - processEvent(evt)           — idempotent webhook intake. INV-4: polar_event_id UNIQUE.
 *  - findByPolarId(id)           — used by webhook dispatcher (Phase 5) to look up
 *                                  the sub when handling payment.succeeded etc.
 *  - compSubscription(...)       — admin: create an active sub without going through Polar.
 *  - cancelSubscriptionNow(...)  — admin: terminate a sub immediately (status=canceled).
 *  - extendTrialEnd(...)         — admin: stretch trial_end on an existing sub.
 *  - changePlan(...)             — runtime: switch plan_id; upgrade=immediate, downgrade=cycle_end.
 *
 * Event ledger semantics (subscription_events.result):
 *   NULL       — event was received and inserted, awaiting (or completed without
 *                explicit terminal mark by the dispatcher).
 *   'ok'       — dispatcher processed the event successfully.
 *   'deferred' — dispatcher waiting on a dependent event; cron will retry.
 *   'error'    — processing failed; cron will retry up to retry_count=5, then dead-letter.
 *
 * Idempotency pattern (INV-4):
 *   Insert event row first with onConflictDoNothing on polar_event_id. If the
 *   insert returns 0 rows the webhook was a duplicate — short-circuit. Otherwise
 *   upsert the subscription, then back-fill subscription_events.subscription_id
 *   so the FK is populated even though the column is nullable at insert time.
 */
import { and, desc, eq, inArray, sql, sum } from "drizzle-orm";
import {
  type DrizzleDB,
  paymentCreditLedger,
  paymentOrders,
  paymentPendingPlanChanges,
  paymentPlans,
  paymentSubscriptionEvents,
  paymentSubscriptions,
} from "@repo/drizzle";

import type { PolarAdapter } from "./polar.adapter";
import { AuditService, PaymentAuditAction } from "./audit.service";

type SubStatus = "trialing" | "active" | "past_due" | "canceled";

export interface SubEvent {
  polarEventId: string;
  type:
    | "subscription.created"
    | "subscription.updated"
    | "subscription.canceled"
    | "subscription.trial_end";
  payload: {
    id: string;
    organizationId: string;
    userId: string;
    /**
     * Legacy v1 plan id derived from metadata.plan_id. May be undefined on v2
     * plan-change webhooks where Polar does not refresh metadata after a plan
     * switch — in that case `polarProductId` is the source of truth and
     * `upsertSubscription` resolves the plan via paymentPlans.polarProductId.
     * Admin callers (compSubscription, etc.) always supply a real id.
     */
    planId: string | undefined;
    /**
     * Polar's product_id from the webhook payload. When present, treated as
     * primary truth for plan resolution (Polar-side product change must mirror
     * to paymentSubscriptions.planId). `payload.planId` (derived from
     * metadata.plan_id) is the fallback for cases where Polar does not refresh
     * metadata after a plan switch.
     */
    polarProductId?: string;
    status: SubStatus;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    trialEnd?: Date | null;
    cancelAtPeriodEnd?: boolean;
  };
}

type SubscriptionRow = typeof paymentSubscriptions.$inferSelect;

/**
 * Subscription row enriched with plan fields the webhook dispatcher needs to
 * grant credits and label notifications. Returned by `findByPolarId`.
 */
export type EnrichedSubscription = SubscriptionRow & {
  includedCreditsPerCycle: number;
  planSlug: string;
};

/**
 * `changePlanV2` 결과. discriminated union — caller (T9 trpc) 가
 * `result.effectiveAt === "now"` 분기 안에서 `result.prorationCents` 를
 * non-undefined 로 narrow 가능.
 *   - 즉시 변경 (upgrade/cycle-up/cycle-down): `effectiveAt='now'`, `prorationCents`
 *     채움, `newPlanId` = 새 plan.
 *   - 다운그레이드 (downgrade): `effectiveAt='cycle_end'`, `pendingChangeId` 채움,
 *     `newPlanId` = 현재 plan (cycle_end 까지 미변경).
 */
export type ChangePlanResult =
  | {
      effectiveAt: "now";
      prorationCents: number;
      newPlanId: string;
    }
  | {
      effectiveAt: "cycle_end";
      pendingChangeId: string;
      newPlanId: string;
    };

export interface PreviewResult {
  kind: "upgrade" | "downgrade" | "cycle-up" | "cycle-down" | "noop";
  /**
   * 차액 (cents). 부호 의미:
   *   양수 = 사용자에게 청구 (upgrade, cycle-up)
   *   0    = 청구 없음 (downgrade — cycle_end 까지 wait)
   *   음수 = 사용자에게 크레딧 (cycle-down — yearly→monthly 잔액 환원)
   * UI 가 부호로 분기 가능. T5(changePlanV2) 가 음수일 때 별도 refund/credit 처리 필요.
   */
  prorationCents: number;
  /** 다음 청구 일자. upgrade/downgrade 시 = currentPeriodEnd (기존 cycle 유지), cycle 변경 시 = now (즉시). */
  nextChargeAt: Date;
  /** "now" = 즉시 적용, "cycle_end" = 다음 cycle 시작 시 적용. */
  effectiveAt: "now" | "cycle_end";
}

export class SubscriptionService {
  /**
   * `polar` 는 v2 plan-change (changePlanV2) 에서만 사용. v1 메서드들 (processEvent,
   * compSubscription, cancelSubscriptionNow, extendTrialEnd, changePlan) 은 polar 호출 X.
   * v1 호출자/테스트 호환을 위해 옵셔널 — v2 메서드 호출 시 미주입이면 runtime throw.
   * Trade-off: 컴파일 통과해도 polar 안 주입 시 runtime 에서만 발견되는 위험. v1 삭제
   * (Task 8) 시 required 로 변경 검토.
   */
  constructor(
    private readonly db: DrizzleDB,
    private readonly polar?: PolarAdapter,
    private readonly audit?: AuditService,
  ) {}

  // ────────────────────────────────────────────────────────────────
  // Reads
  // ────────────────────────────────────────────────────────────────

  /**
   * Look up a subscription by its Polar id, JOINed against payment_plans so the
   * caller (Phase 5 webhook dispatcher) can grant the cycle's credits and tag
   * notifications without a second round-trip.
   */
  async findByPolarId(polarSubscriptionId: string): Promise<EnrichedSubscription | null> {
    const rows = await this.db
      .select({
        sub: paymentSubscriptions,
        includedCreditsPerCycle: paymentPlans.includedCreditsPerCycle,
        planSlug: paymentPlans.slug,
      })
      .from(paymentSubscriptions)
      .innerJoin(paymentPlans, eq(paymentPlans.id, paymentSubscriptions.planId))
      .where(eq(paymentSubscriptions.polarSubscriptionId, polarSubscriptionId))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      ...row.sub,
      includedCreditsPerCycle: row.includedCreditsPerCycle,
      planSlug: row.planSlug,
    };
  }

  // ────────────────────────────────────────────────────────────────
  // Webhook intake (Task 4.1)
  // ────────────────────────────────────────────────────────────────

  async processEvent(
    evt: SubEvent,
  ): Promise<{ processed: boolean; reason?: string; subscriptionId?: string }> {
    return this.db.transaction(async (tx) => {
      const inserted = await tx
        .insert(paymentSubscriptionEvents)
        .values({
          polarEventId: evt.polarEventId,
          eventType: evt.type,
          payload: evt.payload as unknown as Record<string, unknown>,
        })
        .onConflictDoNothing({ target: paymentSubscriptionEvents.polarEventId })
        .returning();

      if (inserted.length === 0) {
        return { processed: false, reason: "duplicate" };
      }
      const eventRow = inserted[0]!;

      const sub = await this.upsertSubscription(tx, evt);

      // Back-fill the FK + mark result='ok' now that processing completed.
      // Without this, result stays NULL and the row looks "in-flight" forever
      // — the cron retry filter (result='deferred') wouldn't pick it up but
      // operators couldn't tell at-a-glance which events succeeded vs are stuck.
      // (On exception, the transaction rolls back including this row insert,
      //  so Polar's webhook retry will see a clean slate.)
      await tx
        .update(paymentSubscriptionEvents)
        .set({
          subscriptionId: sub.id,
          result: "ok",
          processedAt: new Date(),
        })
        .where(eq(paymentSubscriptionEvents.id, eventRow.id));

      return { processed: true, subscriptionId: sub.id };
    });
  }

  private async upsertSubscription(
    tx: Parameters<Parameters<DrizzleDB["transaction"]>[0]>[0],
    evt: SubEvent,
  ): Promise<SubscriptionRow> {
    const p = evt.payload;

    // v2 plan-change mirror: polarProductId → paymentPlans.id is the primary
    // truth (Polar is authoritative for the customer's actual product). The
    // payload.planId carried from metadata.plan_id is a fallback for the case
    // where Polar didn't refresh metadata after a product change. If lookup
    // misses (unknown product), keep the fallback so the sub row doesn't
    // break — graceful degradation over hard fail.
    let resolvedPlanId = p.planId;
    if (p.polarProductId) {
      const planRows = await tx
        .select({ id: paymentPlans.id })
        .from(paymentPlans)
        .where(eq(paymentPlans.polarProductId, p.polarProductId))
        .limit(1);
      if (planRows[0]) {
        resolvedPlanId = planRows[0].id;
      }
    }

    // Belt-and-braces: planId must be resolvable. paymentSubscriptions.planId is
    // NOT NULL — without this guard a v2 plan-change webhook that misses the
    // polarProductId lookup AND lacks metadata.plan_id would surface as a
    // cryptic Drizzle constraint error instead of a precise diagnostic.
    if (!resolvedPlanId) {
      throw new Error(
        `upsertSubscription: planId unresolvable for polarSubscriptionId=${p.id} polarProductId=${p.polarProductId}`,
      );
    }

    const inserted = await tx
      .insert(paymentSubscriptions)
      .values({
        polarSubscriptionId: p.id,
        organizationId: p.organizationId,
        userId: p.userId,
        planId: resolvedPlanId,
        status: p.status,
        currentPeriodStart: p.currentPeriodStart,
        currentPeriodEnd: p.currentPeriodEnd,
        trialEnd: p.trialEnd ?? null,
        cancelAtPeriodEnd: p.cancelAtPeriodEnd ?? false,
      })
      .onConflictDoUpdate({
        target: paymentSubscriptions.polarSubscriptionId,
        set: {
          status: p.status,
          planId: resolvedPlanId,
          currentPeriodStart: p.currentPeriodStart,
          currentPeriodEnd: p.currentPeriodEnd,
          trialEnd: p.trialEnd ?? null,
          cancelAtPeriodEnd: p.cancelAtPeriodEnd ?? false,
          updatedAt: new Date(),
        },
      })
      .returning();
    return inserted[0]!;
  }

  // ────────────────────────────────────────────────────────────────
  // Admin / runtime ops (Task 4.2)
  // ────────────────────────────────────────────────────────────────

  async compSubscription(input: {
    organizationId: string;
    userId: string;
    planId: string;
    durationMonths: number;
    reason: string;
    actorUserId: string;
  }): Promise<{ subscriptionId: string }> {
    return this.db.transaction(async (tx) => {
      const existing = await tx
        .select({ id: paymentSubscriptions.id })
        .from(paymentSubscriptions)
        .where(
          and(
            eq(paymentSubscriptions.organizationId, input.organizationId),
            inArray(paymentSubscriptions.status, ["trialing", "active", "past_due", "grace"]),
          ),
        )
        .limit(1);
      if (existing.length > 0) {
        throw new Error(`organization ${input.organizationId} already has an active subscription`);
      }
      const start = new Date();
      const end = new Date(start);
      end.setMonth(end.getMonth() + input.durationMonths);
      const inserted = await tx
        .insert(paymentSubscriptions)
        .values({
          polarSubscriptionId: `comp_${Date.now()}_${input.organizationId}`,
          organizationId: input.organizationId,
          userId: input.userId,
          planId: input.planId,
          status: "active",
          currentPeriodStart: start,
          currentPeriodEnd: end,
        })
        .returning();
      return { subscriptionId: inserted[0]!.id };
    });
  }

  async cancelSubscriptionNow(input: {
    subscriptionId: string;
    reason: string;
  }): Promise<{ ok: true }> {
    const result = await this.db
      .update(paymentSubscriptions)
      .set({
        status: "canceled",
        canceledAt: new Date(),
        cancelAtPeriodEnd: false,
        updatedAt: new Date(),
      })
      .where(eq(paymentSubscriptions.id, input.subscriptionId))
      .returning();
    if (result.length === 0) {
      throw new Error(`subscription ${input.subscriptionId} not found`);
    }
    return { ok: true };
  }

  async extendTrialEnd(input: {
    subscriptionId: string;
    newTrialEnd: Date;
    reason: string;
  }): Promise<{ ok: true }> {
    const result = await this.db
      .update(paymentSubscriptions)
      .set({ trialEnd: input.newTrialEnd, updatedAt: new Date() })
      .where(eq(paymentSubscriptions.id, input.subscriptionId))
      .returning();
    if (result.length === 0) {
      throw new Error(`subscription ${input.subscriptionId} not found`);
    }
    return { ok: true };
  }

  // ────────────────────────────────────────────────────────────────
  // Plan change preview (v2 Task 4) — read-only
  // ────────────────────────────────────────────────────────────────

  /**
   * Calculate the price delta a user would see in a confirm dialog before
   * actually changing plan. NO Polar calls, NO DB writes — pure read-only.
   *
   * Kind classification:
   *   upgrade    — same cycle, target costs more       → immediate, prorated diff
   *   downgrade  — same cycle, target costs less       → defer to cycle_end, prorationCents=0
   *   cycle-up   — different cycle, target costs more  → immediate (target − unused credit of current)
   *   cycle-down — different cycle, target costs less  → immediate (target − unused credit of current; negative)
   *   noop       — same plan id                        → throws (UI shouldn't have offered this)
   *
   * `prorationCents` sign: positive = user is charged, negative = user gets credit.
   * `nextChargeAt` is the moment the next charge will land (for upgrade/downgrade
   *  this is the existing currentPeriodEnd; for cycle-up/down it is `now`).
   */
  async previewPlanChange(
    input: { subscriptionId: string; targetPlanId: string },
    opts: { now?: Date } = {},
  ): Promise<PreviewResult> {
    const now = opts.now ?? new Date();

    const subs = await this.db
      .select()
      .from(paymentSubscriptions)
      .where(eq(paymentSubscriptions.id, input.subscriptionId))
      .limit(1);
    if (subs.length === 0) {
      throw new Error(`subscription ${input.subscriptionId} not found`);
    }
    const sub = subs[0]!;

    if (sub.planId === input.targetPlanId) {
      throw new Error("already on this plan");
    }

    // Period guard — UI must not preview a free upgrade against an expired
    // sub. noop check (above) is plan_id 동일성으로만 판정하므로 period 무관 — 여기서 별도로 차단.
    // invariant 위반 (start>=end) 을 먼저 검사: expired 메시지로 가려지면 데이터 corruption 진단이 어려워짐.
    if (sub.currentPeriodEnd.getTime() <= sub.currentPeriodStart.getTime()) {
      throw new Error(
        `subscription ${input.subscriptionId} has invalid period (start ${sub.currentPeriodStart.toISOString()} >= end ${sub.currentPeriodEnd.toISOString()})`,
      );
    }
    if (sub.currentPeriodEnd.getTime() <= now.getTime()) {
      throw new Error(
        `subscription ${input.subscriptionId} has already expired (currentPeriodEnd ${sub.currentPeriodEnd.toISOString()} <= now ${now.toISOString()})`,
      );
    }

    const planRows = await this.db
      .select()
      .from(paymentPlans)
      .where(inArray(paymentPlans.id, [sub.planId, input.targetPlanId]));
    const currentPlan = planRows.find((p) => p.id === sub.planId);
    const targetPlan = planRows.find((p) => p.id === input.targetPlanId);
    if (!currentPlan) {
      throw new Error(`current plan not found: sub.planId=${sub.planId}`);
    }
    if (!targetPlan) {
      throw new Error(`target plan not found: targetPlanId=${input.targetPlanId}`);
    }

    const cycleMs = sub.currentPeriodEnd.getTime() - sub.currentPeriodStart.getTime();
    const remainMs = Math.max(0, sub.currentPeriodEnd.getTime() - now.getTime());
    // cycleMs<=0 should be impossible (period_start < period_end is invariant
    // upstream) but guard against div-by-zero in case of clock skew / bad data
    // — fallback ratio=0 means "no remaining value", caller still gets a sane
    // preview rather than NaN.
    const ratio = cycleMs > 0 ? remainMs / cycleMs : 0;

    const currentPriceCents = currentPlan.priceCents;
    const targetPriceCents = targetPlan.priceCents;
    const sameCycle = currentPlan.cycle === targetPlan.cycle;

    if (sameCycle) {
      if (targetPriceCents > currentPriceCents) {
        const prorationCents = Math.round((targetPriceCents - currentPriceCents) * ratio);
        return {
          kind: "upgrade",
          prorationCents,
          nextChargeAt: sub.currentPeriodEnd,
          effectiveAt: "now",
        };
      }
      if (targetPriceCents < currentPriceCents) {
        return {
          kind: "downgrade",
          prorationCents: 0,
          nextChargeAt: sub.currentPeriodEnd,
          effectiveAt: "cycle_end",
        };
      }
      // Lateral plan change — same cycle, same price, 다른 plan_id.
      // Spec 에 lateral 분류 정의 없음 → 안전 default = throw. UI/T5 가 명시 처리하도록.
      throw new Error(
        `lateral plan change has no price difference (current=${currentPriceCents}, target=${targetPriceCents}, cycle=${currentPlan.cycle}). Spec 에 lateral 분류 정의 후 재시도.`,
      );
    }

    // Cycle change (monthly ↔ yearly). Lifetime is out of scope for v2.
    // The user has consumed (1−ratio) of their current cycle; the remainder
    // is credited against the new plan's price.
    const currentRemainCredit = Math.round(currentPriceCents * ratio);
    if (targetPriceCents > currentPriceCents) {
      return {
        kind: "cycle-up",
        prorationCents: targetPriceCents - currentRemainCredit,
        nextChargeAt: now,
        effectiveAt: "now",
      };
    }
    if (targetPriceCents < currentPriceCents) {
      return {
        kind: "cycle-down",
        prorationCents: targetPriceCents - currentRemainCredit,
        nextChargeAt: now,
        effectiveAt: "now",
      };
    }
    // Cycle 변경인데 가격 동일 — lateral cycle 변경 (예: 가격 동일한 monthly↔yearly).
    // Spec 미정의 → 안전 default = throw.
    throw new Error(
      `cycle change has no price difference (current=${currentPriceCents}, target=${targetPriceCents}). Spec 에 lateral cycle 변경 정의 후 재시도.`,
    );
  }

  // TODO(Phase 8): wire PolarAdapter.updateSubscription for the actual Polar-side
  // change. For now the v1 implementation is DB-only:
  //  - upgrade  → flip plan_id immediately, return effectiveAt='now'.
  //  - downgrade → leave plan_id alone, return 'cycle_end'. The reconcile cron
  //    (Phase 6) will apply the deferred change at period end.
  async changePlan(input: {
    subscriptionId: string;
    targetPlanId: string;
    billingCycle: "monthly" | "yearly";
  }): Promise<{ effectiveAt: "now" | "cycle_end" }> {
    return this.db.transaction(async (tx) => {
      const subs = await tx
        .select()
        .from(paymentSubscriptions)
        .where(eq(paymentSubscriptions.id, input.subscriptionId))
        .limit(1);
      if (subs.length === 0) {
        throw new Error(`subscription ${input.subscriptionId} not found`);
      }
      const sub = subs[0]!;

      const targetPlanRows = await tx
        .select()
        .from(paymentPlans)
        .where(eq(paymentPlans.id, input.targetPlanId))
        .limit(1);
      if (targetPlanRows.length === 0) {
        throw new Error(`target plan ${input.targetPlanId} not found`);
      }
      const targetPlan = targetPlanRows[0]!;

      const currentPlanRows = await tx
        .select()
        .from(paymentPlans)
        .where(eq(paymentPlans.id, sub.planId))
        .limit(1);
      const currentPriceCents = currentPlanRows[0]?.priceCents ?? 0;

      const isUpgrade = (targetPlan.priceCents ?? 0) > currentPriceCents;
      if (isUpgrade) {
        await tx
          .update(paymentSubscriptions)
          .set({ planId: input.targetPlanId, updatedAt: new Date() })
          .where(eq(paymentSubscriptions.id, input.subscriptionId));
        return { effectiveAt: "now" as const };
      }
      // Downgrade: defer to period end (Phase 6 reconcile cron).
      // TODO(Phase 6): persist a deferred plan-change intent so the cron picks it up.
      return { effectiveAt: "cycle_end" as const };
    });
  }

  // ────────────────────────────────────────────────────────────────
  // Plan change v2 (Task 5) — preview kind 분기 + Polar mirror
  // ────────────────────────────────────────────────────────────────

  /**
   * v2 plan change. `previewPlanChange` 가 분류한 kind 별로 갈라진다:
   *
   *  - upgrade / cycle-up      → polar.updateSubscription({ proration_behavior: "invoice" })
   *                              + DB plan_id mirror, effectiveAt="now"
   *  - cycle-down              → polar.updateSubscription({ proration_behavior: "prorate" })
   *                              + DB plan_id mirror, effectiveAt="now"
   *  - downgrade               → polar 호출 없음.
   *                              paymentPendingPlanChanges insert (status="pending",
   *                              applyAt=currentPeriodEnd). reconcile cron 이 cycle_end
   *                              에 적용. effectiveAt="cycle_end".
   *
   *  noop / lateral / expired / invalid period 는 `previewPlanChange` 가 throw 하므로
   *  여기서는 따로 처리하지 않고 그대로 propagate (Polar 호출 전).
   *
   *  연속 downgrade 시 sub 당 동시 1 건 INV (paymentPendingPlanChanges 의 partial unique
   *  index `..._active_idx` WHERE status='pending') 충돌을 피하려고, 트랜잭션 안에서
   *  먼저 기존 pending row 를 'canceled' 마크 후 신규 insert.
   *
   *  TX 경계 설계 (review fix): Polar 호출은 즉시 변경 분기에서 **트랜잭션 밖**에 둔다.
   *    1) Polar 가 실패 → DB 변경 0 (Polar 호출 전).
   *    2) Polar 성공 + DB throw → Polar 변경이 stays (orphan window) — 다음 webhook 이
   *       plan_id mirror 를 복원 (멱등). caller 에 reconcile 메시지 throw.
   *    3) tx hold 시간이 짧아짐 (network IO 가 tx 밖).
   *  TOCTOU 방어: tx 안에서 sub 를 SELECT FOR UPDATE 로 다시 읽고 `planId === target` 재
   *  검증. 다른 process 가 이미 target 으로 변경했다면 idempotent no-op (Polar 호출도 skip
   *  하고 싶지만 현재 구조로는 1 회 중복 호출 가능 — Polar 멱등성에 의존).
   *
   *  comp_* polarSubscriptionId (admin compSubscription) 은 changePlanV2 미지원. UI 가
   *  올바르게 차단해야 하지만, 여기서도 Polar 404 보다 친화적 메시지로 빠르게 throw.
   */
  async changePlanV2(
    input: {
      subscriptionId: string;
      // TODO(Task 14): actorUserId 는 audit log 용 — 현재 미사용.
      actorUserId: string;
      targetPlanId: string;
    },
    opts: { now?: Date } = {},
  ): Promise<ChangePlanResult> {
    if (!this.polar) {
      throw new Error(
        "[SubscriptionService] changePlanV2 requires PolarAdapter — " +
          "construct with `new SubscriptionService(db, polar)`",
      );
    }
    const polar = this.polar;
    const now = opts.now ?? new Date();

    // previewPlanChange 가 noop/lateral/expired/invalid period 를 throw — 그대로 propagate.
    const preview = await this.previewPlanChange(
      { subscriptionId: input.subscriptionId, targetPlanId: input.targetPlanId },
      { now },
    );

    // Pre-flight (tx 밖): comp_* 차단 + target plan polar product 검증. preview 이후
    // 에 위치 — preview 가 noop/expired 등을 먼저 처리해 propagate test 가 polar 호출 0
    // 을 확인할 수 있다.
    const sub0Rows = await this.db
      .select()
      .from(paymentSubscriptions)
      .where(eq(paymentSubscriptions.id, input.subscriptionId))
      .limit(1);
    const sub0 = sub0Rows[0];
    if (!sub0) {
      throw new Error(`subscription ${input.subscriptionId} not found`);
    }
    if (!sub0.polarSubscriptionId || sub0.polarSubscriptionId.startsWith("comp_")) {
      throw new Error(
        `changePlanV2 not supported for non-Polar subscription ${input.subscriptionId} ` +
          `(polarSubscriptionId=${sub0.polarSubscriptionId})`,
      );
    }
    const targetPlan0Rows = await this.db
      .select()
      .from(paymentPlans)
      .where(eq(paymentPlans.id, input.targetPlanId))
      .limit(1);
    const targetPlan0 = targetPlan0Rows[0];
    if (!targetPlan0?.polarProductId) {
      throw new Error(`target plan ${input.targetPlanId} missing polar product`);
    }

    // ── Downgrade: polar 호출 없음, 단일 tx (FOR UPDATE) ──
    if (preview.kind === "downgrade") {
      return this.db.transaction(async (tx) => {
        const subs = await tx
          .select()
          .from(paymentSubscriptions)
          .where(eq(paymentSubscriptions.id, input.subscriptionId))
          .for("update")
          .limit(1);
        if (subs.length === 0) {
          throw new Error(`subscription ${input.subscriptionId} not found`);
        }
        const sub = subs[0]!;
        if (sub.planId === input.targetPlanId) {
          // TOCTOU: 다른 process 가 이미 target 으로 변경. downgrade 는 의미 없음.
          throw new Error("already on this plan (tx)");
        }

        // 기존 pending 'canceled' (sub 당 동시 1건 INV — partial unique index).
        await tx
          .update(paymentPendingPlanChanges)
          .set({ status: "canceled", canceledAt: now })
          .where(
            and(
              eq(paymentPendingPlanChanges.subscriptionId, sub.id),
              eq(paymentPendingPlanChanges.status, "pending"),
            ),
          );

        const inserted = await tx
          .insert(paymentPendingPlanChanges)
          .values({
            subscriptionId: sub.id,
            targetPlanId: input.targetPlanId,
            applyAt: sub.currentPeriodEnd,
            reason: "user_initiated",
          })
          .returning();
        const pending = inserted[0]!;

        await this.audit?.log({
          actorUserId: input.actorUserId,
          action: PaymentAuditAction.schedule_downgrade,
          targetSubscriptionId: sub.id,
          payloadAfter: {
            fromPlanId: sub.planId,
            toPlanId: input.targetPlanId,
            applyAt: sub.currentPeriodEnd,
          },
        });
        return {
          effectiveAt: "cycle_end",
          pendingChangeId: pending.id,
          newPlanId: sub.planId,
        };
      });
    }

    // ── 즉시 변경 (upgrade / cycle-up / cycle-down): Polar 먼저, 성공 후 DB mirror tx ──
    const prorationBehavior = preview.kind === "cycle-down" ? "prorate" : "invoice";

    // 1) Polar 호출 (tx 밖). throw → DB 변경 0.
    await polar.updateSubscription(sub0.polarSubscriptionId!, {
      product_id: targetPlan0.polarProductId,
      proration_behavior: prorationBehavior,
    });

    // 2) Polar 성공 → DB plan_id mirror (별도 tx, FOR UPDATE 로 TOCTOU 방어).
    try {
      return await this.db.transaction(async (tx) => {
        const subs = await tx
          .select()
          .from(paymentSubscriptions)
          .where(eq(paymentSubscriptions.id, input.subscriptionId))
          .for("update")
          .limit(1);
        if (subs.length === 0) {
          throw new Error(`subscription ${input.subscriptionId} not found`);
        }
        const sub = subs[0]!;
        // TOCTOU idempotent: 다른 process (예: webhook) 가 이미 target 으로 mirror 했다면 no-op.
        if (sub.planId === input.targetPlanId) {
          return {
            effectiveAt: "now",
            prorationCents: preview.prorationCents,
            newPlanId: input.targetPlanId,
          };
        }
        await tx
          .update(paymentSubscriptions)
          .set({ planId: input.targetPlanId, updatedAt: now })
          .where(eq(paymentSubscriptions.id, sub.id));

        // ── T8: credit 변경 로직 (upgrade / cycle-up / cycle-down) ──
        const creditChanges: { grant?: number; revoke?: number } = {};
        {
          const [oldPlan] = await tx
            .select()
            .from(paymentPlans)
            .where(eq(paymentPlans.id, sub.planId))
            .limit(1);
          const [newPlan] = await tx
            .select()
            .from(paymentPlans)
            .where(eq(paymentPlans.id, input.targetPlanId))
            .limit(1);

          if (preview.kind === "upgrade") {
            const diff =
              (newPlan?.includedCreditsPerCycle ?? 0) - (oldPlan?.includedCreditsPerCycle ?? 0);
            if (diff > 0) {
              const balanceBefore = await this.getCreditBalance(tx, sub.organizationId);
              await tx.insert(paymentCreditLedger).values({
                organizationId: sub.organizationId,
                delta: diff,
                balanceAfter: balanceBefore + diff,
                reason: "plan_change_grant",
                refType: "subscription_event",
                refId: `change_${sub.id}_${now.getTime()}`,
              });
              creditChanges.grant = diff;
            }
          } else if (preview.kind === "cycle-up" || preview.kind === "cycle-down") {
            const balanceBefore = await this.getCreditBalance(tx, sub.organizationId);
            const ts = now.getTime();
            if (balanceBefore > 0) {
              await tx.insert(paymentCreditLedger).values({
                organizationId: sub.organizationId,
                delta: -balanceBefore,
                balanceAfter: 0,
                reason: "plan_change_revoke",
                refType: "subscription_event",
                refId: `change_revoke_${sub.id}_${ts}`,
              });
              creditChanges.revoke = balanceBefore;
            }
            const newGrant = newPlan?.includedCreditsPerCycle ?? 0;
            if (newGrant > 0) {
              await tx.insert(paymentCreditLedger).values({
                organizationId: sub.organizationId,
                delta: newGrant,
                balanceAfter: newGrant,
                reason: "plan_change_grant",
                refType: "subscription_event",
                refId: `change_grant_${sub.id}_${ts}`,
              });
              creditChanges.grant = newGrant;
            }
          }
          // downgrade: credit 즉시 grant 없음 (cycle_end cron 영역)
        }

        await this.audit?.log({
          actorUserId: input.actorUserId,
          action: PaymentAuditAction.change_plan_v2,
          targetSubscriptionId: sub.id,
          payloadAfter: {
            kind: preview.kind,
            fromPlanId: sub.planId,
            toPlanId: input.targetPlanId,
            prorationCents: preview.prorationCents,
            ...(Object.keys(creditChanges).length > 0 && { creditChanges }),
          },
        });
        return {
          effectiveAt: "now",
          prorationCents: preview.prorationCents,
          newPlanId: input.targetPlanId,
        };
      });
    } catch (dbErr) {
      // Orphan window: Polar 변경 성공 + DB mirror 실패. 다음 webhook 이 plan_id 를
      // 복원 (upsertSubscription 의 polarProductId lookup 으로 멱등). 그래도 caller 에
      // 명시적으로 reconcile 메시지 노출.
      // TODO(Task 14): operator alert (polarSubId, attemptedPlanId, dbErr).
      const msg = dbErr instanceof Error ? dbErr.message : String(dbErr);
      throw new Error(
        `changePlanV2: Polar updated to product=${targetPlan0.polarProductId} but DB mirror ` +
          `failed (${msg}). Webhook will sync; manual reconcile may be needed.`,
      );
    }
  }

  /**
   * T8: 현재 credit 잔액 = SUM(delta). tx 안에서 호출 (FOR UPDATE 보호 하).
   */
  private async getCreditBalance(
    tx: Parameters<Parameters<DrizzleDB["transaction"]>[0]>[0],
    orgId: string,
  ): Promise<number> {
    const [row] = await tx
      .select({
        balance: sql<number>`COALESCE(${sum(paymentCreditLedger.delta)}, 0)::int`,
      })
      .from(paymentCreditLedger)
      .where(eq(paymentCreditLedger.organizationId, orgId));
    return row?.balance ?? 0;
  }

  // ────────────────────────────────────────────────────────────────
  // Schedule cancel at period end (Task 6) — Polar PATCH + DB mirror
  // ────────────────────────────────────────────────────────────────

  /**
   * 사용자가 cycle_end 에 자동 취소되도록 예약. Polar 에 `cancel_at_period_end=true`
   * PATCH + DB mirror. cycle_end 까지 sub 는 active 유지.
   *
   * 14일 환불 윈도우: `now <= sub.currentPeriodStart + 14d` 이면 `refundEligible=true`.
   * boundary inclusive (`<=`) — 14일째 0시 정각까지 eligible.
   *
   * TX 경계 (T5 review 학습 적용):
   *   1) Pre-flight (tx 밖) — sub 조회 + comp_* 가드. comp_* 는 admin compSubscription
   *      으로 만든 비-Polar sub — Polar 404 보다 친화적 메시지로 빠르게 throw.
   *   2) Polar 호출 (tx 밖) — 실패 시 DB 변경 0.
   *   3) DB mirror (별도 tx, FOR UPDATE) — TOCTOU 방어. tx hold 시간 짧음.
   *   4) Orphan window (Polar 성공 + DB throw) — 다음 webhook subscription.canceled 가
   *      cancelAtPeriodEnd 를 mirror 복원 (멱등). caller 에 reconcile 메시지 throw.
   *
   * comp_* 가드: admin compSubscription 의 sub 는 v2 cancel 미지원 (Polar 가 모름).
   * UI 가 차단해야 하지만 service 레벨에서도 fail-fast.
   */
  async scheduleCancelAtPeriodEnd(
    input: { subscriptionId: string; reason: string; actorUserId: string },
    opts: { now?: Date } = {},
  ): Promise<{ effectiveAt: "cycle_end"; cancelAt: Date; refundEligible: boolean }> {
    const now = opts.now ?? new Date();
    if (!this.polar) {
      throw new Error(
        "[SubscriptionService] scheduleCancelAtPeriodEnd requires PolarAdapter — " +
          "construct with `new SubscriptionService(db, polar)`",
      );
    }
    const polar = this.polar;

    // Pre-flight (tx 밖): sub 조회 + comp_* 가드.
    const sub0Rows = await this.db
      .select()
      .from(paymentSubscriptions)
      .where(eq(paymentSubscriptions.id, input.subscriptionId))
      .limit(1);
    const sub0 = sub0Rows[0];
    if (!sub0) {
      throw new Error(`subscription ${input.subscriptionId} not found`);
    }
    if (!sub0.polarSubscriptionId || sub0.polarSubscriptionId.startsWith("comp_")) {
      throw new Error(
        `scheduleCancelAtPeriodEnd not supported for non-Polar subscription ${input.subscriptionId} ` +
          `(polarSubscriptionId=${sub0.polarSubscriptionId})`,
      );
    }

    // 1) Polar 호출 (tx 밖). throw → DB 변경 0.
    await polar.updateSubscription(sub0.polarSubscriptionId!, {
      cancel_at_period_end: true,
    });

    // 2) Polar 성공 → DB mirror (별도 tx, FOR UPDATE 로 TOCTOU 방어 + idempotent).
    try {
      return await this.db.transaction(async (tx) => {
        const subs = await tx
          .select()
          .from(paymentSubscriptions)
          .where(eq(paymentSubscriptions.id, input.subscriptionId))
          .for("update")
          .limit(1);
        if (subs.length === 0) {
          throw new Error(`subscription ${input.subscriptionId} not found`);
        }
        const sub = subs[0]!;

        await tx
          .update(paymentSubscriptions)
          .set({
            cancelAtPeriodEnd: true,
            canceledAt: now,
            updatedAt: now,
          })
          .where(eq(paymentSubscriptions.id, sub.id));

        const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
        const refundEligible = now.getTime() <= sub.currentPeriodStart.getTime() + FOURTEEN_DAYS_MS;

        await this.audit?.log({
          actorUserId: input.actorUserId,
          action: PaymentAuditAction.cancel_at_period_end,
          targetSubscriptionId: sub.id,
          reason: input.reason,
          payloadAfter: { refundEligible },
        });
        return {
          effectiveAt: "cycle_end" as const,
          cancelAt: sub.currentPeriodEnd,
          refundEligible,
        };
      });
    } catch (dbErr) {
      // Orphan window: Polar 변경 성공 + DB mirror 실패. 다음 webhook
      // subscription.canceled 가 cancelAtPeriodEnd 를 mirror 복원 (멱등).
      // TODO(Task 14): operator alert (polarSubId, dbErr).
      const msg = dbErr instanceof Error ? dbErr.message : String(dbErr);
      throw new Error(
        `scheduleCancelAtPeriodEnd: Polar set cancel_at_period_end=true for ${sub0.polarSubscriptionId} ` +
          `but DB mirror failed (${msg}). Webhook will sync; manual reconcile may be needed.`,
      );
    }
  }

  // ────────────────────────────────────────────────────────────────
  // Cancel immediately with refund (Task 7) — 14일 윈도우 + revoke + refund
  // ────────────────────────────────────────────────────────────────

  /**
   * 14일 환불 윈도우 안에서 즉시 취소 + 환불. Polar revoke + refundOrder + DB sub
   * status='canceled', currentPeriodEnd=now (즉시 종료).
   *
   * TX 경계 (T6 와 다름): plan brief 의 핵심 결정 = "revoke 성공 + refund 실패 →
   * tx rollback (DB sub active 유지)". **둘 다 tx 안**에 둔다. revoke 후 refund
   * throw 시 tx rollback → DB 변경 0. Polar 측엔 revoke 가 stays (orphan window)
   * — 다음 webhook subscription.canceled 가 동기화.
   *
   * **원자성 보장 X** (외부 API 와 DB 간 분산 트랜잭션 불가). 정책: 사용자에게
   * "환불 처리 중 오류 — 잠시 후 다시 시도" 메시지 + webhook 동기화 대기.
   *
   *   1) Pre-flight (tx 밖) — sub 조회 + comp_* 가드 (T6 와 일치).
   *   2) tx 안 — FOR UPDATE + 14일 검증 + 최근 paid order 픽업 + revoke + refund
   *      + DB mirror. revoke or refund 실패 시 tx rollback.
   *
   * 14일 boundary `<=` (inclusive) — T6 의 refundEligible 과 일치.
   *
   * Latest paid order 정렬: `paymentOrders` 에 `paidAt` 컬럼 없음 — `createdAt`
   * 으로 정렬. webhook 의 order.paid 가 row 를 insert 하므로 createdAt ≈ paidAt.
   * 정확한 paidAt mirror 가 필요하면 후속 task 에서 컬럼 추가 검토.
   *
   * comp_* 가드: admin compSubscription 의 sub 는 Polar 측에 존재하지 않음.
   */
  async cancelImmediatelyWithRefund(
    input: { subscriptionId: string; reason: string; actorUserId: string },
    opts: { now?: Date } = {},
  ): Promise<{ refundedCents: number; orderId: string }> {
    const now = opts.now ?? new Date();
    if (!this.polar) {
      throw new Error(
        "[SubscriptionService] cancelImmediatelyWithRefund requires PolarAdapter — " +
          "construct with `new SubscriptionService(db, polar)`",
      );
    }
    const polar = this.polar;

    // Pre-flight (tx 밖): sub 조회 + comp_* 가드.
    const sub0Rows = await this.db
      .select()
      .from(paymentSubscriptions)
      .where(eq(paymentSubscriptions.id, input.subscriptionId))
      .limit(1);
    const sub0 = sub0Rows[0];
    if (!sub0) {
      throw new Error(`subscription ${input.subscriptionId} not found`);
    }
    if (!sub0.polarSubscriptionId || sub0.polarSubscriptionId.startsWith("comp_")) {
      throw new Error(
        `cancelImmediatelyWithRefund not supported for non-Polar subscription ${input.subscriptionId} ` +
          `(polarSubscriptionId=${sub0.polarSubscriptionId})`,
      );
    }

    return this.db.transaction(async (tx) => {
      const subs = await tx
        .select()
        .from(paymentSubscriptions)
        .where(eq(paymentSubscriptions.id, input.subscriptionId))
        .for("update")
        .limit(1);
      if (subs.length === 0) {
        throw new Error(`subscription ${input.subscriptionId} not found`);
      }
      const sub = subs[0]!;

      const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
      if (now.getTime() > sub.currentPeriodStart.getTime() + FOURTEEN_DAYS_MS) {
        throw new Error("refund_window_closed");
      }

      // 가장 최근 paid order 픽업 (createdAt 정렬 — paidAt 컬럼 부재).
      const orders = await tx
        .select()
        .from(paymentOrders)
        .where(and(eq(paymentOrders.subscriptionId, sub.id), eq(paymentOrders.status, "paid")))
        .orderBy(desc(paymentOrders.createdAt))
        .limit(1);
      const order = orders[0];
      if (!order) {
        throw new Error("no paid order to refund");
      }

      // Polar 호출 (tx 안). revoke or refund 실패 시 tx rollback → DB 변경 0.
      // Orphan: revoke 성공 + refund throw 시 Polar 측 sub 은 revoked 상태로 남음.
      // 다음 webhook subscription.canceled 가 DB sub.status='canceled' 동기화.
      await polar.revokeSubscription(sub.polarSubscriptionId!);
      await polar.refundOrder(order.polarOrderId, undefined, input.reason);

      await tx
        .update(paymentSubscriptions)
        .set({
          status: "canceled",
          canceledAt: now,
          currentPeriodEnd: now,
          updatedAt: now,
        })
        .where(eq(paymentSubscriptions.id, sub.id));

      await this.audit?.log({
        actorUserId: input.actorUserId,
        action: PaymentAuditAction.cancel_with_refund,
        targetSubscriptionId: sub.id,
        reason: input.reason,
        payloadAfter: { refundedCents: order.amountCents, orderId: order.id },
      });
      return { refundedCents: order.amountCents, orderId: order.id };
    });
  }

  // ────────────────────────────────────────────────────────────────
  // Uncancel subscription (Task 7) — cancelAtPeriodEnd 토글 해제
  // ────────────────────────────────────────────────────────────────

  /**
   * `scheduleCancelAtPeriodEnd` 의 역. cancelAtPeriodEnd=true 인 sub 의 취소 예약을
   * 해제 — Polar PATCH `cancel_at_period_end=false` + DB mirror.
   *
   * Idempotent: sub.cancelAtPeriodEnd === false 이면 Polar 호출 0, 즉시 return ok.
   * comp_* 미지원 (T6 와 동일).
   *
   * TX 경계 (T6 패턴 — Polar tx 밖):
   *   1) Pre-flight — sub 조회 + comp_* 가드 + idempotent 분기.
   *   2) Polar 호출 (tx 밖). throw → DB 변경 0.
   *   3) DB mirror (별도 tx, FOR UPDATE).
   *   4) Orphan window — Polar 성공 + DB throw 시 webhook subscription.updated 가
   *      cancelAtPeriodEnd 를 mirror 복원 (멱등).
   */
  async uncancelSubscription(input: {
    subscriptionId: string;
    actorUserId: string;
  }): Promise<{ ok: true }> {
    if (!this.polar) {
      throw new Error(
        "[SubscriptionService] uncancelSubscription requires PolarAdapter — " +
          "construct with `new SubscriptionService(db, polar)`",
      );
    }
    const polar = this.polar;

    // Pre-flight (tx 밖): sub 조회 + comp_* 가드 + idempotent 빠른 분기.
    const sub0Rows = await this.db
      .select()
      .from(paymentSubscriptions)
      .where(eq(paymentSubscriptions.id, input.subscriptionId))
      .limit(1);
    const sub0 = sub0Rows[0];
    if (!sub0) {
      throw new Error(`subscription ${input.subscriptionId} not found`);
    }
    if (!sub0.polarSubscriptionId || sub0.polarSubscriptionId.startsWith("comp_")) {
      throw new Error(
        `uncancelSubscription not supported for non-Polar subscription ${input.subscriptionId} ` +
          `(polarSubscriptionId=${sub0.polarSubscriptionId})`,
      );
    }
    if (!sub0.cancelAtPeriodEnd) {
      // 이미 active — idempotent (Polar 호출 없음).
      return { ok: true as const };
    }

    // Polar 호출 (tx 밖). throw → DB 변경 0.
    await polar.updateSubscription(sub0.polarSubscriptionId!, {
      cancel_at_period_end: false,
    });

    // DB mirror (별도 tx, FOR UPDATE 로 TOCTOU 방어).
    try {
      return await this.db.transaction(async (tx) => {
        const subs = await tx
          .select()
          .from(paymentSubscriptions)
          .where(eq(paymentSubscriptions.id, input.subscriptionId))
          .for("update")
          .limit(1);
        if (subs.length === 0) {
          throw new Error(`subscription ${input.subscriptionId} not found`);
        }
        const sub = subs[0]!;

        await tx
          .update(paymentSubscriptions)
          .set({
            cancelAtPeriodEnd: false,
            canceledAt: null,
            updatedAt: new Date(),
          })
          .where(eq(paymentSubscriptions.id, sub.id));

        await this.audit?.log({
          actorUserId: input.actorUserId,
          action: PaymentAuditAction.uncancel,
          targetSubscriptionId: sub.id,
          payloadAfter: {},
        });
        return { ok: true as const };
      });
    } catch (dbErr) {
      // Orphan: Polar 성공 + DB mirror 실패. webhook subscription.updated 가 동기화.
      // TODO(Task 14): operator alert (polarSubId, dbErr).
      const msg = dbErr instanceof Error ? dbErr.message : String(dbErr);
      throw new Error(
        `uncancelSubscription: Polar set cancel_at_period_end=false for ${sub0.polarSubscriptionId} ` +
          `but DB mirror failed (${msg}). Webhook will sync; manual reconcile may be needed.`,
      );
    }
  }
}
