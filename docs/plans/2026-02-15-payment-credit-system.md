# Payment & AI Credit System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** LemonSqueezy 기반 SaaS 결제 시스템을 확장하여 플랜 관리 + AI 토큰 크레딧 시스템을 구축한다.

**Architecture:** 기존 payment feature를 확장하여 plans, credits, model-pricing 스키마/서비스를 추가. agent-server는 server의 크레딧 REST API를 호출하는 소비자로 동작.

**Tech Stack:** NestJS, Drizzle ORM, tRPC v11, LemonSqueezy API, Hono (agent-server)

**Design Doc:** `docs/plans/2026-02-15-payment-credit-system-design.md`

---

## Phase 0: 기존 코드 버그 수정

### Task 1: webhook.service.ts — userId placeholder 수정

**Files:**
- Modify: `packages/features/payment/service/webhook.service.ts:94-131`
- Modify: `packages/features/payment/types/lemon-squeezy.types.ts:278-285`

**Step 1: WebhookPayload 타입에 custom_data 접근 경로 확인**

`types/lemon-squeezy.types.ts:278`에서 `WebhookPayload.meta.custom_data`가 이미 `Record<string, string>` 타입으로 정의되어 있음. 추가 수정 불필요.

**Step 2: webhook.service.ts handleWebhook에서 custom_data 추출**

`handleWebhook` 메서드에서 `payload.meta.custom_data`로 userId를 추출하고 하위 메서드에 전달:

```typescript
// webhook.service.ts:22-89 handleWebhook 메서드
async handleWebhook(payload: WebhookPayload): Promise<void> {
  const { meta, data } = payload;
  const eventName = meta.event_name;
  const eventId = `${eventName}_${data.id}_${Date.now()}`;
  const customData = meta.custom_data; // userId 등 커스텀 데이터

  // ... (웹훅 이벤트 로그 저장 - 기존 동일)

  try {
    switch (eventName) {
      case 'subscription_created':
      case 'subscription_updated':
        await this.handleSubscriptionEvent(
          data.attributes as LemonSqueezySubscription,
          data.id,
          customData, // 추가
        );
        break;
      case 'order_created':
        await this.handleOrderCreated(
          data.attributes as LemonSqueezyOrder,
          data.id,
          customData, // 추가
        );
        break;
      // ... (나머지 case 기존 동일)
    }
    // ... (처리 완료 표시 기존 동일)
  }
}
```

**Step 3: handleSubscriptionEvent에서 userId 추출 로직 수정**

```typescript
// webhook.service.ts:94-131
private async handleSubscriptionEvent(
  data: LemonSqueezySubscription,
  lsId: string,
  customData?: Record<string, string>,
): Promise<void> {
  // custom_data에서 userId 추출, 없으면 email로 profiles 조회
  let userId = customData?.user_id;

  if (!userId) {
    // fallback: email로 profiles에서 조회
    const profile = await this.db.query.profiles.findFirst({
      where: eq(profiles.email, data.user_email),
    });
    userId = profile?.id;
  }

  if (!userId) {
    this.logger.warn(`Cannot resolve userId for subscription ${lsId}, email: ${data.user_email}`);
    return;
  }

  await this.db
    .insert(subscriptions)
    .values({
      lemonSqueezyId: lsId,
      userId,
      customerEmail: data.user_email,
      customerName: data.user_name,
      status: data.status,
      statusFormatted: data.status_formatted,
      price: data.first_subscription_item.price_id,
      currency: 'USD',
      interval: 'month',
      intervalCount: 1,
      trialEndsAt: data.trial_ends_at ? new Date(data.trial_ends_at) : null,
      renewsAt: new Date(data.renews_at),
      endsAt: data.ends_at ? new Date(data.ends_at) : null,
      billingAnchor: data.billing_anchor,
      firstSubscriptionItemId: data.first_subscription_item.id.toString(),
      testMode: data.test_mode,
      urls: data.urls as any,
    })
    .onConflictDoUpdate({
      target: subscriptions.lemonSqueezyId,
      set: {
        status: data.status,
        statusFormatted: data.status_formatted,
        renewsAt: new Date(data.renews_at),
        endsAt: data.ends_at ? new Date(data.ends_at) : null,
      },
    });
}
```

**Step 4: handleOrderCreated에도 customData 전달**

```typescript
private async handleOrderCreated(
  data: LemonSqueezyOrder,
  lsId: string,
  customData?: Record<string, string>,
): Promise<void> {
  let userId: string | undefined = customData?.user_id;

  if (!userId) {
    const profile = await this.db.query.profiles.findFirst({
      where: eq(profiles.email, data.user_email),
    });
    userId = profile?.id;
  }

  await this.db.insert(orders).values({
    lemonSqueezyId: lsId,
    orderNumber: data.order_number,
    userId: userId ?? null,
    customerEmail: data.user_email,
    customerName: data.user_name,
    status: data.status,
    statusFormatted: data.status_formatted,
    subtotal: data.subtotal,
    discount: data.discount_total,
    tax: data.tax,
    total: data.total,
    currency: data.currency,
    testMode: data.test_mode,
    urls: data.urls as any,
  });
}
```

