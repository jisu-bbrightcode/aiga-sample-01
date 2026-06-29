import { Injectable, Logger } from "@nestjs/common";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { type DrizzleDB, paymentAuditLog, paymentSubscriptions } from "@repo/drizzle";

export interface UsageNotificationStats {
  accumulatedCents: number;
  monthlyLimitCents: number;
}

export interface NotificationSender {
  send(input: { organizationId: string; type: string; payload: unknown }): Promise<void>;
}

@Injectable()
export class UsageNotificationService {
  private readonly logger = new Logger(UsageNotificationService.name);

  constructor(
    private readonly db: DrizzleDB,
    private readonly notificationSender?: NotificationSender,
  ) {}

  /**
   * accumulated / monthlyLimit 비율이 80% 또는 100% 에 도달하면
   * in-app 알림을 발송한다. 같은 cycle period 안에서 같은 threshold 는
   * audit log 를 검사해 중복 방지한다.
   *
   * - monthlyLimitCents <= 0 (Free plan) → skip
   * - 80% 미만 → skip
   * - threshold 구분: payload.threshold = "80" | "100"
   */
  async maybeNotify(orgId: string, stats: UsageNotificationStats): Promise<void> {
    if (stats.monthlyLimitCents <= 0) return;

    const ratio = stats.accumulatedCents / stats.monthlyLimitCents;
    const threshold = ratio >= 1.0 ? "100" : ratio >= 0.8 ? "80" : null;
    if (!threshold) return;

    // Fix I3: tx + advisory lock — 동시 maybeNotify 호출 시 중복 send 차단
    await this.db.transaction(async (tx) => {
      // advisory lock: 같은 org + threshold 의 동시 실행 직렬화
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${orgId} || '-notify-' || ${threshold}))`,
      );

      // 현재 cycle 의 period_start 를 subscription 에서 조회
      const [sub] = await tx
        .select()
        .from(paymentSubscriptions)
        .where(
          and(
            eq(paymentSubscriptions.organizationId, orgId),
            inArray(paymentSubscriptions.status, ["trialing", "active", "past_due", "grace"]),
          ),
        )
        .limit(1);

      if (!sub) return;

      const periodStart = sub.currentPeriodStart;

      // 같은 cycle 안 같은 threshold 알림이 이미 있으면 skip
      const [existing] = await tx
        .select()
        .from(paymentAuditLog)
        .where(
          and(
            eq(paymentAuditLog.targetOrgId, orgId),
            eq(paymentAuditLog.action, "usage_limit_reached"),
            gte(paymentAuditLog.createdAt, periodStart),
            sql`${paymentAuditLog.payloadAfter}->>'threshold' = ${threshold}`,
          ),
        )
        .limit(1);

      if (existing) return;

      // optional notification sender (in-app) — tx 안에서 실행
      if (this.notificationSender) {
        try {
          await this.notificationSender.send({
            organizationId: orgId,
            type: `usage_threshold_${threshold}`,
            payload: {
              accumulatedCents: stats.accumulatedCents,
              monthlyLimitCents: stats.monthlyLimitCents,
              ratio: Math.round(ratio * 100),
            },
          });
        } catch (e) {
          this.logger.error(
            `notification send failed: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }

      // audit log insert — 중복 방지의 source of truth
      // actorUserId = sub.userId (FK 호환, auto-recharge 패턴과 동일)
      await tx.insert(paymentAuditLog).values({
        actorUserId: sub.userId,
        targetOrgId: orgId,
        action: "usage_limit_reached",
        payloadAfter: {
          ratio: Math.round(ratio * 100),
          threshold,
          accumulatedCents: stats.accumulatedCents,
          monthlyLimitCents: stats.monthlyLimitCents,
        },
      });
    });
  }
}
