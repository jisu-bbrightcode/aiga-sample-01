import { BetterAuthGuard, CurrentUser, type User } from "@repo/core/nestjs/auth";
import {
  type DrizzleDB,
  InjectDrizzle,
  paymentOrders,
  paymentPlans,
  paymentSubscriptions,
  paymentTopUpPackages,
} from "@repo/drizzle";
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Post,
  PreconditionFailedException,
  Put,
  Query,
  UnprocessableEntityException,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { and, asc, desc, eq, inArray, lt } from "drizzle-orm";
import { z } from "zod";
import { CouponService } from "../service/coupon.service";
import { CreditLedgerService } from "../service/credit-ledger.service";
import { DunningService } from "../service/dunning.service";
import { ExtraUsageService } from "../service/extra-usage.service";
import { PolarAdapter } from "../service/polar.adapter";
import { SubscriptionService } from "../service/subscription.service";
import {
  CancelSubscriptionDto,
  ChangePlanDto,
  CreateSubscriptionCheckoutDto,
  CreateTopUpCheckoutDto,
  checkoutResultOpenApiSchema,
  creditHistoryQuerySchema,
  invoiceListQuerySchema,
  ManualTopupDto,
  nullablePaymentObjectOpenApiSchema,
  okResultOpenApiSchema,
  PreviewCouponDto,
  paymentObjectListOpenApiSchema,
  paymentObjectOpenApiSchema,
  previewCouponSchema,
  UpdateExtraUsageSettingsDto,
  usageStatsQuerySchema,
} from "./payment.dto";

const ACTIVE_SUBSCRIPTION_STATUSES = ["trialing", "active", "past_due", "grace"] as const;
const REACTIVATABLE_SUBSCRIPTION_STATUSES = ["past_due", "grace"] as const;

type ActiveSubscriptionStatus = (typeof ACTIVE_SUBSCRIPTION_STATUSES)[number];

function activeOrganizationId(user: User): string {
  if (typeof user.activeOrganizationId === "string" && user.activeOrganizationId.length > 0) {
    return user.activeOrganizationId;
  }
  throw new PreconditionFailedException("활성 조직이 필요합니다. 먼저 조직을 선택해 주세요.");
}

function parseQuery<T>(schema: z.ZodType<T>, value: unknown): T {
  try {
    return schema.parse(value);
  } catch {
    throw new BadRequestException("요청 쿼리가 올바르지 않습니다.");
  }
}

function deriveCheckoutIdemKey(userId: string, productId: string): string {
  return `${userId}:${productId}:${Math.floor(Date.now() / 5000)}`;
}

function mapPlanChangeError(error: unknown): never {
  if (error instanceof Error) {
    if (/non-Polar subscription/.test(error.message)) {
      throw new UnprocessableEntityException("관리자 발급 구독은 플랜 변경이 지원되지 않습니다.");
    }
    if (/already on this plan/.test(error.message)) {
      throw new UnprocessableEntityException("이미 해당 플랜을 사용 중입니다.");
    }
    if (/already expired/.test(error.message)) {
      throw new UnprocessableEntityException("구독이 만료된 상태에서는 플랜 변경이 불가합니다.");
    }
    if (/lateral plan change|cycle change has no price difference/.test(error.message)) {
      throw new UnprocessableEntityException("동일 가격대 플랜 변경은 지원되지 않습니다.");
    }
  }
  throw error;
}

@ApiTags("Payment")
@Controller("payment")
export class PaymentPublicController {
  constructor(
    @InjectDrizzle() private readonly db: DrizzleDB,
    private readonly coupon: CouponService,
  ) {}

  @Get("plans")
  @ApiOperation({ summary: "활성 결제 플랜 목록 조회" })
  @ApiResponse({
    status: 200,
    description: "활성 결제 플랜 목록",
    schema: paymentObjectListOpenApiSchema,
  })
  listPlans() {
    return this.db
      .select()
      .from(paymentPlans)
      .where(eq(paymentPlans.isActive, true))
      .orderBy(asc(paymentPlans.priceCents));
  }

