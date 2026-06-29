# Multi-Provider Payment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** LemonSqueezy + Polar.sh 멀티 결제사 지원. Admin이 활성 결제사를 선택하여 운영.

**Architecture:** Strategy Pattern — `PaymentProvider` 인터페이스를 LS/Polar가 각각 구현. DB 스키마에서 `lemon_squeezy_id` → `external_id` + `provider` 컬럼 마이그레이션. `PaymentProviderFactory`가 활성 프로바이더 인스턴스 반환.

**Tech Stack:** NestJS, Drizzle ORM, tRPC v11, @polar-sh/sdk, Zod

**Design Doc:** `docs/plans/2026-02-24-multi-provider-payment-design.md`

---

## Task 1: Normalized 타입 정의

**Files:**
- Create: `packages/features/payment/types/normalized.types.ts`
- Modify: `packages/features/payment/types/index.ts`

**Step 1: Create normalized types file**

```typescript
// packages/features/payment/types/normalized.types.ts
// 결제 프로바이더 무관 공통 타입

export type PaymentProviderName = 'lemon-squeezy' | 'polar';

// --- Products ---
export interface NormalizedProduct {
  externalId: string;
  name: string;
  description: string | null;
  status: 'draft' | 'published';
  price: number;
  currency: string;
}

// --- Variants ---
export interface NormalizedVariant {
  externalId: string;
  productExternalId: string;
  name: string;
  price: number;
  isSubscription: boolean;
  interval: string | null;
  intervalCount: number | null;
  hasLicenseKeys: boolean;
  sort: number;
}

// --- PriceModel ---
export interface NormalizedPriceModelTier {
  lastUnit: number | string;
  unitPrice: number;
  fixedFee: number;
}

export interface NormalizedPriceModel {
  id: string;
  scheme: 'standard' | 'package' | 'graduated' | 'volume';
  unitPrice: number;
  renewalIntervalUnit: string | null;
  tiers: NormalizedPriceModelTier[] | null;
}

// --- Checkout ---
export interface NormalizedCheckoutInput {
  storeOrOrgId: string;
  variantOrProductId: string;
  customPrice?: number;
  email?: string;
  name?: string;
  discountCode?: string;
  customData?: Record<string, string>;
  redirectUrl?: string;
  testMode?: boolean;
}

// --- Subscription ---
export type SubscriptionStatus =
  | 'on_trial' | 'active' | 'paused' | 'past_due'
  | 'unpaid' | 'cancelled' | 'expired';

export interface NormalizedSubscription {
  externalId: string;
  productExternalId: string;
  variantExternalId: string;
  customerEmail: string;
  customerName: string | null;
  status: SubscriptionStatus;
  statusFormatted: string;
  price: number;
  currency: string;
  interval: string;
  renewsAt: string;
  endsAt: string | null;
  trialEndsAt: string | null;
  billingAnchor: number | null;
  firstSubscriptionItemId: string | null;
  testMode: boolean;
  urls: {
    updatePaymentMethod?: string;
    customerPortal?: string;
  };
}

// --- Order ---
export interface NormalizedOrder {
  externalId: string;
  orderNumber: number;
  customerEmail: string;
  customerName: string | null;
  status: string;
  statusFormatted: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  currency: string;
  testMode: boolean;
  urls: { receipt?: string };
}

// --- License ---
export interface NormalizedLicenseKey {
  externalId: string;
  key: string;
  status: string;
  statusFormatted: string;
  activationLimit: number | null;
  activationUsage: number;
  expiresAt: string | null;
  testMode: boolean;
}

export interface NormalizedLicenseValidation {
  valid: boolean;
  status: string;
  activationLimit: number | null;
  activationUsage: number;
}

// --- Webhook ---
export type NormalizedWebhookEventType =
  | 'subscription_created' | 'subscription_updated'
  | 'subscription_cancelled' | 'subscription_expired'
  | 'subscription_paused' | 'subscription_resumed'
  | 'order_created' | 'order_refunded'
  | 'license_key_created' | 'license_key_updated';

export interface NormalizedWebhookEvent {
  eventType: NormalizedWebhookEventType;
  externalId: string;
  data: unknown;
  customData?: Record<string, string>;
  testMode: boolean;
}
```

**Step 2: Update types/index.ts**

Add `export * from './normalized.types';` to `packages/features/payment/types/index.ts`.

**Step 3: Commit**

```bash
git add packages/features/payment/types/
git commit -m "feat(payment): add normalized types for multi-provider abstraction"
```

---

## Task 2: PaymentProvider 인터페이스 + Factory