**Step 5: import 추가**

파일 상단에 `profiles` import 추가:
```typescript
import { subscriptions, orders, licenses, webhookEvents, profiles } from '@repo/drizzle';
```

**Step 6: 빌드 확인**

Run: `cd packages/features && pnpm tsc --noEmit`
Expected: 0 errors

**Step 7: Commit**

```bash
git add packages/features/payment/service/webhook.service.ts
git commit -m "fix(payment): webhook userId를 custom_data에서 추출하도록 수정"
```

---

### Task 2: Controller `as any` 캐스팅 제거

**Files:**
- Modify: `packages/features/payment/controller/auth/subscription.controller.ts:43-74`
- Modify: `packages/features/payment/controller/admin/payment-admin.controller.ts:46-61`

**Step 1: subscription.controller.ts — `as any` 제거**

```typescript
// subscription.controller.ts:34-47 — updateSubscription
@UseGuards(JwtAuthGuard)
@Patch(':id')
async updateSubscription(
  @Param('id') id: string,
  @Body() dto: UpdateSubscriptionDto,
  @CurrentUser() user: User,
) {
  const subscription = await this.paymentService.getUserSubscription(user.id);
  if (!subscription || subscription.lemonSqueezyId !== id) {
    throw new ForbiddenException('Subscription not found or unauthorized');
  }
  return this.lemonSqueezyService.updateSubscription(id, dto);
}

// subscription.controller.ts:71-75 — validateLicense
@Post('licenses/validate')
async validateLicense(@Body() dto: ValidateLicenseDto) {
  return this.paymentService.validateLicense(dto.licenseKey);
}
```

import에 `ForbiddenException` 추가:
```typescript
import { Controller, Get, Patch, Delete, Post, Body, Param, UseGuards, ForbiddenException } from '@nestjs/common';
```

`cancelSubscription`의 `throw new Error`도 `ForbiddenException`으로 교체.

**Step 2: payment-admin.controller.ts — `as any` 제거**

```typescript
// payment-admin.controller.ts:42-48 — refundSubscription
@Post('subscriptions/:id/refund')
async refundSubscription(
  @Param('id') subscriptionId: string,
  @Body() dto: RefundSubscriptionDto,
) {
  return this.paymentService.refundSubscription(subscriptionId, dto.reason);
}

// payment-admin.controller.ts:55-62 — refundOrder
@Post('orders/:id/refund')
async refundOrder(
  @Param('id') orderId: string,
  @Body() dto: RefundOrderDto,
) {
  return this.paymentService.refundOrder(orderId, dto.amount, dto.reason);
}
```

**Step 3: DTO 타입 확인**

DTO 파일들을 확인하여 `reason`, `amount`, `licenseKey` 프로퍼티가 실제로 존재하는지 검증. 없으면 DTO에 추가.

**Step 4: 빌드 확인**

Run: `cd packages/features && pnpm tsc --noEmit`

**Step 5: Commit**

```bash
git add packages/features/payment/controller/
git commit -m "fix(payment): controller as any 캐스팅 제거 + ForbiddenException 적용"
```

---

### Task 3: feature-config.ts에 payment 메뉴 등록

**Files:**
- Modify: `apps/system-admin/src/feature-config.ts`
- Modify: `apps/system-admin/src/features/payment/routes.tsx` (PAYMENT_ADMIN_PATH export 추가)
- Modify: `apps/system-admin/src/features/payment/index.ts` (re-export)

**Step 1: routes.tsx에 경로 상수 추가**

```typescript
// apps/system-admin/src/features/payment/routes.tsx 상단에 추가
export const PAYMENT_ADMIN_PATH = "/admin/payment";
```

**Step 2: index.ts에서 re-export**

```typescript
// apps/system-admin/src/features/payment/index.ts
export { PAYMENT_ADMIN_PATH } from './routes';
export * from './hooks';
export * from './components';
export * from './pages';
```

**Step 3: feature-config.ts에 메뉴 추가**

```typescript
// import 추가
import { PAYMENT_ADMIN_PATH } from "./features/payment";
import { CreditCard } from "lucide-react"; // lucide-react import에 추가

// featureAdminMenus 배열에 추가 (order: 25로 파일관리 다음)
{
  id: "payment",
  label: "결제",
  path: PAYMENT_ADMIN_PATH,
  icon: CreditCard,
  order: 25,
},
```

**Step 4: 빌드 확인**

Run: `cd apps/system-admin && pnpm tsc --noEmit`

