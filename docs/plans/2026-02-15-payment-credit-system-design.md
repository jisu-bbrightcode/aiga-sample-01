# Payment & AI Credit System Design

> 작성일: 2026-02-15
> 상태: 승인됨

## 개요

LemonSqueezy 기반 SaaS 결제 시스템을 확장하여 플랜 관리, AI 토큰 크레딧 시스템, 환불 관리를 구축한다.

## 현재 상태

### 기존 구현 (payment feature)
- **Backend**: PaymentService, LemonSqueezyService, WebhookService, tRPC Router, REST Controllers
- **Schema**: payment_products, payment_orders, payment_subscriptions, payment_licenses, payment_webhook_events
- **Frontend**: apps/app + apps/system-admin 양쪽에 페이지/컴포넌트/훅 구현됨
- **등록**: app.module, app-router, trpc/router, 양쪽 router.tsx 모두 등록됨

### 수정 필요 사항 (기존 코드 버그)
1. **CRITICAL**: `webhook.service.ts` - userId 하드코딩 placeholder → custom_data에서 추출
2. **HIGH**: Controller `as any` 캐스팅 3곳 → 타입 안전하게 수정
3. **MEDIUM**: Swagger 데코레이터 누락 → 추가
4. **MEDIUM**: `feature-config.ts`에 payment 메뉴 미등록 → 추가

## 요구사항 정리

| 항목 | 내용 |
|------|------|
| 플랜 | Free / Pro / Team / Enterprise (LS Product/Variant 동기화) |
| 플랜 차이 | 월간 크레딧 한도만 (기능 잠금 없음) |
| 크레딧 단위 | 통합 크레딧 (모델별 환산비율: Claude 1토큰=2크레딧, GPT 1토큰=1크레딧 등) |
| 소진 정책 | 기본 차단 + 추가 구매 유도, 옵션으로 자동 충전 (사용자 설정 플래그) |
| AI 연동 | agent-server (이미 메시지별 토큰 추적 중) |
| 환불 | LS 대시보드 처리 + webhook 수신 (기존 구조 확장) |

## 아키텍처

### 접근 방식: Payment Feature 확장 (A안)

기존 payment feature에 플랜/크레딧 테이블과 서비스를 추가한다.
agent-server는 크레딧 소비자로만 동작하며, server의 크레딧 API를 호출한다.

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│   apps/app      │     │  server         │     │  agent-server   │
│   (유저 UI)     │────→│  payment feature      │←────│  (AI 실행)      │
│                 │     │  ├ plan.service       │     │                 │
│ - 플랜 선택     │     │  ├ credit.service     │     │ AI 호출 전:     │
│ - 크레딧 현황   │     │  ├ model-pricing.svc  │     │   잔액 확인 API │
│ - 추가 구매     │     │  └ (기존 서비스들)    │     │ AI 호출 후:     │
│                 │     │                      │     │   차감 요청 API │
├─────────────────┤     └──────────────────────┘     └─────────────────┘
│ system-admin    │              │
│ (관리자 UI)     │              │
│                 │     ┌────────┴─────────┐
│ - 플랜 관리     │     │  LemonSqueezy    │
│ - 크레딧 관리   │     │  (결제 처리)     │
│ - 모델 가격     │     │  Webhook → DB    │
│ - 환불 관리     │     └──────────────────┘
└─────────────────┘
```

## 스키마 설계

### 신규 테이블 (4개)

#### `payment_plans` - 플랜 정의

```typescript
export const paymentPlanTierEnum = pgEnum("payment_plan_tier", [
  "free", "pro", "team", "enterprise"
]);

export const paymentPlans = pgTable("payment_plans", {
  ...baseColumns(),

  // 플랜 기본 정보
  name: text("name").notNull(),                    // "Free", "Pro", "Team", "Enterprise"
  slug: text("slug").notNull().unique(),           // "free", "pro", "team", "enterprise"
  description: text("description"),
  tier: paymentPlanTierEnum("tier").notNull(),

  // 크레딧 한도
  monthlyCredits: integer("monthly_credits").notNull(),  // 월간 크레딧 배정량

  // 가격 (LS 동기화)
  price: integer("price").notNull().default(0),    // cents (0 = 무료)
  currency: text("currency").notNull().default("USD"),
  interval: text("interval").default("month"),     // month, year

  // LemonSqueezy 매핑
  lemonSqueezyProductId: text("lemon_squeezy_product_id"),
  lemonSqueezyVariantId: text("lemon_squeezy_variant_id"),

  // 메타
  features: jsonb("features"),                     // 표시용 기능 목록 (UI에서 비교표에 사용)
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});
```

#### `payment_credit_balances` - 사용자별 크레딧 잔액

```typescript
export const paymentCreditBalances = pgTable("payment_credit_balances", {
  ...baseColumns(),

  userId: uuid("user_id").notNull().unique()
    .references(() => profiles.id, { onDelete: "cascade" }),
  planId: uuid("plan_id")
    .references(() => paymentPlans.id),

  // 잔액
  balance: integer("balance").notNull().default(0),           // 현재 크레딧 잔액
  monthlyAllocation: integer("monthly_allocation").notNull().default(0), // 월 배정량

  // 자동 충전 설정
  autoRecharge: boolean("auto_recharge").notNull().default(false),
  autoRechargeAmount: integer("auto_recharge_amount"),        // 자동 충전 크레딧량
  autoRechargeThreshold: integer("auto_recharge_threshold"),  // 이 잔액 이하일 때 충전

  // 기간
  currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  lastRechargedAt: timestamp("last_recharged_at", { withTimezone: true }),
});
```

#### `payment_credit_transactions` - 크레딧 트랜잭션 로그

```typescript
export const paymentCreditTransactionTypeEnum = pgEnum("payment_credit_transaction_type", [
  "allocation",   // 월간 배정
  "deduction",    // AI 사용 차감
  "purchase",     // 추가 구매
  "refund",       // 환불
  "adjustment",   // 관리자 수동 조정
  "expiration",   // 기간 만료
]);