  @Get("top-up-packages")
  @ApiOperation({ summary: "활성 크레딧 충전 패키지 목록 조회" })
  @ApiResponse({
    status: 200,
    description: "활성 크레딧 충전 패키지 목록",
    schema: paymentObjectListOpenApiSchema,
  })
  listTopUpPackages() {
    return this.db
      .select()
      .from(paymentTopUpPackages)
      .where(eq(paymentTopUpPackages.isActive, true))
      .orderBy(asc(paymentTopUpPackages.priceCents));
  }

  @Get("coupons/preview")
  @ApiOperation({ summary: "쿠폰 사전 검증" })
  @ApiQuery({ name: "code" })
  @ApiQuery({ name: "scope", enum: ["subscription", "top_up"] })
  @ApiResponse({
    status: 200,
    description: "쿠폰 검증 결과",
    schema: paymentObjectOpenApiSchema,
  })
  previewCoupon(@Query() query: PreviewCouponDto) {
    return this.coupon.previewCoupon(previewCouponSchema.parse(query));
  }
}

@ApiTags("Payment")
@Controller("payment")
@UseGuards(BetterAuthGuard)
@ApiBearerAuth()
export class PaymentController {
  constructor(
    @InjectDrizzle() private readonly db: DrizzleDB,
    private readonly polar: PolarAdapter,
    private readonly subscription: SubscriptionService,
    private readonly creditLedger: CreditLedgerService,
    private readonly coupon: CouponService,
    private readonly dunning: DunningService,
    private readonly extraUsage: ExtraUsageService,
  ) {}

  @Get("me/subscription")
  @ApiOperation({ summary: "내 활성 구독 조회" })
  @ApiResponse({
    status: 200,
    description: "활성 구독. 없으면 null",
    schema: nullablePaymentObjectOpenApiSchema,
  })
  getMySubscription(@CurrentUser() user: User) {
    return this.getActiveSubscriptionOrNull(
      activeOrganizationId(user),
      ACTIVE_SUBSCRIPTION_STATUSES,
    );
  }

  @Get("me/credits/balance")
  @ApiOperation({ summary: "내 크레딧 잔액 조회" })
  @ApiResponse({
    status: 200,
    description: "크레딧 잔액과 메타데이터",
    schema: paymentObjectOpenApiSchema,
  })
  getMyCreditBalance(@CurrentUser() user: User) {
    return this.creditLedger.getBalanceWithMeta(activeOrganizationId(user));
  }

  @Get("me/credits/history")
  @ApiOperation({ summary: "내 크레딧 내역 조회" })
  @ApiQuery({ name: "cursor", required: false })
  @ApiQuery({ name: "limit", required: false })
  @ApiQuery({ name: "reasonFilter", required: false })
  @ApiResponse({
    status: 200,
    description: "페이지네이션된 크레딧 내역",
    schema: paymentObjectOpenApiSchema,
  })
  getMyCreditHistory(@CurrentUser() user: User, @Query() query: unknown) {
    const input = parseQuery(creditHistoryQuerySchema, query);
    return this.creditLedger.listHistory({
      organizationId: activeOrganizationId(user),
      cursor: input.cursor,
      limit: input.limit,
      reasonFilter: input.reasonFilter,
    });
  }

  @Get("me/usage")
  @ApiOperation({ summary: "내 AI 사용량 통계 조회" })
  @ApiQuery({ name: "rangeDays" })
  @ApiResponse({
    status: 200,
    description: "모델별 사용량 통계",
    schema: paymentObjectOpenApiSchema,
  })
  getMyUsageStats(@CurrentUser() user: User, @Query() query: unknown) {
    const input = parseQuery(usageStatsQuerySchema, query);
    return this.creditLedger.getUsageStats({
      organizationId: activeOrganizationId(user),
      rangeDays: input.rangeDays,
    });
  }

