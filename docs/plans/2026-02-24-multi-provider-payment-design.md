# Multi-Provider Payment Design

> 날짜: 2026-02-24
> 상태: 승인됨

## 목표

현재 LemonSqueezy 단일 결제사 → LemonSqueezy + Polar.sh 멀티 결제사 지원.
Admin이 시스템 전체의 활성 결제사를 1개 선택하여 운영.

## 현재 상태

- LemonSqueezy 전용 아키텍처
- DB 스키마에 `lemon_squeezy_id` 하드코딩 (5개 테이블)
- `paymentPlans`에 `lemonSqueezyProductId`, `lemonSqueezyVariantId`
- `LemonSqueezyService` → `PaymentService`, `PlanService`, `WebhookService` 직접 의존

## 아키텍처: Strategy Pattern

```
╔═══════════════════════╗
║  PaymentProvider       ║  ← Interface
║  (abstract)            ║
╠═══════════════════════╣
║ getProducts()          ║
║ createCheckout()       ║
║ getSubscription()      ║
║ cancelSubscription()   ║
║ validateLicenseKey()   ║
║ parseWebhook()         ║
╚═══════════════════════╝
       ┌───────┴───────┐
╔═══════════╗   ╔══════════╗
║LS Provider║   ║Polar     ║
║(기존 코드)║   ║Provider  ║
╚═══════════╝   ╚══════════╝
```

- `PaymentProviderFactory`: 활성 프로바이더 인스턴스 반환
- `PaymentService`, `PlanService`: Provider 인터페이스만 사용
- `WebhookService`: Normalized 이벤트만 처리

## DB 스키마 변경

### 컬럼 리네이밍

| 현재 컬럼 | 변경 후 | 테이블 |
|-----------|---------|--------|
| `lemon_squeezy_id` | `external_id` | products, orders, subscriptions, licenses, webhook_events |
| `lemon_squeezy_product_id` | `provider_product_id` | payment_plans |
| `lemon_squeezy_variant_id` | `provider_variant_id` | payment_plans |

### 새 컬럼

| 컬럼 | 타입 | 기본값 | 테이블 |
|------|------|--------|--------|
| `provider` | `text` | `'lemon-squeezy'` | products, orders, subscriptions, licenses, webhook_events, payment_plans |

### Unique 제약 변경

- 기존: `UNIQUE(lemon_squeezy_id)`
- 변경: `UNIQUE(external_id, provider)` 복합 유니크

### 마이그레이션 전략

1. 새 컬럼 추가 (`external_id`, `provider`)
2. 데이터 복사 (`lemon_squeezy_id` → `external_id`, `provider` = `'lemon-squeezy'`)
3. 기존 컬럼 삭제 (`lemon_squeezy_id`)
4. 유니크 제약 재설정

## PaymentProvider 인터페이스

```typescript
type ProviderName = 'lemon-squeezy' | 'polar';

interface PaymentProvider {
  readonly providerName: ProviderName;

  // Products
  getProducts(): Promise<NormalizedProduct[]>;
  getProduct(id: string): Promise<NormalizedProduct>;

  // Variants (Plans sync)
  getVariants(productId?: string): Promise<NormalizedVariant[]>;
  getVariantPriceModel(variantId: string): Promise<NormalizedPriceModel | null>;

  // Checkout
  createCheckout(data: NormalizedCheckoutInput): Promise<{ checkoutUrl: string }>;

  // Subscriptions
  getSubscription(externalId: string): Promise<NormalizedSubscription>;
  updateSubscription(externalId: string, data: UpdateSubscriptionData): Promise<NormalizedSubscription>;
  cancelSubscription(externalId: string): Promise<NormalizedSubscription>;

  // License Keys
  validateLicenseKey(key: string): Promise<NormalizedLicenseValidation>;
  activateLicenseKey(key: string, instanceName: string): Promise<NormalizedLicenseActivation>;
  deactivateLicenseKey(key: string, instanceId: string): Promise<void>;

  // Webhook
  parseWebhook(payload: unknown, signature?: string): NormalizedWebhookEvent;
  verifyWebhookSignature(rawBody: string, signature: string): boolean;

  // Store/Org
  getStoreId(): string;
  getStoreCurrency(): Promise<string>;
}
```

## Normalized 타입 (프로바이더 무관)

```typescript
interface NormalizedProduct {
  externalId: string;
  name: string;
  description: string | null;
  status: 'draft' | 'published';
  price: number; // 실제 금액 (cents 아님)
  currency: string;
}

interface NormalizedVariant {
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

interface NormalizedSubscription {
  externalId: string;
  customerEmail: string;
  customerName: string | null;
  productExternalId: string;
  variantExternalId: string;
  status: SubscriptionStatus;
  statusFormatted: string;
  renewsAt: string;
  endsAt: string | null;
  trialEndsAt: string | null;
  billingAnchor: number | null;
  testMode: boolean;
  urls: {
    updatePaymentMethod?: string;
    customerPortal?: string;
  };
}

type NormalizedWebhookEventType =
  | 'subscription_created'
  | 'subscription_updated'
  | 'subscription_cancelled'
  | 'subscription_expired'
  | 'subscription_paused'
  | 'subscription_resumed'
  | 'order_created'
  | 'order_refunded'
  | 'license_key_created'
  | 'license_key_updated';

interface NormalizedWebhookEvent {
  eventType: NormalizedWebhookEventType;
  externalId: string;
  data: unknown;
  customData?: Record<string, string>;
  testMode: boolean;
}
```