export const paymentCreditTransactions = pgTable("payment_credit_transactions", {
  ...baseColumns(),

  userId: uuid("user_id").notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  type: paymentCreditTransactionTypeEnum("type").notNull(),

  // 금액
  amount: integer("amount").notNull(),              // +는 충전, -는 차감
  balanceBefore: integer("balance_before").notNull(),
  balanceAfter: integer("balance_after").notNull(),

  // 설명
  description: text("description"),
  metadata: jsonb("metadata"),  // { modelId, provider, promptTokens, completionTokens, messageId, threadId }

  // 관련 주문 (구매 시)
  relatedOrderId: uuid("related_order_id")
    .references(() => orders.id),
});
```

#### `payment_model_pricing` - AI 모델별 크레딧 환산비율

```typescript
export const paymentModelPricing = pgTable("payment_model_pricing", {
  ...baseColumns(),

  modelId: text("model_id").notNull().unique(),      // "claude-sonnet-4-5", "gpt-4o-mini"
  provider: text("provider").notNull(),               // "anthropic", "openai", "google"
  displayName: text("display_name").notNull(),        // "Claude Sonnet 4.5"

  // 크레딧 환산 (1000 토큰당 크레딧)
  inputCreditsPerKToken: integer("input_credits_per_k_token").notNull(),   // input 1K 토큰당 크레딧
  outputCreditsPerKToken: integer("output_credits_per_k_token").notNull(), // output 1K 토큰당 크레딧

  isActive: boolean("is_active").notNull().default(true),
});
```

## 서비스 설계

### 신규 서비스

#### `plan.service.ts`
- `getPlans()` - 활성 플랜 목록
- `getPlanById(id)` - 플랜 상세
- `createPlan(input)` - 플랜 생성 (Admin)
- `updatePlan(id, input)` - 플랜 수정 (Admin)
- `syncPlansFromLS()` - LemonSqueezy Product/Variant → plans 테이블 동기화
- `assignPlanToUser(userId, planId)` - 사용자에게 플랜 할당

#### `credit.service.ts`
- `getBalance(userId)` - 크레딧 잔액 조회
- `checkBalance(userId, estimatedCredits)` - 잔액 충분 여부 확인 (agent-server용)
- `deductCredits(userId, amount, metadata)` - 크레딧 차감 (agent-server용)
- `addCredits(userId, amount, type, description)` - 크레딧 추가 (구매/배정/환불)
- `allocateMonthlyCredits()` - 월간 크레딧 배정 (스케줄러)
- `getTransactions(userId, pagination)` - 트랜잭션 내역
- `adjustBalance(userId, amount, reason)` - 관리자 수동 조정
- `purchaseCredits(userId, amount)` - 추가 크레딧 구매 (LS checkout 생성)
- `processAutoRecharge(userId)` - 자동 충전 처리

#### `model-pricing.service.ts`
- `getPricingList()` - 모델 가격 목록
- `calculateCredits(modelId, promptTokens, completionTokens)` - 토큰→크레딧 환산
- `upsertPricing(input)` - 모델 가격 설정 (Admin)

### 기존 서비스 수정

#### `webhook.service.ts` (버그 수정)
- userId를 `custom_data.user_id`에서 추출하도록 수정
- 구독 생성 시 → credit_balances에 플랜 크레딧 배정

#### `payment.service.ts` (확장)
- 환불 처리 시 → credit_transactions에 환불 크레딧 기록

## tRPC Router 확장

```typescript
export const paymentRouter = createTRPCRouter({
  // === 기존 유지 ===
  getActiveProducts, createCheckout, getMySubscription, ...

  // === 플랜 (Public) ===
  getPlans: publicProcedure,

  // === 크레딧 (Protected) ===
  getMyBalance: protectedProcedure,
  getMyTransactions: protectedProcedure,
  purchaseCredits: protectedProcedure,
  updateAutoRecharge: protectedProcedure,

  // === 크레딧 체크 (Internal - agent-server용) ===
  checkBalance: protectedProcedure,
  deductCredits: protectedProcedure,

  // === Admin ===
  admin: createTRPCRouter({
    // 기존 유지: syncProducts, getSubscriptions, ...

    // 플랜 관리
    getPlans: adminProcedure,
    createPlan: adminProcedure,
    updatePlan: adminProcedure,

    // 크레딧 관리
    getUserCredits: adminProcedure,
    adjustUserCredits: adminProcedure,
    getCreditStats: adminProcedure,

    // 모델 가격
    getModelPricing: adminProcedure,
    upsertModelPricing: adminProcedure,
  }),
});
```

## REST API (agent-server 연동용)

agent-server는 tRPC 클라이언트가 아니므로 REST endpoint 추가:

```
POST /api/payment/credits/check    ← 잔액 확인 (AI 호출 전)
POST /api/payment/credits/deduct   ← 크레딧 차감 (AI 호출 후)
```

Internal API이므로 서버 간 JWT 또는 API Key 인증 사용.

## agent-server 미들웨어

```typescript
// apps/agent-server/src/middleware/credit-check.ts
// AI 호출 전: server credit check API 호출
// 잔액 부족 시: 에러 응답 + 추가 구매 URL 반환