**Files:**
- Create: `packages/features/payment/provider/payment-provider.interface.ts`
- Create: `packages/features/payment/provider/payment-provider.factory.ts`
- Create: `packages/features/payment/provider/index.ts`

**Step 1: Create provider interface**

```typescript
// packages/features/payment/provider/payment-provider.interface.ts
import type {
  PaymentProviderName,
  NormalizedProduct,
  NormalizedVariant,
  NormalizedPriceModel,
  NormalizedCheckoutInput,
  NormalizedSubscription,
  NormalizedOrder,
  NormalizedLicenseKey,
  NormalizedLicenseValidation,
  NormalizedWebhookEvent,
} from '../types/normalized.types';

export interface PaymentProvider {
  readonly providerName: PaymentProviderName;

  // Products
  getProducts(): Promise<NormalizedProduct[]>;
  getProduct(id: string): Promise<NormalizedProduct>;

  // Variants
  getVariants(productId?: string): Promise<NormalizedVariant[]>;
  getVariantPriceModel(variantId: string): Promise<NormalizedPriceModel | null>;

  // Checkout
  createCheckout(data: NormalizedCheckoutInput): Promise<{ checkoutUrl: string }>;

  // Subscriptions
  getSubscription(externalId: string): Promise<NormalizedSubscription>;
  updateSubscription(externalId: string, data: Record<string, unknown>): Promise<NormalizedSubscription>;
  cancelSubscription(externalId: string): Promise<NormalizedSubscription>;

  // License Keys
  validateLicenseKey(key: string): Promise<NormalizedLicenseValidation>;
  activateLicenseKey(key: string, instanceName: string): Promise<NormalizedLicenseKey>;
  deactivateLicenseKey(key: string, instanceId: string): Promise<void>;

  // Webhook
  parseWebhook(payload: unknown): NormalizedWebhookEvent;
  verifyWebhookSignature(rawBody: string, signature: string): boolean;

  // Store/Org
  getStoreId(): string;
  getStoreCurrency(): Promise<string>;

  // Product/Variant creation (provider-specific, optional)
  createProduct?(storeId: string, data: { name: string; description?: string }): Promise<NormalizedProduct>;
  updateVariant?(variantId: string, data: Record<string, unknown>): Promise<NormalizedVariant>;
}
```

**Step 2: Create factory**

```typescript
// packages/features/payment/provider/payment-provider.factory.ts
import { Injectable, Inject } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { paymentConfig } from '../config/payment.config';
import type { PaymentProvider } from './payment-provider.interface';
import type { PaymentProviderName } from '../types/normalized.types';

@Injectable()
export class PaymentProviderFactory {
  private providers = new Map<PaymentProviderName, PaymentProvider>();

  constructor(
    @Inject(paymentConfig.KEY)
    private config: ConfigType<typeof paymentConfig>,
  ) {}

  register(provider: PaymentProvider) {
    this.providers.set(provider.providerName, provider);
  }

  getActive(): PaymentProvider {
    const name = this.config.activeProvider;
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`Payment provider "${name}" is not registered`);
    }
    return provider;
  }

  getByName(name: PaymentProviderName): PaymentProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`Payment provider "${name}" is not registered`);
    }
    return provider;
  }

  getActiveProviderName(): PaymentProviderName {
    return this.config.activeProvider;
  }
}
```

**Step 3: Create index.ts**

```typescript
// packages/features/payment/provider/index.ts
export * from './payment-provider.interface';
export * from './payment-provider.factory';
```

**Step 4: Commit**

```bash
git add packages/features/payment/provider/
git commit -m "feat(payment): add PaymentProvider interface and factory"
```

---

## Task 3: Config 확장 (Polar 환경변수)

**Files:**
- Modify: `packages/features/payment/config/payment.config.ts`

**Step 1: Update config to support both providers**

`payment.config.ts`에서:
- `activeProvider` 필드 추가 (`PAYMENT_PROVIDER` env, default `'lemon-squeezy'`)
- Polar 관련 환경변수 3개 추가 (`PAYMENT_POLAR_ACCESS_TOKEN`, `PAYMENT_POLAR_ORG_ID`, `PAYMENT_POLAR_WEBHOOK_SECRET`)
- Validation: 활성 프로바이더의 키만 필수 검증, 비활성은 빈 문자열 허용

**Step 2: Commit**

```bash
git add packages/features/payment/config/
git commit -m "feat(payment): extend config for multi-provider support"
```

---

## Task 4: LemonSqueezy Provider 리팩토링

**Files:**
- Create: `packages/features/payment/provider/lemon-squeezy.provider.ts`
- Modify: `packages/features/payment/service/lemon-squeezy.service.ts` (keep as low-level API client)