**Step 5: Commit**

```bash
git add apps/system-admin/src/feature-config.ts apps/system-admin/src/features/payment/
git commit -m "fix(payment): Admin 사이드바에 결제 메뉴 등록"
```

---

## Phase 1: 스키마 추가

### Task 4: payment_plans 스키마 작성

**Files:**
- Create: `packages/drizzle/src/schema/features/payment/plans.ts`
- Modify: `packages/drizzle/src/schema/features/payment/index.ts` (re-export)

**Step 1: plans.ts 작성**

```typescript
// packages/drizzle/src/schema/features/payment/plans.ts
import { baseColumns } from "../../../utils/columns";
import { boolean, integer, jsonb, pgEnum, pgTable, text } from "drizzle-orm/pg-core";

// ============================================================================
// Enums
// ============================================================================

export const paymentPlanTierEnum = pgEnum("payment_plan_tier", [
  "free",
  "pro",
  "team",
  "enterprise",
]);

// ============================================================================
// Tables
// ============================================================================

export const paymentPlans = pgTable("payment_plans", {
  ...baseColumns(),

  // 플랜 기본 정보
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  tier: paymentPlanTierEnum("tier").notNull(),

  // 크레딧 한도
  monthlyCredits: integer("monthly_credits").notNull(),

  // 가격 (LS 동기화)
  price: integer("price").notNull().default(0), // cents
  currency: text("currency").notNull().default("USD"),
  interval: text("interval").default("month"), // month, year

  // LemonSqueezy 매핑
  lemonSqueezyProductId: text("lemon_squeezy_product_id"),
  lemonSqueezyVariantId: text("lemon_squeezy_variant_id"),

  // 메타
  features: jsonb("features").$type<string[]>(), // UI 비교표에서 사용할 기능 목록
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

// ============================================================================
// Type Exports
// ============================================================================

export type PaymentPlan = typeof paymentPlans.$inferSelect;
export type NewPaymentPlan = typeof paymentPlans.$inferInsert;
```

**Step 2: index.ts에서 re-export 추가**

`packages/drizzle/src/schema/features/payment/index.ts` 맨 하단에:
```typescript
// Plans
export * from "./plans";
```

**Step 3: 빌드 확인**

Run: `cd packages/drizzle && pnpm tsc --noEmit`

**Step 4: Commit**

```bash
git add packages/drizzle/src/schema/features/payment/
git commit -m "feat(payment): payment_plans 스키마 추가"
```

---

### Task 5: payment_credit_balances + payment_credit_transactions 스키마 작성

**Files:**
- Create: `packages/drizzle/src/schema/features/payment/credits.ts`
- Modify: `packages/drizzle/src/schema/features/payment/index.ts` (re-export)

**Step 1: credits.ts 작성**

```typescript
// packages/drizzle/src/schema/features/payment/credits.ts
import { baseColumns } from "../../../utils/columns";
import { profiles } from "../../core/profiles";
import { boolean, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { paymentPlans } from "./plans";
import { orders } from "./index";

// ============================================================================
// Enums
// ============================================================================

export const paymentCreditTransactionTypeEnum = pgEnum("payment_credit_transaction_type", [
  "allocation",  // 월간 배정
  "deduction",   // AI 사용 차감
  "purchase",    // 추가 구매
  "refund",      // 환불
  "adjustment",  // 관리자 수동 조정
  "expiration",  // 기간 만료
]);

// ============================================================================
// Tables
// ============================================================================

/**
 * 사용자별 크레딧 잔액
 */
export const paymentCreditBalances = pgTable("payment_credit_balances", {
  ...baseColumns(),

  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => profiles.id, { onDelete: "cascade" }),
  planId: uuid("plan_id").references(() => paymentPlans.id),

  // 잔액
  balance: integer("balance").notNull().default(0),
  monthlyAllocation: integer("monthly_allocation").notNull().default(0),

  // 자동 충전 설정
  autoRecharge: boolean("auto_recharge").notNull().default(false),
  autoRechargeAmount: integer("auto_recharge_amount"),
  autoRechargeThreshold: integer("auto_recharge_threshold"),

  // 기간
  currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  lastRechargedAt: timestamp("last_recharged_at", { withTimezone: true }),
});

/**
 * 크레딧 트랜잭션 로그
 */
export const paymentCreditTransactions = pgTable("payment_credit_transactions", {
  ...baseColumns(),

  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  type: paymentCreditTransactionTypeEnum("type").notNull(),

  // 금액
  amount: integer("amount").notNull(), // +는 충전, -는 차감
  balanceBefore: integer("balance_before").notNull(),
  balanceAfter: integer("balance_after").notNull(),

  // 설명
  description: text("description"),
  metadata: jsonb("metadata").$type<{
    modelId?: string;
    provider?: string;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    messageId?: string;
    threadId?: string;
  }>(),

  // 관련 주문 (구매 시)
  relatedOrderId: uuid("related_order_id").references(() => orders.id),
});

// ============================================================================
// Type Exports
// ============================================================================

export type PaymentCreditBalance = typeof paymentCreditBalances.$inferSelect;
export type NewPaymentCreditBalance = typeof paymentCreditBalances.$inferInsert;

export type PaymentCreditTransaction = typeof paymentCreditTransactions.$inferSelect;
export type NewPaymentCreditTransaction = typeof paymentCreditTransactions.$inferInsert;
```