// apps/agent-server/src/lib/credit-deduct.ts
// AI 호출 후: token usage → credit 환산 → server deduct API 호출
```

## Admin UI (system-admin)

### 라우트 구조
```
/admin/payment              ← 기존 대시보드 (구독/주문/환불 통계 확장)
/admin/payment/plans        ← 플랜 목록 + CRUD + LS 동기화 버튼
/admin/payment/credits      ← 사용자별 크레딧 조회 + 수동 조정
/admin/payment/pricing      ← AI 모델별 크레딧 단가 설정
```

### 플랜 관리 화면
- 플랜 목록 (Free/Pro/Team/Enterprise)
- LS Product/Variant 연결 상태 표시
- 월간 크레딧, 가격, 간격 편집
- LS 동기화 버튼 (LS → DB)

### 크레딧 관리 화면
- 사용자 검색 + 크레딧 잔액 목록
- 사용자 상세: 잔액, 트랜잭션 내역, 자동 충전 설정
- 관리자 수동 크레딧 조정 (사유 입력 필수)

### 모델 가격 설정 화면
- 모델별 input/output 크레딧 단가 테이블
- 모델 추가/수정/비활성화

## 사용자 UI (apps/app)

### 라우트 구조
```
/payment/products           ← 기존 (플랜 비교표로 개선)
/payment/subscription       ← 기존 (크레딧 잔액 + 사용량 표시 추가)
/payment/credits            ← 신규: 크레딧 사용 내역 + 추가 구매
```

### 구독 페이지 개선
- 현재 플랜 표시 + 크레딧 잔액 프로그레스 바
- 이번 달 사용량 / 한도 표시
- 플랜 업그레이드 CTA

### 크레딧 페이지 (신규)
- 크레딧 잔액 + 사용률
- 최근 트랜잭션 내역 (모델별, 날짜별)
- 추가 크레딧 구매 버튼 → LS checkout
- 자동 충전 설정 토글

## 기존 코드 수정 사항

### 1. webhook.service.ts - userId 추출 수정
```typescript
// Before: const userId = '00000000-...'; // PLACEHOLDER
// After: const userId = payload.meta?.custom_data?.user_id;
```

### 2. webhook.service.ts - 구독 생성 시 크레딧 배정
구독 webhook 수신 → plan 매칭 → credit_balances 생성/갱신

### 3. Controller as any 제거
타입 안전한 DTO 파라미터로 교체

### 4. Swagger 데코레이터 추가
모든 REST endpoint에 @ApiTags, @ApiOperation, @ApiResponse 추가

### 5. feature-config.ts 메뉴 등록
```typescript
{ id: "payment", label: "결제", path: PAYMENT_ADMIN_PATH, icon: CreditCard, order: 25 }
```

## 구현 순서

### Phase 0: 기존 버그 수정
- webhook.service.ts userId 수정
- Controller as any 제거
- Swagger 데코레이터 추가
- feature-config.ts 메뉴 등록

### Phase 1: 스키마 + 서비스
- 4개 테이블 스키마 작성
- plan.service.ts
- credit.service.ts
- model-pricing.service.ts
- tRPC Router 확장
- REST API (크레딧 check/deduct)

### Phase 2: agent-server 연동
- credit-check 미들웨어
- credit-deduct 후처리
- 잔액 부족 시 에러 응답

### Phase 3: Admin UI
- 플랜 관리 페이지
- 크레딧 관리 페이지
- 모델 가격 설정 페이지
- 대시보드 통계 확장

### Phase 4: 사용자 UI
- 구독 페이지 크레딧 표시 추가
- 크레딧 사용 내역 페이지
- 추가 크레딧 구매 플로우
- 자동 충전 설정 UI

### Phase 5: 검증 + 레퍼런스 업데이트
- TypeScript 빌드 테스트
- DB Migration 생성
- docs/reference/ 업데이트