  @Get("me/invoices")
  @ApiOperation({ summary: "내 인보이스 목록 조회" })
  @ApiQuery({ name: "cursor", required: false })
  @ApiQuery({ name: "limit", required: false })
  @ApiResponse({
    status: 200,
    description: "인보이스 목록",
    schema: paymentObjectOpenApiSchema,
  })
  async listMyInvoices(@CurrentUser() user: User, @Query() query: unknown) {
    const input = parseQuery(invoiceListQuerySchema, query);
    const limit = Math.min(input.limit ?? 20, 100);
    const conditions = [eq(paymentOrders.organizationId, activeOrganizationId(user))];
    if (input.cursor) {
      const cursorRow = await this.db
        .select({ createdAt: paymentOrders.createdAt })
        .from(paymentOrders)
        .where(eq(paymentOrders.id, input.cursor))
        .limit(1);
      if (cursorRow[0]) {
        conditions.push(lt(paymentOrders.createdAt, cursorRow[0].createdAt));
      }
    }
    const rows = await this.db
      .select()
      .from(paymentOrders)
      .where(and(...conditions))
      .orderBy(desc(paymentOrders.createdAt))
      .limit(limit);
    const nextCursor = rows.length === limit ? (rows.at(-1)?.id ?? null) : null;
    return { rows, nextCursor };
  }

  @Post("checkouts/subscription")
  @ApiOperation({ summary: "구독 Polar checkout 생성" })
  @ApiResponse({
    status: 201,
    description: "checkout URL",
    schema: checkoutResultOpenApiSchema,
  })
  async createSubscriptionCheckout(
    @CurrentUser() user: User,
    @Body() dto: CreateSubscriptionCheckoutDto,
  ) {
    const planRows = await this.db
      .select()
      .from(paymentPlans)
      .where(and(eq(paymentPlans.id, dto.planId), eq(paymentPlans.isActive, true)))
      .limit(1);
    const plan = planRows[0];
    if (!plan) throw new NotFoundException("Plan을 찾을 수 없습니다.");
    if (!plan.polarProductId) {
      throw new BadRequestException("Free plan은 결제가 필요하지 않습니다.");
    }

    let discountId: string | undefined;
    if (dto.couponCode) {
      const preview = await this.coupon.previewCoupon({
        code: dto.couponCode,
        scope: "subscription",
      });
      if (!preview.valid) {
        throw new BadRequestException(`쿠폰을 사용할 수 없습니다: ${preview.reason}`);
      }
      const coupon = await this.coupon.getCouponByCode(dto.couponCode);
      discountId = coupon?.polarDiscountId ?? undefined;
    }

    const out = await this.polar.createCheckout({
      productId: plan.polarProductId,
      customerEmail: user.email ?? "",
      customerExternalId: user.id,
      successUrl: dto.successUrl,
      metadata: {
        organization_id: activeOrganizationId(user),
        user_id: user.id,
        plan_id: plan.id,
        kind: "subscription",
      },
      discountId,
      idempotencyKey: deriveCheckoutIdemKey(user.id, plan.polarProductId),
    });

    return { checkoutUrl: out.url, polarSessionId: out.checkoutId };
  }

  @Post("checkouts/top-up")
  @ApiOperation({ summary: "크레딧 충전 Polar checkout 생성" })
  @ApiResponse({
    status: 201,
    description: "checkout URL",
    schema: checkoutResultOpenApiSchema,
  })
  async createTopUpCheckout(@CurrentUser() user: User, @Body() dto: CreateTopUpCheckoutDto) {
    const pkgRows = await this.db
      .select()
      .from(paymentTopUpPackages)
      .where(
        and(eq(paymentTopUpPackages.id, dto.packageId), eq(paymentTopUpPackages.isActive, true)),
      )
      .limit(1);
    const pkg = pkgRows[0];
    if (!pkg) throw new NotFoundException("Top-up 패키지를 찾을 수 없습니다.");

    let discountId: string | undefined;
    if (dto.couponCode) {
      const preview = await this.coupon.previewCoupon({
        code: dto.couponCode,
        scope: "top_up",
      });
      if (!preview.valid) {
        throw new BadRequestException(`쿠폰을 사용할 수 없습니다: ${preview.reason}`);
      }
      const coupon = await this.coupon.getCouponByCode(dto.couponCode);
      discountId = coupon?.polarDiscountId ?? undefined;
    }

    const out = await this.polar.createCheckout({
      productId: pkg.polarProductId,
      customerEmail: user.email ?? "",
      customerExternalId: user.id,
      successUrl: dto.successUrl,
      metadata: {
        organization_id: activeOrganizationId(user),
        user_id: user.id,
        package_id: pkg.id,
        kind: "topup",
        credits: String(pkg.credits),
      },
      discountId,
      idempotencyKey: deriveCheckoutIdemKey(user.id, pkg.polarProductId),
    });

    return { checkoutUrl: out.url, polarSessionId: out.checkoutId };
  }