**Step 1: Create LS provider adapter**

기존 `LemonSqueezyService`는 low-level API 클라이언트로 유지.
새 `LemonSqueezyProvider`가 `PaymentProvider` 인터페이스를 구현하고, 내부적으로 `LemonSqueezyService`를 사용하여 응답을 Normalized 타입으로 변환.

핵심 변환 로직:
- `getProducts()`: LS 응답 → `NormalizedProduct[]` (price를 cents에서 실제 금액으로 변환)
- `createCheckout()`: `NormalizedCheckoutInput` → LS `CreateCheckoutData`
- `parseWebhook()`: LS webhook payload → `NormalizedWebhookEvent` (이벤트명 매핑)
- `verifyWebhookSignature()`: 기존 HMAC SHA256 검증 로직 이동

**Step 2: Commit**

```bash
git add packages/features/payment/provider/lemon-squeezy.provider.ts
git commit -m "feat(payment): add LemonSqueezy provider adapter"
```

---

## Task 5: Polar Provider 구현

**Files:**
- Create: `packages/features/payment/provider/polar.provider.ts`
- Create: `packages/features/payment/types/polar.types.ts`

**Step 1: Install @polar-sh/sdk**

```bash
cd packages/features && pnpm add @polar-sh/sdk
```

**Step 2: Create Polar types (SDK 보완용)**

Polar SDK 타입에서 부족한 webhook 이벤트 매핑 등 보조 타입 정의.

**Step 3: Create Polar provider**

`PolarProvider`가 `PaymentProvider` 인터페이스 구현:
- `@polar-sh/sdk`의 `Polar` 클라이언트 사용
- Products → `client.products.list()` / `client.products.get()`
- Checkout → `client.checkouts.create()`
- Subscriptions → `client.subscriptions.get()` / `.update()` / `.cancel()`
- License Keys → `client.licenseKeys.validate()` / `.activate()` / `.deactivate()`
- Webhook → Polar webhook signature 검증 + 이벤트명 매핑

Polar 이벤트 → Normalized 이벤트 매핑:

| Polar Event | Normalized Event |
|---|---|
| `subscription.created` | `subscription_created` |
| `subscription.active` | `subscription_updated` |
| `subscription.updated` | `subscription_updated` |
| `subscription.canceled` | `subscription_cancelled` |
| `subscription.revoked` | `subscription_expired` |
| `order.created` | `order_created` |
| `order.refunded` | `order_refunded` |

**Step 4: Commit**

```bash
git add packages/features/payment/provider/polar.provider.ts packages/features/payment/types/polar.types.ts
git commit -m "feat(payment): add Polar provider implementation"
```

---

## Task 6: DB 스키마 마이그레이션

**Files:**
- Modify: `packages/drizzle/src/schema/features/payment/index.ts`
- Modify: `packages/drizzle/src/schema/features/payment/plans.ts`

**Step 1: Update schema — rename columns + add provider**

모든 테이블에서:
1. `lemonSqueezyId` → `externalId` (컬럼명 `external_id`)
2. `provider` 컬럼 추가 (text, default `'lemon-squeezy'`)
3. unique constraint: `(external_id)` → `(external_id, provider)` 복합 유니크

`paymentPlans`에서:
1. `lemonSqueezyProductId` → `providerProductId` (컬럼명 `provider_product_id`)
2. `lemonSqueezyVariantId` → `providerVariantId` (컬럼명 `provider_variant_id`)
3. `provider` 컬럼 추가

**Step 2: Generate migration**

```bash
cd packages/drizzle && pnpm drizzle-kit generate
```

마이그레이션 SQL을 확인하여 데이터 보존 확인:
- `ALTER TABLE ... RENAME COLUMN lemon_squeezy_id TO external_id`
- `ALTER TABLE ... ADD COLUMN provider text NOT NULL DEFAULT 'lemon-squeezy'`
- 기존 unique index 삭제 → 복합 unique index 생성

**Step 3: Commit**

```bash
git add packages/drizzle/
git commit -m "feat(payment): migrate schema for multi-provider support"
```

---

## Task 7: Service 레이어 리팩토링

**Files:**
- Modify: `packages/features/payment/service/payment.service.ts`
- Modify: `packages/features/payment/service/webhook.service.ts`
- Modify: `packages/features/payment/service/plan.service.ts`

**Step 1: Refactor PaymentService**