**주의:** `orders`를 `./index`에서 import할 때 순환 참조가 발생할 수 있음. 그 경우 `relatedOrderId`의 references를 제거하고 앱 레벨에서 관계를 정의. 빌드 시 확인.

**Step 2: index.ts에서 re-export 추가**

```typescript
export * from "./credits";
```

**Step 3: 빌드 확인**

Run: `cd packages/drizzle && pnpm tsc --noEmit`

순환 참조 에러 발생 시: `credits.ts`에서 `orders` import를 제거하고 `relatedOrderId`를 plain `uuid()` 컬럼으로 변경.

**Step 4: Commit**

```bash
git add packages/drizzle/src/schema/features/payment/
git commit -m "feat(payment): credit_balances + credit_transactions 스키마 추가"
```

---

### Task 6: payment_model_pricing 스키마 작성

**Files:**
- Create: `packages/drizzle/src/schema/features/payment/model-pricing.ts`
- Modify: `packages/drizzle/src/schema/features/payment/index.ts` (re-export)

**Step 1: model-pricing.ts 작성**

```typescript
// packages/drizzle/src/schema/features/payment/model-pricing.ts
import { baseColumns } from "../../../utils/columns";
import { boolean, integer, pgTable, text } from "drizzle-orm/pg-core";

// ============================================================================
// Tables
// ============================================================================

/**
 * AI 모델별 크레딧 환산비율
 */
export const paymentModelPricing = pgTable("payment_model_pricing", {
  ...baseColumns(),

  modelId: text("model_id").notNull().unique(),     // "claude-sonnet-4-5", "gpt-4o-mini"
  provider: text("provider").notNull(),              // "anthropic", "openai", "google"
  displayName: text("display_name").notNull(),       // "Claude Sonnet 4.5"

  // 크레딧 환산 (1000 토큰당 크레딧)
  inputCreditsPerKToken: integer("input_credits_per_k_token").notNull(),
  outputCreditsPerKToken: integer("output_credits_per_k_token").notNull(),

  isActive: boolean("is_active").notNull().default(true),
});

// ============================================================================
// Type Exports
// ============================================================================

export type PaymentModelPricing = typeof paymentModelPricing.$inferSelect;
export type NewPaymentModelPricing = typeof paymentModelPricing.$inferInsert;
```

**Step 2: index.ts에서 re-export 추가**

```typescript
export * from "./model-pricing";
```

**Step 3: 빌드 확인**

Run: `cd packages/drizzle && pnpm tsc --noEmit`

**Step 4: DB Migration 생성**

Run: `cd packages/drizzle && pnpm drizzle-kit generate`

새 테이블 3개 + enum 2개가 migration에 포함되는지 확인.

**Step 5: Commit**

```bash
git add packages/drizzle/
git commit -m "feat(payment): model_pricing 스키마 추가 + migration 생성"
```

---

## Phase 2: Backend 서비스

### Task 7: plan.service.ts 작성

**Files:**
- Create: `packages/features/payment/service/plan.service.ts`
- Modify: `packages/features/payment/service/index.ts` (export)

**Step 1: plan.service.ts 작성**

