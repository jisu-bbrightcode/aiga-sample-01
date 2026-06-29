import { Injectable } from "@nestjs/common";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  type DrizzleDB,
  paymentAuditLog,
  paymentExtraUsageSettings,
  paymentPlans,
  paymentSubscriptions,
  paymentUsageLedger,
} from "@repo/drizzle";

export interface UsageStats {
  monthlyLimitCents: number;
  accumulatedCents: number;
  remainingCents: number;
  paidBalanceCents: number;
  cycleEnd: Date | null;
  currency: string;
}

@Injectable()
export class ExtraUsageService {
  constructor(private readonly db: DrizzleDB) {}

  async getSettings(orgId: string) {
    const [row] = await this.db
      .select()
      .from(paymentExtraUsageSettings)
      .where(eq(paymentExtraUsageSettings.organizationId, orgId))
      .limit(1);
    if (row) return row;
    // lazy init: row 없으면 plan default 로 자동 생성
    return this.initDefaultSettings(orgId);
  }

  private async initDefaultSettings(orgId: string) {
    const [sub] = await this.db
      .select()
      .from(paymentSubscriptions)
      .where(
        and(
          eq(paymentSubscriptions.organizationId, orgId),
          inArray(paymentSubscriptions.status, ["trialing", "active", "past_due", "grace"]),
        ),
      )
      .limit(1);

    const [plan] = sub
      ? await this.db
          .select()
          .from(paymentPlans)
          .where(eq(paymentPlans.id, sub.planId))
          .limit(1)
      : [];

    const monthlyLimitCents = (() => {
      if (!plan) return 0;
      if (plan.slug.startsWith("pro_")) return 5_000;
      if (plan.slug.startsWith("team_")) return 20_000;
      return 0;
    })();

    const [created] = await this.db
      .insert(paymentExtraUsageSettings)
      .values({
        organizationId: orgId,
        enabled: false,
        monthlyLimitCents,
        autoRechargeEnabled: false,
        autoRechargeThresholdCents: 500,
        monthlyRechargeCapCount: 5,
      })
      .onConflictDoNothing()
      .returning();

    // 극히 드문 race condition: 동시 삽입 시 RETURNING 이 비어있을 수 있음
    if (!created) {
      const [existing] = await this.db
        .select()
        .from(paymentExtraUsageSettings)
        .where(eq(paymentExtraUsageSettings.organizationId, orgId))
        .limit(1);
      if (!existing) throw new Error(`failed to init extra usage settings for org ${orgId}`);
      return existing;
    }
    return created;
  }

  async updateSettings(
    orgId: string,
    patch: Partial<{
      enabled: boolean;
      monthlyLimitCents: number;
      autoRechargeEnabled: boolean;
      autoRechargeThresholdCents: number;
      autoRechargePackageId: string | null;
      monthlyRechargeCapCount: number | null;
      monthlyRechargeCapCents: number | null;
    }>,
    actorUserId = "system",
  ) {
    return this.db.transaction(async (tx) => {
      await tx
        .update(paymentExtraUsageSettings)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(paymentExtraUsageSettings.organizationId, orgId));

      await tx.insert(paymentAuditLog).values({
        actorUserId,
        action: "extra_usage_settings_updated",
        targetOrgId: orgId,
        payloadAfter: patch,
      });
    });
  }

  /**
   * AiUsageMeterService.reserve 가 balance 부족 시 호출.
   * settings 에 따라 분기:
   *   monthly_limit 초과 → throw 'monthly_limit_reached'
   *   enabled=false → throw 'insufficient_balance'
   *   enabled=true, auto_recharge=false → throw 'limit_reached_extra_usage_disabled'
   *   enabled=true, auto_recharge=true, package=null → throw 'auto_recharge_package_not_configured'
   *   else → { autoRechargeNeeded: true, packageId }
   */
  async handleInsufficient(orgId: string, estimateCents: number) {
    const settings = await this.getSettings(orgId);
    const stats = await this.getUsageStats(orgId);

    // 1. monthly_limit 도달 검사
    if (stats.accumulatedCents + estimateCents > settings.monthlyLimitCents) {
      // Fix I2: 한도 도달 audit log (관측성 — 실패 시 throw 막지 않음)
      const [sub] = await this.db
        .select({ userId: paymentSubscriptions.userId })
        .from(paymentSubscriptions)
        .where(
          and(
            eq(paymentSubscriptions.organizationId, orgId),
            inArray(paymentSubscriptions.status, ["trialing", "active", "past_due", "grace"]),
          ),
        )
        .limit(1);
      if (sub) {
        await this.db
          .insert(paymentAuditLog)
          .values({
            actorUserId: sub.userId,
            targetOrgId: orgId,
            action: "usage_limit_reached",
            payloadAfter: {
              accumulatedCents: stats.accumulatedCents,
              monthlyLimitCents: settings.monthlyLimitCents,
              estimateCents,
            },
          })
          .catch(() => {});
      }
      throw new Error("monthly_limit_reached");
    }

    if (!settings.enabled) {
      throw new Error("insufficient_balance");
    }

    if (!settings.autoRechargeEnabled) {
      throw new Error("limit_reached_extra_usage_disabled");
    }

    if (!settings.autoRechargePackageId) {
      throw new Error("auto_recharge_package_not_configured");
    }

    return { autoRechargeNeeded: true as const, packageId: settings.autoRechargePackageId };
  }

  async getUsageStats(orgId: string): Promise<UsageStats> {
    const settings = await this.getSettings(orgId);
    const [sub] = await this.db
      .select()
      .from(paymentSubscriptions)
      .where(
        and(
          eq(paymentSubscriptions.organizationId, orgId),
          inArray(paymentSubscriptions.status, ["trialing", "active", "past_due", "grace"]),
        ),
      )
      .limit(1);

    const cycleStart = sub?.currentPeriodStart ?? new Date(0);
    const cycleEnd = sub?.currentPeriodEnd ?? null;

    // Fix C4: plan currency lookup (다국통화 지원)
    const [plan] = sub
      ? await this.db
          .select({ currency: paymentPlans.currency })
          .from(paymentPlans)
          .where(eq(paymentPlans.id, sub.planId))
          .limit(1)
      : [];
    const currency = plan?.currency ?? "USD";

    const [agg] = await this.db
      .select({ accumulated: sql<number>`COALESCE(SUM(-${paymentUsageLedger.deltaCents}), 0)::int` })
      .from(paymentUsageLedger)
      .where(
        and(
          eq(paymentUsageLedger.organizationId, orgId),
          eq(paymentUsageLedger.reason, "ai_usage"),
          eq(paymentUsageLedger.periodStart, cycleStart),
        ),
      );
    const accumulated = agg?.accumulated ?? 0;

    return {
      monthlyLimitCents: settings.monthlyLimitCents,
      accumulatedCents: accumulated,
      remainingCents: Math.max(0, settings.monthlyLimitCents - accumulated),
      paidBalanceCents: sub?.cachedPaidBalanceCents ?? 0,
      cycleEnd,
      currency,
    };
  }
}