  @Get("me/subscription/plan-change-preview")
  @ApiOperation({ summary: "플랜 변경 사전 계산" })
  @ApiQuery({ name: "targetPlanId" })
  @ApiResponse({
    status: 200,
    description: "플랜 변경 사전 계산 결과",
    schema: paymentObjectOpenApiSchema,
  })
  async previewPlanChange(@CurrentUser() user: User, @Query("targetPlanId") targetPlanId: string) {
    const parsed = z.string().uuid().safeParse(targetPlanId);
    if (!parsed.success) throw new BadRequestException("targetPlanId가 올바르지 않습니다.");
    const sub = await this.getActiveSubscriptionOrThrow(
      activeOrganizationId(user),
      ACTIVE_SUBSCRIPTION_STATUSES,
    );
    try {
      return await this.subscription.previewPlanChange({
        subscriptionId: sub.id,
        targetPlanId: parsed.data,
      });
    } catch (error) {
      mapPlanChangeError(error);
    }
  }

  @Post("me/subscription/change-plan")
  @ApiOperation({ summary: "플랜 변경" })
  @ApiResponse({
    status: 201,
    description: "플랜 변경 결과",
    schema: paymentObjectOpenApiSchema,
  })
  async changePlan(@CurrentUser() user: User, @Body() dto: ChangePlanDto) {
    const sub = await this.getActiveSubscriptionOrThrow(
      activeOrganizationId(user),
      ACTIVE_SUBSCRIPTION_STATUSES,
    );
    try {
      return await this.subscription.changePlanV2({
        subscriptionId: sub.id,
        targetPlanId: dto.targetPlanId,
        actorUserId: user.id,
      });
    } catch (error) {
      mapPlanChangeError(error);
    }
  }

  @Post("me/subscription/cancel")
  @ApiOperation({ summary: "구독 해지" })
  @ApiResponse({
    status: 201,
    description: "구독 해지 결과",
    schema: paymentObjectOpenApiSchema,
  })
  async cancelSubscription(@CurrentUser() user: User, @Body() dto: CancelSubscriptionDto) {
    const sub = await this.getActiveSubscriptionOrThrow(
      activeOrganizationId(user),
      ACTIVE_SUBSCRIPTION_STATUSES,
    );
    if (dto.mode === "with_refund") {
      try {
        const result = await this.subscription.cancelImmediatelyWithRefund({
          subscriptionId: sub.id,
          reason: dto.reason ?? "",
          actorUserId: user.id,
        });
        return { effectiveAt: "now" as const, ...result };
      } catch (error) {
        if (error instanceof Error) {
          if (/refund_window_closed/.test(error.message)) {
            throw new UnprocessableEntityException(
              "이미 14일이 지나 즉시 환불 불가. 다음 결제일까지 이용 후 종료됩니다.",
            );
          }
          if (/non-Polar subscription/.test(error.message)) {
            throw new UnprocessableEntityException("관리자 발급 구독은 직접 환불 처리해 주세요.");
          }
          if (/no paid order to refund/.test(error.message)) {
            throw new UnprocessableEntityException("환불 가능한 결제 내역이 없습니다.");
          }
        }
        throw error;
      }
    }

    const result = await this.subscription.scheduleCancelAtPeriodEnd({
      subscriptionId: sub.id,
      reason: dto.reason ?? "",
      actorUserId: user.id,
    });
    return {
      effectiveAt: result.effectiveAt,
      cancelAt: result.cancelAt.toISOString(),
      refundEligible: result.refundEligible,
    };
  }

  @Post("me/subscription/uncancel")
  @ApiOperation({ summary: "기간 종료 해지 예약 취소" })
  @ApiResponse({
    status: 201,
    description: "해지 예약 취소 결과",
    schema: paymentObjectOpenApiSchema,
  })
  async uncancelSubscription(@CurrentUser() user: User) {
    const sub = await this.getActiveSubscriptionOrThrow(
      activeOrganizationId(user),
      ACTIVE_SUBSCRIPTION_STATUSES,
    );
    return this.subscription.uncancelSubscription({
      subscriptionId: sub.id,
      actorUserId: user.id,
    });
  }