## Config 확장

```typescript
// payment.config.ts
{
  activeProvider: 'lemon-squeezy' | 'polar',   // PAYMENT_PROVIDER

  // LemonSqueezy
  lemonSqueezyApiKey: string,                   // PAYMENT_LEMON_SQUEEZY_API_KEY
  lemonSqueezyStoreId: string,                  // PAYMENT_LEMON_SQUEEZY_STORE_ID
  lemonSqueezyWebhookSecret: string,            // PAYMENT_LEMON_SQUEEZY_WEBHOOK_SECRET

  // Polar
  polarAccessToken: string,                     // PAYMENT_POLAR_ACCESS_TOKEN
  polarOrganizationId: string,                  // PAYMENT_POLAR_ORG_ID
  polarWebhookSecret: string,                   // PAYMENT_POLAR_WEBHOOK_SECRET
}
```

- 비활성 프로바이더의 키는 빈 문자열 허용 (활성 프로바이더 키만 필수)

## 파일 구조 변경

```
packages/features/payment/
├── provider/                              # 신규 디렉토리
│   ├── payment-provider.interface.ts      # 인터페이스 + Normalized 타입
│   ├── payment-provider.factory.ts        # Factory (NestJS Injectable)
│   ├── lemon-squeezy.provider.ts          # 기존 LS 서비스 리팩토링
│   └── polar.provider.ts                  # Polar 구현 (@polar-sh/sdk 사용)
├── types/
│   ├── normalized.types.ts                # 프로바이더 무관 공통 타입 (신규)
│   ├── lemon-squeezy.types.ts             # LS 전용 (기존 유지)
│   └── polar.types.ts                     # Polar 전용 (신규)
├── service/
│   ├── payment.service.ts                 # LemonSqueezyService → Provider 사용
│   ├── webhook.service.ts                 # NormalizedWebhookEvent 처리
│   ├── plan.service.ts                    # providerProductId/VariantId
│   ├── credit.service.ts                  # 변경 없음
│   └── model-pricing.service.ts           # 변경 없음
├── controller/
│   └── public/
│       ├── webhook.controller.ts          # /webhooks/lemon-squeezy
│       └── webhook-polar.controller.ts    # /webhooks/polar (신규)
├── config/
│   └── payment.config.ts                  # Polar config 추가
├── dto/                                   # 변경 최소 (provider 필드 추가 정도)
└── payment.module.ts                      # Factory provider 등록
```

## Webhook 엔드포인트

- `POST /api/webhooks/lemon-squeezy` — LS 전용, signature 검증
- `POST /api/webhooks/polar` — Polar 전용, signature 검증
- 각 controller가 해당 provider를 사용하여 `parseWebhook()` 호출
- `WebhookService.handleWebhook(normalizedEvent)` — 프로바이더 무관 처리

## 프론트엔드 변경

### 최소 변경 (백엔드 추상화로 대부분 해결)

| 파일 | 변경 | 이유 |
|------|------|------|
| `SubscriptionCard.tsx` | `lemonSqueezyId` → `externalId` | 스키마 리네이밍 |
| `use-subscription.ts` | 변경 없음 | tRPC 인터페이스 동일 |
| `use-checkout.ts` | 변경 없음 | checkout URL 패턴 동일 |
| `MySubscriptionPage.tsx` | 변경 없음 | 컴포넌트가 추상화된 데이터 사용 |
| `ProductCard.tsx` | 변경 없음 | tRPC 데이터 사용 |

### 사용자 결제 방법 관리

두 프로바이더 모두 "외부 Customer Portal URL" 패턴:
- LS: `urls.customer_portal`
- Polar: Customer Portal URL (세션 기반)

→ DB `urls` jsonb 필드에 `customerPortal` 키로 통일 저장.
→ 프론트엔드에서 `urls.customer_portal` → `urls.customerPortal`로만 변경.

## Admin UI 변경

### system-admin 결제 관리 페이지

- "활성 결제사" 표시 (읽기 전용 — env 설정이므로)
- 플랜 동기화 버튼: 활성 프로바이더 기준으로 동기화
- `AdminPaymentPage`: provider 정보 표시 추가

## 의존성 추가

```
@polar-sh/sdk  # Polar.sh 공식 TypeScript SDK
```

## 변경하지 않는 것

- `CreditService` — 프로바이더 무관 (DB only)
- `ModelPricingService` — 프로바이더 무관
- Credit/ModelPricing 관련 프론트엔드 — 변경 없음
- tRPC Router 인터페이스 — 대부분 동일 (내부 구현만 변경)

## 리스크

1. **DB 마이그레이션**: 프로덕션 데이터가 있는 경우 주의 필요
2. **Polar SDK 안정성**: 비교적 새로운 서비스이므로 API 변경 가능성
3. **웹훅 이벤트 매핑**: LS/Polar 이벤트명이 다르므로 정확한 매핑 필요

## Sources

- [Polar API Reference](https://polar.sh/docs/api-reference/introduction)
- [Polar API Documentation](https://polar.apidocumentation.com/)
- [@polar-sh/sdk (npm)](https://www.npmjs.com/package/@polar-sh/sdk)
