/**
 * PendingPlanChangeCron — 매시간 cycle_end 도달 pending downgrade 를 실제로 적용.
 *
 * Spec §8 T8. 매시간 `applyAt <= now` 인 status='pending' row 를 읽어
 * polar.updateSubscription(next_period) → status='applied' 로 갱신.
 *
 * 핵심 설계:
 *  - per-row tx + SELECT FOR UPDATE SKIP LOCKED — multi-instance race 차단 (C2).
 *  - C1: polar 성공 후 같은 tx 에서 paymentSubscriptions.planId mirror (webhook 지연/유실 방어).
 *  - C3: comp_* polarSubscriptionId 가드 — terminal status='canceled' (영원 retry 방지).
 *  - BATCH_LIMIT=100 — 대량 row DOS 방지.
 *  - Polar throw 시 status='pending' 유지 → 다음 tick 에서 재시도.
 */
import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { and, eq, lte } from "drizzle-orm";
import { type DrizzleDB, paymentPendingPlanChanges, paymentPlans, paymentSubscriptions } from "@repo/drizzle";
import { PolarAdapter } from "../service/polar.adapter";
import { AuditService, PaymentAuditAction } from "../service/audit.service";

@Injectable()
export class PendingPlanChangeCron {
  private readonly logger = new Logger(PendingPlanChangeCron.name);
  private readonly BATCH_LIMIT: number;

  constructor(
    private readonly db: DrizzleDB,
    private readonly polar: PolarAdapter,
    batchLimit = 100,
    private readonly audit?: AuditService,
  ) {
    this.BATCH_LIMIT = batchLimit;
  }

  @Cron(CronExpression.EVERY_HOUR)
  async tick(opts: { now?: Date } = {}): Promise<void> {
    const now = opts.now ?? new Date();
    const startMs = Date.now();

    // Phase 1: due row id 목록만 조회 (lock 없음 — batch 전체 보기 위함)
    const due = await this.db
      .select({ id: paymentPendingPlanChanges.id })
      .from(paymentPendingPlanChanges)
      .where(
        and(
          eq(paymentPendingPlanChanges.status, "pending"),
          lte(paymentPendingPlanChanges.applyAt, now),
        ),
      )
      .limit(this.BATCH_LIMIT);

    let applied = 0;
    let failed = 0;
    let skipped = 0;
    for (const dueRow of due) {
      try {
        await this.db.transaction(async (tx) => {
          // C2: per-row claim — FOR UPDATE SKIP LOCKED
          const [row] = await tx
            .select()
            .from(paymentPendingPlanChanges)
            .where(
              and(
                eq(paymentPendingPlanChanges.id, dueRow.id),
                eq(paymentPendingPlanChanges.status, "pending"),
              ),
            )
            .for("update", { skipLocked: true });
          if (!row) {
            // 다른 cron 인스턴스가 이미 claim 했거나 처리 완료
            skipped += 1;
            return;
          }

          const [sub] = await tx
            .select()
            .from(paymentSubscriptions)
            .where(eq(paymentSubscriptions.id, row.subscriptionId));
          const [plan] = await tx
            .select()
            .from(paymentPlans)
            .where(eq(paymentPlans.id, row.targetPlanId));

          if (!sub || !plan?.polarProductId) {
            this.logger.warn(`pending plan change: missing sub or plan id=${row.id}`);
            await tx
              .update(paymentPendingPlanChanges)
              .set({ status: "canceled", canceledAt: now, reason: "missing_sub_or_plan" })
              .where(eq(paymentPendingPlanChanges.id, row.id));
            failed += 1;
            return;
          }

          // C3: comp_* 가드 — terminal (수동 SQL/백필 방어, 영원 retry 차단)
          if (!sub.polarSubscriptionId || sub.polarSubscriptionId.startsWith("comp_")) {
            this.logger.warn(
              `pending row for non-Polar subscription id=${row.id} polarSubId=${sub.polarSubscriptionId}`,
            );
            await tx
              .update(paymentPendingPlanChanges)
              .set({ status: "canceled", canceledAt: now, reason: "cron_skipped_comp_subscription" })
              .where(eq(paymentPendingPlanChanges.id, row.id));
            failed += 1;
            return;
          }

          // Polar PATCH (tx 안 — SKIP LOCKED + cron background context 라 IO 지연 acceptable)
          await this.polar.updateSubscription(sub.polarSubscriptionId!, {
            product_id: plan.polarProductId,
            proration_behavior: "next_period",
          });

          // C1: paymentSubscriptions.planId mirror — webhook 지연/유실 시 DB 영구 old plan 방지
          await tx
            .update(paymentSubscriptions)
            .set({ planId: row.targetPlanId, updatedAt: now })
            .where(eq(paymentSubscriptions.id, sub.id));

          // pending row → applied
          await tx
            .update(paymentPendingPlanChanges)
            .set({ status: "applied", appliedAt: now })
            .where(eq(paymentPendingPlanChanges.id, row.id));

          await this.audit?.log({
            // cron 시스템 액션 — actor 는 sub 소유 userId 로 기록 (FK 호환).
            actorUserId: sub.userId,
            action: PaymentAuditAction.apply_pending_change,
            targetSubscriptionId: sub.id,
            payloadAfter: {
              pendingId: row.id,
              fromPlanId: sub.planId,
              toPlanId: row.targetPlanId,
            },
          });
          applied += 1;
        });
      } catch (e) {
        // status='pending' 유지 → 다음 tick 재시도 (Polar transient failure 등)
        this.logger.error(
          `pending plan change failed id=${dueRow.id} error=${e instanceof Error ? e.message : String(e)}`,
        );
        failed += 1;
      }
    }

    this.logger.log(
      `pending plan change tick: applied=${applied} failed=${failed} skipped=${skipped} elapsedMs=${Date.now() - startMs}`,
    );
  }
}