  @Post("me/subscription/reactivate")
  @ApiOperation({ summary: "연체/유예 구독 재개" })
  @ApiResponse({
    status: 201,
    description: "구독 재개 결과",
    schema: paymentObjectOpenApiSchema,
  })
  async reactivateSubscription(@CurrentUser() user: User) {
    const sub = await this.getActiveSubscriptionOrNull(
      activeOrganizationId(user),
      REACTIVATABLE_SUBSCRIPTION_STATUSES,
    );
    if (!sub) throw new PreconditionFailedException("재개 가능한 구독이 없습니다.");
    return this.dunning.reactivate({ subscriptionId: sub.id });
  }

  @Get("me/extra-usage/settings")
  @ApiOperation({ summary: "추가 사용량 설정 조회" })
  @ApiResponse({
    status: 200,
    description: "추가 사용량 설정",
    schema: paymentObjectOpenApiSchema,
  })
  getExtraUsageSettings(@CurrentUser() user: User) {
    return this.extraUsage.getSettings(activeOrganizationId(user));
  }

  @Put("me/extra-usage/settings")
  @ApiOperation({ summary: "추가 사용량 설정 수정" })
  @ApiResponse({
    status: 200,
    description: "수정 결과",
    schema: okResultOpenApiSchema,
  })
  async updateExtraUsageSettings(
    @CurrentUser() user: User,
    @Body() dto: UpdateExtraUsageSettingsDto,
  ) {
    await this.extraUsage.updateSettings(activeOrganizationId(user), dto, user.id);
    return { ok: true as const };
  }

  @Get("me/extra-usage/stats")
  @ApiOperation({ summary: "추가 사용량 통계 조회" })
  @ApiResponse({
    status: 200,
    description: "추가 사용량 통계",
    schema: paymentObjectOpenApiSchema,
  })
  getExtraUsageStats(@CurrentUser() user: User) {
    return this.extraUsage.getUsageStats(activeOrganizationId(user));
  }

  @Post("me/extra-usage/manual-topup")
  @ApiOperation({ summary: "추가 사용량 수동 충전 checkout 생성" })
  @ApiResponse({
    status: 201,
    description: "checkout URL",
    schema: checkoutResultOpenApiSchema,
  })
  async triggerManualTopup(@CurrentUser() user: User, @Body() dto: ManualTopupDto) {
    const pkgRows = await this.db
      .select()
      .from(paymentTopUpPackages)
      .where(
        and(eq(paymentTopUpPackages.id, dto.packageId), eq(paymentTopUpPackages.isActive, true)),
      )
      .limit(1);
    const pkg = pkgRows[0];
    if (!pkg) throw new NotFoundException("Top-up 패키지를 찾을 수 없습니다.");
    const out = await this.polar.createCheckout({
      productId: pkg.polarProductId,
      customerEmail: user.email ?? "",
      customerExternalId: user.id,
      successUrl: dto.successUrl,
      metadata: {
        organization_id: activeOrganizationId(user),
        user_id: user.id,
        package_id: pkg.id,
        kind: "topup",
        credits: String(pkg.credits),
      },
      idempotencyKey: deriveCheckoutIdemKey(user.id, pkg.polarProductId),
    });
    return { checkoutUrl: out.url, polarSessionId: out.checkoutId };
  }

  private async getActiveSubscriptionOrNull(
    organizationId: string,
    statuses: readonly ActiveSubscriptionStatus[],
  ) {
    const rows = await this.db
      .select()
      .from(paymentSubscriptions)
      .where(
        and(
          eq(paymentSubscriptions.organizationId, organizationId),
          inArray(paymentSubscriptions.status, [...statuses]),
        ),
      )
      .orderBy(desc(paymentSubscriptions.createdAt))
      .limit(1);
    return rows[0] ?? null;
  }

  private async getActiveSubscriptionOrThrow(
    organizationId: string,
    statuses: readonly ActiveSubscriptionStatus[],
  ) {
    const sub = await this.getActiveSubscriptionOrNull(organizationId, statuses);
    if (!sub) throw new NotFoundException("활성 구독이 없습니다.");
    return sub;
  }
}
