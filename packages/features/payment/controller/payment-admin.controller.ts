import type { User } from "@repo/core/nestjs/auth";
import { BetterAuthAdminGuard, BetterAuthGuard, CurrentUser } from "@repo/core/nestjs/auth";
import {
  type DrizzleDB,
  InjectDrizzle,
  paymentCouponRedemptions,
  paymentCoupons,
  paymentModelPricing,
  paymentOrders,
  paymentPlans,
  paymentSubscriptionEvents,
  paymentSubscriptions,
  paymentTopUpPackages,
  user as usersTable,
} from "@repo/drizzle";
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { and, count, desc, eq, gte, ilike, inArray, lt, or, type SQL, sql } from "drizzle-orm";
import { z } from "zod";
import { type AuditableContext, withAuditLog } from "../service/audit.decorator";
import { AuditService } from "../service/audit.service";
import { CouponService } from "../service/coupon.service";
import { CreditLedgerService } from "../service/credit-ledger.service";
import { DunningService } from "../service/dunning.service";
import { PolarAdapter } from "../service/polar.adapter";
import { SubscriptionService } from "../service/subscription.service";

const subStatusEnum = z.enum(["trialing", "active", "past_due", "grace", "canceled"]);
const orderStatusEnum = z.enum(["paid", "refunded", "partially_refunded", "failed"]);