변경 사항:
- `LemonSqueezyService` 직접 의존 → `PaymentProviderFactory` 의존
- `this.lemonSqueezyService.xxx()` → `this.providerFactory.getActive().xxx()`
- `syncProducts()`: provider에서 normalized products 받아서 DB 저장 (`externalId`, `provider`)
- `createCheckout()`: `NormalizedCheckoutInput` 구성 → provider에 전달
- `validateLicense()`: provider를 통해 검증

스키마 참조 변경:
- `products.lemonSqueezyId` → `products.externalId`
- `subscriptions.lemonSqueezyId` → `subscriptions.externalId`
- `orders.lemonSqueezyId` → `orders.externalId`
- `licenses.lemonSqueezyId` → `licenses.externalId`

**Step 2: Refactor WebhookService**

변경 사항:
- `handleWebhook(payload: WebhookPayload)` → `handleWebhook(event: NormalizedWebhookEvent, provider: PaymentProviderName)`
- LS-specific 타입 캐스팅 제거 → normalized 타입 사용
- DB insert 시 `externalId` + `provider` 사용
- `subscriptions.lemonSqueezyId` → `subscriptions.externalId`

**Step 3: Refactor PlanService**

변경 사항:
- `syncPlansFromLS(lsService)` → `syncPlansFromProvider(provider: PaymentProvider)`
- `pushPlansToLS(lsService)` → `pushPlansToProvider(provider: PaymentProvider)`
- `paymentPlans.lemonSqueezyVariantId` → `paymentPlans.providerVariantId`
- `paymentPlans.lemonSqueezyProductId` → `paymentPlans.providerProductId`
- `LOCAL_ONLY_SLUGS` 로직 유지 (free, enterprise는 프로바이더 무관)

**Step 4: Commit**

```bash
git add packages/features/payment/service/
git commit -m "refactor(payment): services use provider abstraction"
```

---

## Task 8: Controller 리팩토링 + Polar Webhook 추가

**Files:**
- Modify: `packages/features/payment/controller/public/webhook.controller.ts`
- Create: `packages/features/payment/controller/public/webhook-polar.controller.ts`
- Modify: `packages/features/payment/controller/auth/subscription.controller.ts`
- Modify: `packages/features/payment/controller/admin/payment-admin.controller.ts`
- Modify: `packages/features/payment/controller/index.ts`

**Step 1: Refactor existing webhook controller**

`WebhookController`:
- Inject `PaymentProviderFactory`
- `verifyWebhookSignature` → LS provider의 `verifyWebhookSignature()` 사용
- `handleLemonSqueezyWebhook()`: LS provider로 `parseWebhook()` → `WebhookService.handleWebhook(normalized)`

**Step 2: Create Polar webhook controller**

`WebhookPolarController`:
- `@Controller('webhook')` + `@Post('polar')` → endpoint: `/api/webhook/polar`
- Inject `PaymentProviderFactory`, `WebhookService`
- Polar provider로 signature 검증 + parseWebhook + handleWebhook

**Step 3: Refactor subscription controller**

`SubscriptionController`:
- `LemonSqueezyService` 직접 참조 제거 → `PaymentProviderFactory` 사용
- `subscription.lemonSqueezyId` → `subscription.externalId`
- `targetPlan.lemonSqueezyVariantId` → `targetPlan.providerVariantId`

**Step 4: Refactor admin controller**

`PaymentAdminController`:
- `LemonSqueezyService` 직접 참조 제거 → `PaymentProviderFactory` 사용
- `syncPlans()`: `planService.syncPlansFromProvider(factory.getActive())`
- `pushPlansToLS()` → `pushPlansToProvider(factory.getActive())`
- Swagger descriptions 업데이트 (LS 전용 문구 → 일반화)

**Step 5: Update controller/index.ts**

`WebhookPolarController` export 추가.

**Step 6: Commit**

```bash
git add packages/features/payment/controller/
git commit -m "refactor(payment): controllers use provider abstraction, add Polar webhook"
```

---

## Task 9: tRPC Router 리팩토링

**Files:**
- Modify: `packages/features/payment/payment.router.ts`

**Step 1: Update router**

변경 사항:
- service container에서 `lemonSqueezyService` 제거 → `providerFactory` 추가
- `updateSubscription`: `subscription.lemonSqueezyId` → `subscription.externalId`
- `cancelSubscription`: 동일 변경
- `changePlan`: `targetPlan.lemonSqueezyVariantId` → `targetPlan.providerVariantId`, provider factory 사용
- `admin.syncPlans`: `planService.syncPlansFromProvider(providerFactory.getActive())`
- `admin.pushPlansToLS` → `admin.pushPlansToProvider`: 라우터 키 이름도 변경
- `admin.createPlan/updatePlan`: input schema에서 `lemonSqueezyProductId/VariantId` → `providerProductId/VariantId`