```typescript
// packages/features/payment/service/plan.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDrizzle } from '@repo/drizzle';
import { DrizzleDB } from '@repo/drizzle';
import { eq, asc } from 'drizzle-orm';
import { paymentPlans, paymentCreditBalances } from '@repo/drizzle';

@Injectable()
export class PlanService {
  constructor(@InjectDrizzle() private readonly db: DrizzleDB) {}

  /**
   * 활성 플랜 목록 (정렬 순서대로)
   */
  async getPlans() {
    return this.db.query.paymentPlans.findMany({
      where: eq(paymentPlans.isActive, true),
      orderBy: [asc(paymentPlans.sortOrder)],
    });
  }

  /**
   * 플랜 상세 조회
   */
  async getPlanById(id: string) {
    const plan = await this.db.query.paymentPlans.findFirst({
      where: eq(paymentPlans.id, id),
    });
    if (!plan) throw new NotFoundException('Plan not found');
    return plan;
  }

  /**
   * 플랜 생성 (Admin)
   */
  async createPlan(input: {
    name: string;
    slug: string;
    description?: string;
    tier: 'free' | 'pro' | 'team' | 'enterprise';
    monthlyCredits: number;
    price?: number;
    currency?: string;
    interval?: string;
    lemonSqueezyProductId?: string;
    lemonSqueezyVariantId?: string;
    features?: string[];
    sortOrder?: number;
  }) {
    const [plan] = await this.db
      .insert(paymentPlans)
      .values(input)
      .returning();
    return plan;
  }

  /**
   * 플랜 수정 (Admin)
   */
  async updatePlan(id: string, input: Partial<typeof paymentPlans.$inferInsert>) {
    await this.getPlanById(id); // 존재 확인
    const [updated] = await this.db
      .update(paymentPlans)
      .set(input)
      .where(eq(paymentPlans.id, id))
      .returning();
    return updated;
  }

  /**
   * 사용자에게 플랜 할당
   */
  async assignPlanToUser(userId: string, planId: string) {
    const plan = await this.getPlanById(planId);

    await this.db
      .insert(paymentCreditBalances)
      .values({
        userId,
        planId,
        balance: plan.monthlyCredits,
        monthlyAllocation: plan.monthlyCredits,
        currentPeriodStart: new Date(),
        currentPeriodEnd: this.getNextPeriodEnd(),
        lastRechargedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: paymentCreditBalances.userId,
        set: {
          planId,
          monthlyAllocation: plan.monthlyCredits,
          balance: plan.monthlyCredits,
          currentPeriodStart: new Date(),
          currentPeriodEnd: this.getNextPeriodEnd(),
          lastRechargedAt: new Date(),
        },
      });

    return { success: true, planId, monthlyCredits: plan.monthlyCredits };
  }

  private getNextPeriodEnd(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
  }
}
```

**Step 2: service/index.ts에 export 추가**

```typescript
export * from './plan.service';
```

**Step 3: 빌드 확인**

Run: `cd packages/features && pnpm tsc --noEmit`

**Step 4: Commit**

```bash
git add packages/features/payment/service/
git commit -m "feat(payment): PlanService 구현 (플랜 CRUD + 사용자 할당)"
```

---

### Task 8: credit.service.ts 작성

**Files:**
- Create: `packages/features/payment/service/credit.service.ts`
- Modify: `packages/features/payment/service/index.ts` (export)

**Step 1: credit.service.ts 작성**