const listSubscribersInput = z.object({
  status: subStatusEnum.optional(),
  planId: z.string().uuid().optional(),
  search: z.string().max(200).optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const listOrdersInput = z.object({
  search: z.string().max(200).optional(),
  status: orderStatusEnum.optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const refundOrderInput = z.object({
  amountCents: z.number().int().positive().optional(),
  reason: z.string().max(500).optional(),
});

const grantCreditsInput = z.object({
  organizationId: z.string(),
  amount: z.number().int().positive(),
  reason: z.string().max(500),
  idempotencyKey: z.string().min(1).max(200),
});

const cancelSubNowInput = z.object({
  reason: z.string().max(500).optional(),
});

const compSubInput = z.object({
  organizationId: z.string(),
  userId: z.string(),
  planId: z.string().uuid(),
  durationMonths: z.number().int().min(1).max(36),
  reason: z.string().max(500),
});

const releaseSoftSuspendInput = z.object({
  reason: z.string().max(500).optional(),
});

const extendTrialEndInput = z.object({
  newTrialEnd: z.coerce.date(),
  reason: z.string().max(500),
});

const planCreateInput = z.object({
  slug: z.string().min(1).max(120),
  name: z.string().min(1).max(200),
  cycle: z.enum(["lifetime", "monthly", "yearly"]),
  priceCents: z.number().int().min(0),
  currency: z.string().length(3).default("USD"),
  includedCreditsPerCycle: z.number().int().min(0),
  seats: z.number().int().min(1).default(1),
  trialDays: z.number().int().min(0).default(0),
  polarProductId: z.string().optional(),
  polarPriceId: z.string().optional(),
});

const planUpdateInput = planCreateInput.partial().omit({ slug: true });

const topUpCreateInput = z.object({
  slug: z.string().min(1).max(120),
  name: z.string().min(1).max(200),
  credits: z.number().int().positive(),
  priceCents: z.number().int().positive(),
  currency: z.string().length(3).default("USD"),
  polarProductId: z.string().min(1),
  polarPriceId: z.string().min(1),
});

const topUpUpdateInput = topUpCreateInput.partial().omit({ slug: true });

const pricingUpsertInput = z.object({
  modelKey: z.string().min(1).max(120),
  displayName: z.string().min(1).max(200),
  inputWeightPer1kTokens: z.number().nonnegative(),
  outputWeightPer1kTokens: z.number().nonnegative(),
});

const couponCreateInput = z.object({
  code: z.string().min(1).max(120),
  type: z.enum(["percent", "amount"]),
  percentOff: z.number().int().min(1).max(100).optional(),
  amountOffCents: z.number().int().positive().optional(),
  duration: z.enum(["once", "repeating", "forever"]),
  durationInMonths: z.number().int().positive().optional(),
  appliesTo: z.enum(["subscription", "top_up", "both"]),
  maxRedemptions: z.number().int().positive().optional(),
  expiresAt: z.coerce.date().optional(),
});

const couponUpdateInput = z
  .object({
    maxRedemptions: z.number().int().positive().nullable().optional(),
    expiresAt: z.coerce.date().nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

const couponListInput = z.object({
  isActive: z.preprocess((value) => {
    if (value === "true") return true;
    if (value === "false") return false;
    return value;
  }, z.boolean().optional()),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const couponRedemptionsInput = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const auditListInput = z.object({
  actorUserId: z.string().optional(),
  targetOrgId: z.string().optional(),
  action: z.string().optional(),
  cursor: z.union([z.string(), z.coerce.number()]).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

interface RequestLike {
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
}

function parseInput<T>(schema: z.ZodType<T>, value: unknown): T {
  try {
    return schema.parse(value ?? {});
  } catch {
    throw new BadRequestException("요청 값이 올바르지 않습니다.");
  }
}

function ok() {
  return { ok: true as const };
}

function auditCtx(audit: AuditService, user: User, req: RequestLike): AuditableContext {
  return {
    audit,
    session: { user: { id: user.id } },
    req: { ip: req.ip, headers: req.headers },
  };
}

@ApiTags("Payment Admin")
@ApiBearerAuth()
@UseGuards(BetterAuthGuard, BetterAuthAdminGuard)
@Controller("admin/payment")
export class PaymentAdminController {
  // biome-ignore lint/complexity/useMaxParams: NestJS DI constructor for payment admin dependencies.
  constructor(
    @InjectDrizzle() private readonly db: DrizzleDB,
    private readonly polar: PolarAdapter,
    private readonly subscription: SubscriptionService,
    private readonly creditLedger: CreditLedgerService,
    private readonly coupon: CouponService,
    private readonly dunning: DunningService,
    private readonly audit: AuditService,
  ) {}

  @Get("dashboard")
  @ApiOperation({ summary: "결제 관리자 대시보드" })
  @ApiResponse({ status: 200, description: "결제 KPI와 최근 이벤트" })
  async dashboard() {
    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [mrrRow] = await this.db
      .select({
        mrrCents: sql<number>`COALESCE(SUM(
          CASE
            WHEN ${paymentPlans.cycle} = 'monthly' THEN ${paymentPlans.priceCents}
            WHEN ${paymentPlans.cycle} = 'yearly'  THEN ${paymentPlans.priceCents} / 12
            ELSE 0
          END
        ), 0)::int`,
        activeSubs: sql<number>`COUNT(*)::int`,
      })
      .from(paymentSubscriptions)
      .innerJoin(paymentPlans, eq(paymentPlans.id, paymentSubscriptions.planId))
      .where(inArray(paymentSubscriptions.status, ["active", "trialing"]));

    const trialing = await this.db
      .select({ n: count() })
      .from(paymentSubscriptions)
      .where(eq(paymentSubscriptions.status, "trialing"));
    const churned = await this.db
      .select({ n: count() })
      .from(paymentSubscriptions)
      .where(
        and(
          eq(paymentSubscriptions.status, "canceled"),
          gte(paymentSubscriptions.canceledAt, since30),
        ),
      );
    const recentEvents = await this.db
      .select()
      .from(paymentSubscriptionEvents)
      .orderBy(desc(paymentSubscriptionEvents.receivedAt))
      .limit(20);
    const mrr = mrrRow?.mrrCents ?? 0;

    return {
      mrr,
      arr: mrr * 12,
      activeSubs: mrrRow?.activeSubs ?? 0,
      trialingSubs: trialing[0]?.n ?? 0,
      churn30d: churned[0]?.n ?? 0,
      mrrDelta30d: 0,
      topPlans: [],
      recentEvents,
    };
  }

  @Get("subscribers")
  @ApiOperation({ summary: "구독자 목록 조회" })
  @ApiQuery({
    name: "status",
    required: false,
    enum: ["trialing", "active", "past_due", "grace", "canceled"],
  })
  @ApiQuery({ name: "planId", required: false })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "cursor", required: false })
  @ApiQuery({ name: "limit", required: false, type: Number })
  async listSubscribers(@Query() rawQuery: unknown) {
    const input = parseInput(listSubscribersInput, rawQuery);
    const limit = Math.min(input.limit ?? 50, 100);
    const conditions: SQL[] = [];
    if (input.status) conditions.push(eq(paymentSubscriptions.status, input.status));
    if (input.planId) conditions.push(eq(paymentSubscriptions.planId, input.planId));
    if (input.search) {
      const searchFilter = or(
        ilike(paymentSubscriptions.organizationId, `%${input.search}%`),
        ilike(paymentSubscriptions.userId, `%${input.search}%`),
      );
      if (searchFilter) conditions.push(searchFilter);
    }
    if (input.cursor) {
      const cursorRow = await this.db
        .select({ createdAt: paymentSubscriptions.createdAt })
        .from(paymentSubscriptions)
        .where(eq(paymentSubscriptions.id, input.cursor))
        .limit(1);
      if (cursorRow[0]) conditions.push(lt(paymentSubscriptions.createdAt, cursorRow[0].createdAt));
    }

    const rows = await this.db
      .select({ sub: paymentSubscriptions, plan: paymentPlans, userEmail: usersTable.email })
      .from(paymentSubscriptions)
      .leftJoin(paymentPlans, eq(paymentPlans.id, paymentSubscriptions.planId))
      .leftJoin(usersTable, eq(usersTable.id, paymentSubscriptions.userId))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(paymentSubscriptions.createdAt))
      .limit(limit);
    return { rows, nextCursor: rows.length === limit ? rows[rows.length - 1]?.sub.id : null };
  }

  @Get("subscribers/:subscriptionId")
  @ApiOperation({ summary: "구독 상세 조회" })
  @ApiParam({ name: "subscriptionId" })
  async getSubscriber(@Param("subscriptionId") subscriptionId: string) {
    const subRows = await this.db
      .select()
      .from(paymentSubscriptions)
      .where(eq(paymentSubscriptions.id, subscriptionId))
      .limit(1);
    const subscription = subRows[0];
    if (!subscription) throw new NotFoundException("구독을 찾을 수 없습니다.");

    const events = await this.db
      .select()
      .from(paymentSubscriptionEvents)
      .where(eq(paymentSubscriptionEvents.subscriptionId, subscription.id))
      .orderBy(desc(paymentSubscriptionEvents.receivedAt))
      .limit(50);
    const redemptions = await this.db
      .select()
      .from(paymentCouponRedemptions)
      .where(eq(paymentCouponRedemptions.organizationId, subscription.organizationId))
      .orderBy(desc(paymentCouponRedemptions.redeemedAt))
      .limit(50);
    const balance = await this.creditLedger.getBalanceWithMeta(subscription.organizationId);
    return { subscription, events, redemptions, balance };
  }

  @Get("orders")
  @ApiOperation({ summary: "결제 주문 목록 조회" })
  @ApiQuery({
    name: "status",
    required: false,
    enum: ["paid", "refunded", "partially_refunded", "failed"],
  })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "cursor", required: false })
  @ApiQuery({ name: "limit", required: false, type: Number })
  async listOrders(@Query() rawQuery: unknown) {
    const input = parseInput(listOrdersInput, rawQuery);
    const limit = Math.min(input.limit ?? 50, 100);
    const conditions: SQL[] = [];
    if (input.status) conditions.push(eq(paymentOrders.status, input.status));
    if (input.search) {
      const searchFilter = or(
        ilike(paymentOrders.polarOrderId, `%${input.search}%`),
        ilike(paymentOrders.organizationId, `%${input.search}%`),
      );
      if (searchFilter) conditions.push(searchFilter);
    }
    if (input.cursor) {
      const cursorRow = await this.db
        .select({ createdAt: paymentOrders.createdAt })
        .from(paymentOrders)
        .where(eq(paymentOrders.id, input.cursor))
        .limit(1);
      if (cursorRow[0]) conditions.push(lt(paymentOrders.createdAt, cursorRow[0].createdAt));
    }
    const rows = await this.db
      .select()
      .from(paymentOrders)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(paymentOrders.createdAt))
      .limit(limit);
    return { rows, nextCursor: rows.length === limit ? rows[rows.length - 1]?.id : null };
  }

  @Get("orders/:orderId")
  @ApiOperation({ summary: "결제 주문 상세 조회" })
  @ApiParam({ name: "orderId" })
  async getOrder(@Param("orderId") orderId: string) {
    const rows = await this.db
      .select()
      .from(paymentOrders)
      .where(eq(paymentOrders.id, orderId))
      .limit(1);
    const order = rows[0];
    if (!order) throw new NotFoundException("주문을 찾을 수 없습니다.");
    return { order };
  }

  @Post("orders/:orderId/refund")
  @ApiOperation({ summary: "결제 주문 환불" })
  @ApiParam({ name: "orderId" })
  @ApiBody({
    schema: {
      type: "object",
      properties: { amountCents: { type: "number" }, reason: { type: "string" } },
    },
  })
  refundOrder(
    @Param("orderId") orderId: string,
    @Body() body: unknown,
    @CurrentUser() user: User,
    @Req() req: RequestLike,
  ) {
    const parsed = parseInput(refundOrderInput, body);
    const input = { orderId, ...parsed };
    return withAuditLog<typeof input, { refundId: string; reverted: number }>(
      "refund",
      async ({ input: i }) => {
        const orderRows = await this.db
          .select()
          .from(paymentOrders)
          .where(eq(paymentOrders.id, i.orderId))
          .limit(1);
        const order = orderRows[0];
        if (!order) throw new NotFoundException("주문을 찾을 수 없습니다.");
        const polarRefund = await this.polar.refundOrder(
          order.polarOrderId,
          i.amountCents,
          i.reason ?? "customer_request",
        );
        const reverse = await this.creditLedger.refundReverse({
          organizationId: order.organizationId,
          orderId: order.subscriptionId ? undefined : order.id,
          subscriptionPeriodKey: order.subscriptionId
            ? `${order.subscriptionId}:${order.id}`
            : undefined,
          refundId: polarRefund.id,
        });
        const refundCents = i.amountCents ?? order.amountCents;
        await this.db
          .update(paymentOrders)
          .set({
            status: refundCents >= order.amountCents ? "refunded" : "partially_refunded",
            refundedAmountCents: order.refundedAmountCents + refundCents,
            updatedAt: new Date(),
          })
          .where(eq(paymentOrders.id, order.id));
        return { refundId: polarRefund.id, reverted: reverse.reverted };
      },
      { extract: () => ({ targetOrgId: undefined, targetSubscriptionId: undefined }) },
    )({ ctx: auditCtx(this.audit, user, req), input });
  }

  @Post("credits/grant")
  @ApiOperation({ summary: "관리자 크레딧 지급" })
  @ApiBody({ schema: { type: "object", additionalProperties: true } })
  grantCredits(@Body() body: unknown, @CurrentUser() user: User, @Req() req: RequestLike) {
    const input = parseInput(grantCreditsInput, body);
    return withAuditLog<typeof input, { balanceAfter: number }>(
      "grant_credits",
      async ({ input: i }) => {
        const out = await this.creditLedger.grantAdmin({
          organizationId: i.organizationId,
          amount: i.amount,
          actorUserId: user.id,
          idempotencyKey: i.idempotencyKey,
        });
        return { balanceAfter: out.balanceAfter };
      },
    )({ ctx: auditCtx(this.audit, user, req), input });
  }

  @Post("credits/revoke")
  @ApiOperation({ summary: "관리자 크레딧 회수" })
  @ApiBody({ schema: { type: "object", additionalProperties: true } })
  revokeCredits(@Body() body: unknown, @CurrentUser() user: User, @Req() req: RequestLike) {
    const input = parseInput(grantCreditsInput, body);
    return withAuditLog<typeof input, { balanceAfter: number }>(
      "revoke_credits",
      async ({ input: i }) => {
        const out = await this.creditLedger.revokeAdmin({
          organizationId: i.organizationId,
          amount: i.amount,
          actorUserId: user.id,
          idempotencyKey: i.idempotencyKey,
        });
        return { balanceAfter: out.balanceAfter };
      },
    )({ ctx: auditCtx(this.audit, user, req), input });
  }

  @Post("subscribers/:subscriptionId/cancel-now")
  @ApiOperation({ summary: "구독 즉시 취소" })
  @ApiBody({ schema: { type: "object", properties: { reason: { type: "string" } } } })
  cancelSubscriptionNow(
    @Param("subscriptionId") subscriptionId: string,
    @Body() body: unknown,
    @CurrentUser() user: User,
    @Req() req: RequestLike,
  ) {
    const input = { subscriptionId, ...parseInput(cancelSubNowInput, body) };
    return withAuditLog<typeof input, { ok: true }>("cancel_sub_now", async ({ input: i }) => {
      const subRows = await this.db
        .select()
        .from(paymentSubscriptions)
        .where(eq(paymentSubscriptions.id, i.subscriptionId))
        .limit(1);
      const sub = subRows[0];
      if (!sub) throw new NotFoundException("구독을 찾을 수 없습니다.");
      await this.subscription.cancelSubscriptionNow({
        subscriptionId: sub.id,
        reason: i.reason ?? "",
      });
      if (sub.polarSubscriptionId) {
        try {
          await this.polar.cancelSubscription(sub.polarSubscriptionId, false);
        } catch {
          // Reconcile cron will pick up Polar drift.
        }
      }
      return ok();
    })({ ctx: auditCtx(this.audit, user, req), input });
  }

  @Post("subscriptions/comp")
  @ApiOperation({ summary: "관리자 보상 구독 생성" })
  @ApiBody({ schema: { type: "object", additionalProperties: true } })
  compSubscription(@Body() body: unknown, @CurrentUser() user: User, @Req() req: RequestLike) {
    const input = parseInput(compSubInput, body);
    return withAuditLog<typeof input, { subscriptionId: string }>(
      "comp_subscription",
      ({ input: i }) =>
        this.subscription.compSubscription({
          organizationId: i.organizationId,
          userId: i.userId,
          planId: i.planId,
          durationMonths: i.durationMonths,
          reason: i.reason,
          actorUserId: user.id,
        }),
    )({ ctx: auditCtx(this.audit, user, req), input });
  }

  @Post("subscribers/:subscriptionId/release-soft-suspend")
  @ApiOperation({ summary: "구독 soft suspend 해제" })
  @ApiBody({ schema: { type: "object", properties: { reason: { type: "string" } } } })
  releaseSoftSuspend(
    @Param("subscriptionId") subscriptionId: string,
    @Body() body: unknown,
    @CurrentUser() user: User,
    @Req() req: RequestLike,
  ) {
    const input = { subscriptionId, ...parseInput(releaseSoftSuspendInput, body) };
    return withAuditLog<typeof input, { ok: boolean }>("release_soft_suspend", ({ input: i }) =>
      this.dunning.releaseSoftSuspend({
        subscriptionId: i.subscriptionId,
        actorUserId: user.id,
        reason: i.reason,
      }),
    )({ ctx: auditCtx(this.audit, user, req), input });
  }

  @Post("subscribers/:subscriptionId/extend-trial")
  @ApiOperation({ summary: "구독 trial 종료일 연장" })
  @ApiBody({ schema: { type: "object", additionalProperties: true } })
  extendTrialEnd(
    @Param("subscriptionId") subscriptionId: string,
    @Body() body: unknown,
    @CurrentUser() user: User,
    @Req() req: RequestLike,
  ) {
    const input = { subscriptionId, ...parseInput(extendTrialEndInput, body) };
    return withAuditLog<typeof input, { ok: true }>("extend_trial_end", ({ input: i }) =>
      this.subscription.extendTrialEnd({
        subscriptionId: i.subscriptionId,
        newTrialEnd: i.newTrialEnd,
        reason: i.reason,
      }),
    )({ ctx: auditCtx(this.audit, user, req), input });
  }

  @Get("plans")
  @ApiOperation({ summary: "결제 플랜 목록 조회" })
  listPlans() {
    return this.db.select().from(paymentPlans).orderBy(desc(paymentPlans.createdAt));
  }

  @Post("plans")
  @ApiOperation({ summary: "결제 플랜 생성" })
  @ApiBody({ schema: { type: "object", additionalProperties: true } })
  createPlan(@Body() body: unknown, @CurrentUser() user: User, @Req() req: RequestLike) {
    const input = parseInput(planCreateInput, body);
    return withAuditLog<typeof input, { planId: string }>("plan_create", async ({ input: i }) => {
      const inserted = await this.db
        .insert(paymentPlans)
        .values({
          slug: i.slug,
          name: i.name,
          cycle: i.cycle,
          priceCents: i.priceCents,
          currency: i.currency,
          includedCreditsPerCycle: i.includedCreditsPerCycle,
          seats: i.seats,
          trialDays: i.trialDays,
          polarProductId: i.polarProductId ?? null,
          polarPriceId: i.polarPriceId ?? null,
          isActive: true,
        })
        .returning({ id: paymentPlans.id });
      const planId = inserted[0]?.id;
      if (!planId) throw new BadRequestException("플랜 생성에 실패했습니다.");
      return { planId };
    })({ ctx: auditCtx(this.audit, user, req), input });
  }

  @Patch("plans/:id")
  @ApiOperation({ summary: "결제 플랜 수정" })
  @ApiBody({ schema: { type: "object", additionalProperties: true } })
  updatePlan(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() user: User,
    @Req() req: RequestLike,
  ) {
    const input = { id, patch: parseInput(planUpdateInput, body) };
    return withAuditLog<typeof input, { ok: true }>("plan_update", async ({ input: i }) => {
      const result = await this.db
        .update(paymentPlans)
        .set({ ...i.patch, updatedAt: new Date() })
        .where(eq(paymentPlans.id, i.id))
        .returning({ id: paymentPlans.id });
      if (result.length === 0) throw new NotFoundException("Plan을 찾을 수 없습니다.");
      return ok();
    })({ ctx: auditCtx(this.audit, user, req), input });
  }

  @Delete("plans/:id")
  @ApiOperation({ summary: "결제 플랜 보관 처리" })
  archivePlan(@Param("id") id: string, @CurrentUser() user: User, @Req() req: RequestLike) {
    const input = { id };
    return withAuditLog<typeof input, { ok: true }>("plan_archive", async ({ input: i }) => {
      const result = await this.db
        .update(paymentPlans)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(paymentPlans.id, i.id))
        .returning({ id: paymentPlans.id });
      if (result.length === 0) throw new NotFoundException("Plan을 찾을 수 없습니다.");
      return ok();
    })({ ctx: auditCtx(this.audit, user, req), input });
  }

  @Get("top-up-packages")
  @ApiOperation({ summary: "Top-up 패키지 목록 조회" })
  listTopUpPackages() {
    return this.db
      .select()
      .from(paymentTopUpPackages)
      .orderBy(desc(paymentTopUpPackages.createdAt));
  }

  @Post("top-up-packages")
  @ApiOperation({ summary: "Top-up 패키지 생성" })
  @ApiBody({ schema: { type: "object", additionalProperties: true } })
  createTopUpPackage(@Body() body: unknown, @CurrentUser() user: User, @Req() req: RequestLike) {
    const input = parseInput(topUpCreateInput, body);
    return withAuditLog<typeof input, { packageId: string }>(
      "topup_package_create",
      async ({ input: i }) => {
        const inserted = await this.db
          .insert(paymentTopUpPackages)
          .values({ ...i, isActive: true })
          .returning({ id: paymentTopUpPackages.id });
        const packageId = inserted[0]?.id;
        if (!packageId) throw new BadRequestException("패키지 생성에 실패했습니다.");
        return { packageId };
      },
    )({ ctx: auditCtx(this.audit, user, req), input });
  }

  @Patch("top-up-packages/:id")
  @ApiOperation({ summary: "Top-up 패키지 수정" })
  @ApiBody({ schema: { type: "object", additionalProperties: true } })
  updateTopUpPackage(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() user: User,
    @Req() req: RequestLike,
  ) {
    const input = { id, patch: parseInput(topUpUpdateInput, body) };
    return withAuditLog<typeof input, { ok: true }>(
      "topup_package_update",
      async ({ input: i }) => {
        const result = await this.db
          .update(paymentTopUpPackages)
          .set({ ...i.patch, updatedAt: new Date() })
          .where(eq(paymentTopUpPackages.id, i.id))
          .returning({ id: paymentTopUpPackages.id });
        if (result.length === 0) throw new NotFoundException("패키지를 찾을 수 없습니다.");
        return ok();
      },
    )({ ctx: auditCtx(this.audit, user, req), input });
  }

  @Delete("top-up-packages/:id")
  @ApiOperation({ summary: "Top-up 패키지 보관 처리" })
  archiveTopUpPackage(@Param("id") id: string, @CurrentUser() user: User, @Req() req: RequestLike) {
    const input = { id };
    return withAuditLog<typeof input, { ok: true }>(
      "topup_package_archive",
      async ({ input: i }) => {
        const result = await this.db
          .update(paymentTopUpPackages)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(paymentTopUpPackages.id, i.id))
          .returning({ id: paymentTopUpPackages.id });
        if (result.length === 0) throw new NotFoundException("패키지를 찾을 수 없습니다.");
        return ok();
      },
    )({ ctx: auditCtx(this.audit, user, req), input });
  }

  @Get("model-pricing")
  @ApiOperation({ summary: "모델 가격 목록 조회" })
  listModelPricing() {
    return this.db.select().from(paymentModelPricing).orderBy(desc(paymentModelPricing.createdAt));
  }

  @Put("model-pricing")
  @ApiOperation({ summary: "모델 가격 upsert" })
  @ApiBody({ schema: { type: "object", additionalProperties: true } })
  upsertModelPricing(@Body() body: unknown, @CurrentUser() user: User, @Req() req: RequestLike) {
    const input = parseInput(pricingUpsertInput, body);
    return withAuditLog<typeof input, { modelKey: string }>(
      "model_pricing_upsert",
      async ({ input: i }) => {
        await this.db
          .insert(paymentModelPricing)
          .values({
            modelKey: i.modelKey,
            displayName: i.displayName,
            inputWeightPer1kTokens: String(i.inputWeightPer1kTokens),
            outputWeightPer1kTokens: String(i.outputWeightPer1kTokens),
            isActive: true,
          })
          .onConflictDoUpdate({
            target: paymentModelPricing.modelKey,
            set: {
              displayName: i.displayName,
              inputWeightPer1kTokens: String(i.inputWeightPer1kTokens),
              outputWeightPer1kTokens: String(i.outputWeightPer1kTokens),
              isActive: true,
              updatedAt: new Date(),
            },
          });
        return { modelKey: i.modelKey };
      },
    )({ ctx: auditCtx(this.audit, user, req), input });
  }

  @Delete("model-pricing/:id")
  @ApiOperation({ summary: "모델 가격 보관 처리" })
  archiveModelPricing(@Param("id") id: string, @CurrentUser() user: User, @Req() req: RequestLike) {
    const input = { id };
    return withAuditLog<typeof input, { ok: true }>(
      "model_pricing_archive",
      async ({ input: i }) => {
        const result = await this.db
          .update(paymentModelPricing)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(paymentModelPricing.id, i.id))
          .returning({ id: paymentModelPricing.id });
        if (result.length === 0) throw new NotFoundException("모델 가격을 찾을 수 없습니다.");
        return ok();
      },
    )({ ctx: auditCtx(this.audit, user, req), input });
  }

  @Get("coupons")
  @ApiOperation({ summary: "쿠폰 목록 조회" })
  @ApiQuery({ name: "isActive", required: false, type: Boolean })
  @ApiQuery({ name: "cursor", required: false })
  @ApiQuery({ name: "limit", required: false, type: Number })
  listCoupons(@Query() rawQuery: unknown) {
    const input = parseInput(couponListInput, rawQuery) as {
      isActive?: boolean;
      cursor?: string;
      limit?: number;
    };
    return this.coupon.listCoupons(input);
  }

  @Post("coupons")
  @ApiOperation({ summary: "쿠폰 생성" })
  @ApiBody({ schema: { type: "object", additionalProperties: true } })
  createCoupon(@Body() body: unknown, @CurrentUser() user: User, @Req() req: RequestLike) {
    const input = parseInput(couponCreateInput, body);
    return withAuditLog<typeof input, { couponId: string; polarDiscountId: string }>(
      "coupon_create",
      ({ input: i }) => this.coupon.createCoupon({ ...i, createdByAdminId: user.id }),
    )({ ctx: auditCtx(this.audit, user, req), input });
  }

  @Patch("coupons/:id")
  @ApiOperation({ summary: "쿠폰 수정" })
  @ApiBody({ schema: { type: "object", additionalProperties: true } })
  updateCoupon(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() user: User,
    @Req() req: RequestLike,
  ) {
    const input = { id, patch: parseInput(couponUpdateInput, body) };
    return withAuditLog<typeof input, { ok: true }>("coupon_update", async ({ input: i }) => {
      const result = await this.db
        .update(paymentCoupons)
        .set({ ...i.patch, updatedAt: new Date() })
        .where(eq(paymentCoupons.id, i.id))
        .returning({ id: paymentCoupons.id });
      if (result.length === 0) throw new NotFoundException("쿠폰을 찾을 수 없습니다.");
      return ok();
    })({ ctx: auditCtx(this.audit, user, req), input });
  }

  @Delete("coupons/:id")
  @ApiOperation({ summary: "쿠폰 보관 처리" })
  archiveCoupon(@Param("id") id: string, @CurrentUser() user: User, @Req() req: RequestLike) {
    const input = { id };
    return withAuditLog<typeof input, { ok: true }>("coupon_archive", async ({ input: i }) => {
      await this.coupon.archiveCoupon({ couponId: i.id, actorUserId: user.id });
      return ok();
    })({ ctx: auditCtx(this.audit, user, req), input });
  }

  @Get("coupons/:couponId/redemptions")
  @ApiOperation({ summary: "쿠폰 사용 이력 조회" })
  @ApiParam({ name: "couponId" })
  @ApiQuery({ name: "cursor", required: false })
  @ApiQuery({ name: "limit", required: false, type: Number })
  async couponRedemptions(@Param("couponId") couponId: string, @Query() rawQuery: unknown) {
    const input = { couponId, ...parseInput(couponRedemptionsInput, rawQuery) };
    const limit = Math.min(input.limit ?? 50, 200);
    const conditions = [eq(paymentCouponRedemptions.couponId, input.couponId)];
    if (input.cursor) {
      const cursorRow = await this.db
        .select({ redeemedAt: paymentCouponRedemptions.redeemedAt })
        .from(paymentCouponRedemptions)
        .where(eq(paymentCouponRedemptions.id, input.cursor))
        .limit(1);
      if (cursorRow[0])
        conditions.push(lt(paymentCouponRedemptions.redeemedAt, cursorRow[0].redeemedAt));
    }
    const rows = await this.db
      .select()
      .from(paymentCouponRedemptions)
      .where(and(...conditions))
      .orderBy(desc(paymentCouponRedemptions.redeemedAt))
      .limit(limit);
    return { rows, nextCursor: rows.length === limit ? (rows[rows.length - 1]?.id ?? null) : null };
  }

  @Get("audit-log")
  @ApiOperation({ summary: "결제 관리자 감사 로그 조회" })
  @ApiQuery({ name: "actorUserId", required: false })
  @ApiQuery({ name: "targetOrgId", required: false })
  @ApiQuery({ name: "action", required: false })
  @ApiQuery({ name: "cursor", required: false })
  @ApiQuery({ name: "limit", required: false, type: Number })
  listAuditLog(@Query() rawQuery: unknown) {
    const input = parseInput(auditListInput, rawQuery);
    let cursor: bigint | number | undefined;
    if (typeof input.cursor === "string") {
      cursor = BigInt(input.cursor);
    } else {
      cursor = input.cursor;
    }
    return this.audit.list({ ...input, cursor });
  }
}
