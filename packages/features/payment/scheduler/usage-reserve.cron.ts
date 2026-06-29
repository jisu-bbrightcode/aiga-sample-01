/**
 * UsageReserveCron — 매 10분 reserve expiry + recharge timeout sweep.
 *
 * Spec §T3 (credit + extra usage plan):
 *  - reserved 상태 expiresAt < now → status='expired' (balance 자동 반환)
 *  - pending 상태 attemptedAt < now - 5분 → status='timeout' (다음 trigger 허용)
 *
 * 설계:
 *  - batch UPDATE (per-row tx 불필요 — 두 조건 모두 단순 조건 필터, conflict 없음)
 *  - log 형식 sibling(PendingPlanChangeCron) 일치
 */
import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { and, eq, lt } from "drizzle-orm";
import {
  type DrizzleDB,
  paymentAuditLog,
  paymentRechargeHistory,
  paymentSubscriptions,
  paymentUsageReserves,
} from "@repo/drizzle";

@Injectable()
export class UsageReserveCron {
  private readonly logger = new Logger(UsageReserveCron.name);
  private readonly RECHARGE_TIMEOUT_MIN = 5;

  constructor(private readonly db: DrizzleDB) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async tick(opts: { now?: Date } = {}): Promise<void> {
    const now = opts.now ?? new Date();
    const startMs = Date.now();

    // 1. reserved → expired: expiresAt 만료 row sweep
    const expiredResult = await this.db
      .update(paymentUsageReserves)
      .set({ status: "expired" })
      .where(
        and(
          eq(paymentUsageReserves.status, "reserved"),
          lt(paymentUsageReserves.expiresAt, now),
        ),
      )
      .returning({ id: paymentUsageReserves.id });

    // 2. pending → timeout: attemptedAt 5분 초과 stuck recharge sweep
    const timeoutThreshold = new Date(now.getTime() - this.RECHARGE_TIMEOUT_MIN * 60_000);
    const stuckResult = await this.db
      .update(paymentRechargeHistory)
      .set({ status: "timeout", timeoutAt: now })
      .where(
        and(
          eq(paymentRechargeHistory.status, "pending"),
          lt(paymentRechargeHistory.attemptedAt, timeoutThreshold),
        ),
      )
      .returning({ id: paymentRechargeHistory.id, organizationId: paymentRechargeHistory.organizationId });

    // Fix I1: timeout sweep audit log (관측성)
    for (const row of stuckResult) {
      const [sub] = await this.db
        .select({ userId: paymentSubscriptions.userId })
        .from(paymentSubscriptions)
        .where(eq(paymentSubscriptions.organizationId, row.organizationId))
        .limit(1);
      if (!sub) {
        this.logger.warn(`auto_recharge_timeout: no sub found for org ${row.organizationId}, skipping audit log`);
        continue;
      }
      await this.db
        .insert(paymentAuditLog)
        .values({
          actorUserId: sub.userId,
          targetOrgId: row.organizationId,
          action: "auto_recharge_timeout",
          payloadAfter: { rechargeHistoryId: row.id },
        })
        .catch((e) => this.logger.error(`audit log failed: ${e}`));
    }

    this.logger.log(
      `usage-reserve cron tick: expired=${expiredResult.length} stuck=${stuckResult.length} elapsedMs=${Date.now() - startMs}`,
    );
  }
}