```typescript
// packages/features/payment/service/credit.service.ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectDrizzle } from '@repo/drizzle';
import { DrizzleDB } from '@repo/drizzle';
import { eq, desc, and, count, sql } from 'drizzle-orm';
import {
  paymentCreditBalances,
  paymentCreditTransactions,
  paymentModelPricing,
} from '@repo/drizzle';

@Injectable()
export class CreditService {
  constructor(@InjectDrizzle() private readonly db: DrizzleDB) {}

  /**
   * 크레딧 잔액 조회
   */
  async getBalance(userId: string) {
    const balance = await this.db.query.paymentCreditBalances.findFirst({
      where: eq(paymentCreditBalances.userId, userId),
    });
    if (!balance) {
      // 잔액 레코드 없으면 Free 플랜 기본값 생성
      const [created] = await this.db
        .insert(paymentCreditBalances)
        .values({ userId, balance: 0, monthlyAllocation: 0 })
        .returning();
      return created;
    }
    return balance;
  }

  /**
   * 잔액 충분 여부 확인 (agent-server용)
   */
  async checkBalance(userId: string, estimatedCredits: number) {
    const balance = await this.getBalance(userId);
    return {
      sufficient: balance.balance >= estimatedCredits,
      currentBalance: balance.balance,
      estimatedCost: estimatedCredits,
      remaining: balance.balance - estimatedCredits,
    };
  }

  /**
   * 크레딧 차감 (agent-server AI 호출 후)
   */
  async deductCredits(
    userId: string,
    amount: number,
    metadata?: {
      modelId?: string;
      provider?: string;
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
      messageId?: string;
      threadId?: string;
    },
  ) {
    if (amount <= 0) throw new BadRequestException('Amount must be positive');

    const balance = await this.getBalance(userId);

    if (balance.balance < amount) {
      throw new BadRequestException('Insufficient credits');
    }

    const newBalance = balance.balance - amount;

    // 트랜잭션으로 잔액 차감 + 로그 기록
    await this.db.transaction(async (tx) => {
      await tx
        .update(paymentCreditBalances)
        .set({ balance: newBalance })
        .where(eq(paymentCreditBalances.userId, userId));

      await tx.insert(paymentCreditTransactions).values({
        userId,
        type: 'deduction',
        amount: -amount,
        balanceBefore: balance.balance,
        balanceAfter: newBalance,
        description: metadata?.modelId
          ? `AI 사용: ${metadata.modelId}`
          : 'AI 사용',
        metadata: metadata as any,
      });
    });

    // 자동 충전 체크
    if (balance.autoRecharge && balance.autoRechargeThreshold && newBalance <= balance.autoRechargeThreshold) {
      // TODO: 자동 충전 로직 (LS checkout 생성)
    }

    return { success: true, balanceBefore: balance.balance, balanceAfter: newBalance };
  }

  /**
   * 크레딧 추가 (구매/배정/환불)
   */
  async addCredits(
    userId: string,
    amount: number,
    type: 'allocation' | 'purchase' | 'refund' | 'adjustment',
    description?: string,
    relatedOrderId?: string,
  ) {
    if (amount <= 0) throw new BadRequestException('Amount must be positive');

    const balance = await this.getBalance(userId);
    const newBalance = balance.balance + amount;

    await this.db.transaction(async (tx) => {
      await tx
        .update(paymentCreditBalances)
        .set({ balance: newBalance })
        .where(eq(paymentCreditBalances.userId, userId));

      await tx.insert(paymentCreditTransactions).values({
        userId,
        type,
        amount,
        balanceBefore: balance.balance,
        balanceAfter: newBalance,
        description,
        relatedOrderId,
      });
    });

    return { success: true, balanceBefore: balance.balance, balanceAfter: newBalance };
  }

  /**
   * 트랜잭션 내역 조회 (페이지네이션)
   */
  async getTransactions(userId: string, input: { page: number; limit: number }) {
    const { page, limit } = input;
    const offset = (page - 1) * limit;

    const [data, totalResult] = await Promise.all([
      this.db.query.paymentCreditTransactions.findMany({
        where: eq(paymentCreditTransactions.userId, userId),
        limit,
        offset,
        orderBy: [desc(paymentCreditTransactions.createdAt)],
      }),
      this.db
        .select({ count: count() })
        .from(paymentCreditTransactions)
        .where(eq(paymentCreditTransactions.userId, userId)),
    ]);

    return {
      data,
      total: totalResult[0]?.count ?? 0,
      page,
      limit,
      totalPages: Math.ceil((totalResult[0]?.count ?? 0) / limit),
    };
  }

  /**
   * 관리자 수동 크레딧 조정
   */
  async adjustBalance(userId: string, amount: number, reason: string) {
    return this.addCredits(userId, Math.abs(amount), 'adjustment', reason);
  }

  /**
   * 토큰→크레딧 환산
   */
  async calculateCredits(
    modelId: string,
    promptTokens: number,
    completionTokens: number,
  ): Promise<number> {
    const pricing = await this.db.query.paymentModelPricing.findFirst({
      where: eq(paymentModelPricing.modelId, modelId),
    });

    if (!pricing) {
      // 기본 환산: 1K 토큰 = 1 크레딧
      return Math.ceil((promptTokens + completionTokens) / 1000);
    }

    const inputCredits = Math.ceil((promptTokens / 1000) * pricing.inputCreditsPerKToken);
    const outputCredits = Math.ceil((completionTokens / 1000) * pricing.outputCreditsPerKToken);

    return inputCredits + outputCredits;
  }
}
```

**Step 2: service/index.ts에 export 추가**

```typescript
export * from './credit.service';
```

**Step 3: 빌드 확인**

Run: `cd packages/features && pnpm tsc --noEmit`

**Step 4: Commit**

```bash
git add packages/features/payment/service/
git commit -m "feat(payment): CreditService 구현 (잔액/차감/충전/환산)"
```

---

### Task 9: model-pricing.service.ts 작성

**Files:**
- Create: `packages/features/payment/service/model-pricing.service.ts`
- Modify: `packages/features/payment/service/index.ts` (export)

**Step 1: model-pricing.service.ts 작성**

```typescript
// packages/features/payment/service/model-pricing.service.ts
import { Injectable } from '@nestjs/common';
import { InjectDrizzle } from '@repo/drizzle';
import { DrizzleDB } from '@repo/drizzle';
import { eq } from 'drizzle-orm';
import { paymentModelPricing } from '@repo/drizzle';

@Injectable()
export class ModelPricingService {
  constructor(@InjectDrizzle() private readonly db: DrizzleDB) {}

  /**
   * 모델 가격 목록
   */
  async getPricingList() {
    return this.db.query.paymentModelPricing.findMany({
      where: eq(paymentModelPricing.isActive, true),
    });
  }

  /**
   * 모델 가격 설정 (upsert)
   */
  async upsertPricing(input: {
    modelId: string;
    provider: string;
    displayName: string;
    inputCreditsPerKToken: number;
    outputCreditsPerKToken: number;
  }) {
    const [result] = await this.db
      .insert(paymentModelPricing)
      .values(input)
      .onConflictDoUpdate({
        target: paymentModelPricing.modelId,
        set: {
          provider: input.provider,
          displayName: input.displayName,
          inputCreditsPerKToken: input.inputCreditsPerKToken,
          outputCreditsPerKToken: input.outputCreditsPerKToken,
        },
      })
      .returning();
    return result;
  }
}
```