**Step 2: Commit**

```bash
git add packages/features/payment/payment.router.ts
git commit -m "refactor(payment): tRPC router uses provider abstraction"
```

---

## Task 10: Module 업데이트

**Files:**
- Modify: `packages/features/payment/payment.module.ts`
- Modify: `packages/features/payment/index.ts`

**Step 1: Update PaymentModule**

변경 사항:
- `PaymentProviderFactory` provider 추가
- `LemonSqueezyProvider`, `PolarProvider` provider 추가
- `onModuleInit()`:
  1. Factory에 LS provider, Polar provider 등록
  2. `injectPaymentServices()`에 `providerFactory` 추가
  3. 기존 plan seed 로직 유지

**Step 2: Update index.ts exports**

- `export * from './provider';` 추가
- `export * from './types/normalized.types';` 확인

**Step 3: Commit**

```bash
git add packages/features/payment/payment.module.ts packages/features/payment/index.ts
git commit -m "refactor(payment): module registers providers, updated exports"
```

---

## Task 11: 프론트엔드 스키마 리네이밍 반영

**Files:**
- Modify: `apps/app/src/features/payment/components/SubscriptionCard.tsx` (line 60: `lemonSqueezyId` → `externalId`)
- Modify: `apps/system-admin/src/features/payment/components/SubscriptionCard.tsx` (동일 변경)
- Modify: `apps/system-admin/src/features/payment/hooks/use-plan-management.ts` (LS field names)
- Modify: `apps/system-admin/src/features/payment/pages/PlanManagementPage.tsx` (LS field names)

**Step 1: Update SubscriptionCard (app)**

`subscription.lemonSqueezyId` → `subscription.externalId` (취소 버튼 onClick)

**Step 2: Update SubscriptionCard (system-admin)**

동일 변경.

**Step 3: Update plan management hooks/pages (system-admin)**

`lemonSqueezyProductId` → `providerProductId`
`lemonSqueezyVariantId` → `providerVariantId`

**Step 4: Commit**

```bash
git add apps/app/src/features/payment/ apps/system-admin/src/features/payment/
git commit -m "refactor(payment): frontend adapts to schema renaming"
```

---

## Task 12: TypeScript 빌드 검증

**Step 1: Run type checks**

```bash
cd packages/drizzle && pnpm tsc --noEmit
cd packages/features && pnpm tsc --noEmit
cd apps/server && pnpm tsc --noEmit
cd apps/app && pnpm tsc --noEmit
cd apps/system-admin && pnpm tsc --noEmit
```

**Step 2: Fix any type errors**

각 패키지에서 발생하는 타입 에러를 순차적으로 수정.
주로 `lemonSqueezyId` → `externalId` 참조 누락이 예상됨.

**Step 3: Commit fixes**

```bash
git add -A && git commit -m "fix(payment): resolve type errors from schema migration"
```

---

## Task 13: Reference 문서 업데이트

**Files:**
- Modify: `docs/reference/features-backend.md` — payment 섹션에 multi-provider 아키텍처 반영
- Modify: `docs/reference/database-schema.md` — `external_id`, `provider` 컬럼 반영

**Step 1: Update backend reference**

Payment Feature 섹션에 추가:
- Provider 인터페이스 설명
- Factory 패턴 설명
- Polar webhook endpoint 추가

**Step 2: Update database schema reference**

`lemon_squeezy_id` → `external_id` + `provider` 반영.

**Step 3: Commit**

```bash
git add docs/reference/
git commit -m "docs(payment): update references for multi-provider architecture"
```

---

## Task 순서 및 의존성

```
Task 1 (Normalized 타입) ──┐
Task 2 (Interface/Factory) ─┤
Task 3 (Config 확장) ───────┤
                            ├──→ Task 4 (LS Provider)
                            ├──→ Task 5 (Polar Provider)
                            └──→ Task 6 (DB 마이그레이션)
                                       │
                            ┌──────────┘
                            v
Task 7 (Service 리팩토링) ──→ Task 8 (Controller 리팩토링)
                            ──→ Task 9 (tRPC Router 리팩토링)
                            ──→ Task 10 (Module 업데이트)
                            ──→ Task 11 (프론트엔드 반영)
                                       │
                            ┌──────────┘
                            v
Task 12 (빌드 검증) ──→ Task 13 (문서 업데이트)
```

Tasks 1-3은 독립적으로 병렬 가능.
Tasks 4-6은 1-3 완료 후 병렬 가능.
Tasks 7-11은 4-6 완료 후 순차 진행.
Tasks 12-13은 최종 검증.