**Step 2: service/index.ts에 export 추가**

```typescript
export * from './model-pricing.service';
```

**Step 3: 빌드 확인 + Commit**

```bash
git add packages/features/payment/service/
git commit -m "feat(payment): ModelPricingService 구현"
```

---

### Task 10: Module 업데이트 + tRPC Router 확장

**Files:**
- Modify: `packages/features/payment/payment.module.ts`
- Modify: `packages/features/payment/payment.router.ts`
- Modify: `packages/features/payment/index.ts`

**Step 1: payment.module.ts에 새 서비스 등록**

PlanService, CreditService, ModelPricingService를 providers/exports에 추가.
onModuleInit에서 새 서비스들도 inject.

**Step 2: payment.router.ts에 새 프로시저 추가**

service container에 새 서비스 타입 추가:
```typescript
const services = createServiceContainer<{
  paymentService: PaymentService;
  lemonSqueezyService: LemonSqueezyService;
  planService: PlanService;
  creditService: CreditService;
  modelPricingService: ModelPricingService;
}>();
```

새 프로시저 추가:
- `getPlans` (public)
- `getMyBalance`, `getMyTransactions`, `purchaseCredits`, `updateAutoRecharge` (protected)
- `checkBalance`, `deductCredits` (protected — agent-server용)
- `admin.getPlans`, `admin.createPlan`, `admin.updatePlan` (admin)
- `admin.getUserCredits`, `admin.adjustUserCredits` (admin)
- `admin.getModelPricing`, `admin.upsertModelPricing` (admin)

**Step 3: DTO 파일 추가**

새 프로시저에 필요한 Zod 스키마를 인라인 또는 별도 DTO 파일로 작성.

**Step 4: index.ts에서 새 서비스 export**

**Step 5: 빌드 확인 + Commit**

```bash
git add packages/features/payment/
git commit -m "feat(payment): Module + tRPC Router에 Plan/Credit/Pricing 서비스 통합"
```

---

### Task 11: 크레딧 REST API (agent-server 연동용)

**Files:**
- Create: `packages/features/payment/controller/internal/credit-api.controller.ts`
- Modify: `packages/features/payment/controller/index.ts`
- Modify: `packages/features/payment/payment.module.ts` (controller 등록)

**Step 1: credit-api.controller.ts 작성**

```typescript
@UseGuards(JwtAuthGuard)
@Controller('api/internal/credits')
export class CreditApiController {
  constructor(private readonly creditService: CreditService) {}

  @Post('check')
  async checkBalance(@CurrentUser() user: User, @Body() dto: { estimatedCredits: number }) {
    return this.creditService.checkBalance(user.id, dto.estimatedCredits);
  }

  @Post('deduct')
  async deductCredits(@CurrentUser() user: User, @Body() dto: DeductCreditsDto) {
    return this.creditService.deductCredits(user.id, dto.amount, dto.metadata);
  }

  @Post('calculate')
  async calculateCredits(@Body() dto: { modelId: string; promptTokens: number; completionTokens: number }) {
    const credits = await this.creditService.calculateCredits(dto.modelId, dto.promptTokens, dto.completionTokens);
    return { credits };
  }
}
```

**Step 2: controller/index.ts에 export 추가**

**Step 3: Module에 controller 등록**

**Step 4: 빌드 확인 + Commit**

```bash
git add packages/features/payment/
git commit -m "feat(payment): 크레딧 REST API 추가 (agent-server 연동용)"
```

---

## Phase 3: agent-server 연동

### Task 12: agent-server 크레딧 미들웨어

**Files:**
- Create: `apps/agent-server/src/middleware/credit-check.ts`
- Create: `apps/agent-server/src/lib/credit-client.ts`
- Modify: `apps/agent-server/src/routes/chat.ts` (미들웨어 적용)

**Step 1: credit-client.ts — server 크레딧 API 클라이언트**

```typescript
// server의 크레딧 REST API를 호출하는 클라이언트
// JWT를 그대로 전달하여 인증
const ATLAS_SERVER_URL = process.env.ATLAS_SERVER_URL || 'http://localhost:3002';

export async function checkCredits(jwt: string, estimatedCredits: number) { ... }
export async function deductCredits(jwt: string, amount: number, metadata: {...}) { ... }
export async function calculateCredits(jwt: string, modelId: string, promptTokens: number, completionTokens: number) { ... }
```

**Step 2: chat.ts에 크레딧 체크/차감 로직 추가**

AI 호출 전: `checkCredits()` 호출. 잔액 부족 시 에러 응답 + 추가 구매 URL.
AI 호출 후: `result.usage` → `calculateCredits()` → `deductCredits()`.

**Step 3: 빌드 확인 + Commit**

```bash
git add apps/agent-server/src/
git commit -m "feat(agent-server): 크레딧 체크/차감 미들웨어 추가"
```

---

## Phase 4: Admin UI (system-admin)

### Task 13: 플랜 관리 Admin 페이지

**Files:**
- Create: `apps/system-admin/src/features/payment/pages/PlanManagementPage.tsx`
- Create: `apps/system-admin/src/features/payment/hooks/use-plan-management.ts`
- Modify: `apps/system-admin/src/features/payment/routes.tsx` (라우트 추가)
- Modify: `apps/system-admin/src/features/payment/pages/index.ts`

플랜 목록 테이블 + 생성/수정 다이얼로그 + LS 동기화 버튼.

---

### Task 14: 크레딧 관리 Admin 페이지

**Files:**
- Create: `apps/system-admin/src/features/payment/pages/CreditManagementPage.tsx`
- Create: `apps/system-admin/src/features/payment/hooks/use-credit-management.ts`
- Modify: `apps/system-admin/src/features/payment/routes.tsx`

사용자 검색 + 크레딧 잔액 목록 + 수동 조정 다이얼로그.

---

### Task 15: 모델 가격 설정 Admin 페이지

**Files:**
- Create: `apps/system-admin/src/features/payment/pages/ModelPricingPage.tsx`
- Create: `apps/system-admin/src/features/payment/hooks/use-model-pricing.ts`
- Modify: `apps/system-admin/src/features/payment/routes.tsx`

모델별 크레딧 단가 테이블 + 편집 인라인 form.

---

### Task 16: Admin 라우트 + 사이드바 서브메뉴 등록

**Files:**
- Modify: `apps/system-admin/src/features/payment/routes.tsx`
- Modify: `apps/system-admin/src/router.tsx`
- Modify: `apps/system-admin/src/feature-config.ts` (서브메뉴 추가)

```typescript
// feature-config.ts 서브메뉴 추가
{
  id: "payment",
  label: "결제",
  path: PAYMENT_ADMIN_PATH,
  icon: CreditCard,
  order: 25,
  submenus: [
    { id: "payment-overview", label: "대시보드", path: "/admin/payment" },
    { id: "payment-plans", label: "플랜 관리", path: "/admin/payment/plans" },
    { id: "payment-credits", label: "크레딧 관리", path: "/admin/payment/credits" },
    { id: "payment-pricing", label: "모델 가격", path: "/admin/payment/pricing" },
  ],
},
```

---

## Phase 5: 사용자 UI (apps/app)

### Task 17: 구독 페이지에 크레딧 정보 추가

**Files:**
- Modify: `apps/app/src/features/payment/pages/MySubscriptionPage.tsx`
- Create: `apps/app/src/features/payment/hooks/use-credits.ts`
- Create: `apps/app/src/features/payment/components/CreditBalanceCard.tsx`

구독 카드 아래에 크레딧 잔액 프로그레스 바 + 사용률 표시.

---

### Task 18: 크레딧 사용 내역 페이지

**Files:**
- Create: `apps/app/src/features/payment/pages/CreditsPage.tsx`
- Create: `apps/app/src/features/payment/components/TransactionList.tsx`
- Create: `apps/app/src/features/payment/components/CreditPurchaseCard.tsx`
- Modify: `apps/app/src/features/payment/routes.tsx` (라우트 추가)
- Modify: `apps/app/src/router.tsx`

크레딧 잔액, 트랜잭션 내역 테이블, 추가 구매 버튼, 자동 충전 설정 토글.

---

## Phase 6: 검증 + 레퍼런스 업데이트

### Task 19: TypeScript 빌드 전체 검증

Run:
```bash
cd packages/drizzle && pnpm tsc --noEmit
cd packages/features && pnpm tsc --noEmit
cd apps/server && pnpm tsc --noEmit
cd apps/app && pnpm tsc --noEmit
cd apps/system-admin && pnpm tsc --noEmit
cd apps/agent-server && pnpm tsc --noEmit
```

All expected: 0 errors.

### Task 20: DB Migration 생성 + 확인

Run: `cd packages/drizzle && pnpm drizzle-kit generate`

확인: payment_plans, payment_credit_balances, payment_credit_transactions, payment_model_pricing 4개 테이블 + 2개 enum 생성.

### Task 21: docs/reference/ 업데이트

**Files:**
- Modify: `docs/reference/features-backend.md` — payment 서비스 3개 추가 기술
- Modify: `docs/reference/server-registry.md` — tRPC 프로시저 목록 업데이트
- Modify: `docs/reference/features-frontend.md` — 새 페이지/컴포넌트 기술
- Modify: `docs/reference/database-schema.md` — 새 테이블 4개 기술
