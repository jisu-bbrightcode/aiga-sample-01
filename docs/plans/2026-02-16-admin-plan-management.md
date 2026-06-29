# 플랜 관리 시스템 Admin 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** 관리자 결제 대시보드를 한국어 UI + Feature 레이아웃으로 개선하고, 구독자 목록 페이지를 신규 추가

**Architecture:** 기존 payment 백엔드에 `getSubscribers` API 1개 추가, `getSubscriptionStats` 확장. 프론트엔드는 AdminPaymentPage 개선 + SubscribersPage 신규 생성.

---

## 현재 상태 분석

### 이미 완료된 항목 (수정 불필요)

| 항목 | 상태 | 비고 |
|------|------|------|
| `PlanManagementPage` | 완료 | 한글 UI, CRUD, Dialog, hook 연동 |
| `CreditManagementPage` | 완료 | 한글 UI, UUID 검색, 잔액/트랜잭션, 수동 조정 |
| `ModelPricingPage` | 완료 | 한글 UI, 테이블, CRUD Dialog |
| payment hooks (9개) | 완료 | plan-management, credit-management, model-pricing, admin-payment 등 |
| Routes (4개) | 완료 | dashboard, plans, credits, pricing |
| feature-config 메뉴 | 완료 | 대시보드, 플랜 관리, 크레딧 관리, 모델 가격 서브메뉴 |
| Backend tRPC admin (17개) | 완료 | syncProducts, subscriptions, stats, refund, orders, plans CRUD, credits, model pricing |

### 작업 필요한 항목

| 항목 | 현재 상태 | 필요한 작업 |
|------|----------|------------|
| `AdminPaymentPage` | 영문 UI, 기본 레이아웃 | 한글화 + Feature 레이아웃 + 플랜별 분포 |
| 구독자 목록 페이지 | 미구현 | 신규 생성 (페이지 + 라우트 + hook + 백엔드 API) |
| `getSubscribers` API | 미구현 | PaymentService + tRPC procedure 추가 |
| `getSubscriptionStats` | MRR/ARR만 반환 | byPlan 분포 데이터 추가 |

---

## Task 1: Backend — getSubscribers 서비스 메서드 + tRPC 추가

**Files:**
- Modify: `packages/features/payment/service/payment.service.ts`
- Modify: `packages/features/payment/payment.router.ts`

**PaymentService에 추가할 메서드:**

```typescript
/**
 * 구독자 목록 조회 (profiles + subscriptions JOIN)
 * 페이지네이션 + 검색(이름/이메일) + 플랜 필터
 */
async getSubscribers(input: {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  planName?: string;
}): Promise<{
  data: Array<{
    id: string;          // profile id
    name: string;
    email: string;
    avatar: string | null;
    subscriptionId: string;
    planName: string;
    status: string;
    statusFormatted: string;
    price: number;
    interval: string;
    currentPeriodEnd: string | null;
    createdAt: string;
  }>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}>
```

**구현 전략:**
- `subscriptions` LEFT JOIN `profiles` (on `userId`)
- search: `ilike` on `profiles.name` OR `profiles.email`
- status 필터: `eq(subscriptions.status, input.status)`
- planName 필터: `eq(subscriptions.productName, input.planName)` (또는 `variantName`)
- `Promise.all`로 데이터 + count 병렬 조회

**tRPC procedure 추가 위치:** `payment.router.ts`의 `admin` 네임스페이스 내부

```typescript
// admin 네임스페이스 안에 추가
getSubscribers: adminProcedure
  .input(
    z.object({
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(100).default(20),
      search: z.string().optional(),
      status: z.string().optional(),
      planName: z.string().optional(),
    }),
  )
  .query(async ({ input }) => {
    return services.get().paymentService.getSubscribers(input);
  }),
```

**참고 파일:**
- `packages/features/payment/service/payment.service.ts:188` — `getSubscriptionStats` 패턴 참조
- `packages/features/profile/service/profile.service.ts` — `listAll` 페이지네이션 패턴 참조
- `packages/drizzle/src/schema/core/profiles.ts` — profiles 테이블 스키마

**Verification:**
```bash
cd packages/features && pnpm tsc --noEmit
```

---

## Task 2: Backend — getSubscriptionStats에 byPlan 분포 추가

**Files:**
- Modify: `packages/features/payment/service/payment.service.ts`
- Modify: `packages/features/payment/types/subscription.types.ts` (SubscriptionStats 타입에 byPlan 추가)

**현재 `getSubscriptionStats` 반환값:**
```typescript
{ total, active, cancelled, expired, paused, trial, mrr, arr }
```

**추가할 필드:**
```typescript
byPlan: Array<{ planName: string; count: number; percentage: number }>
```

**구현:** 기존 `allSubscriptions` 배열을 `productName` 기준으로 `reduce`하여 집계

```typescript
// getSubscriptionStats 메서드 내부에 추가
const planCounts = allSubscriptions.reduce((acc, sub) => {
  const name = sub.productName || 'Unknown';
  acc[name] = (acc[name] || 0) + 1;
  return acc;
}, {} as Record<string, number>);

const byPlan = Object.entries(planCounts).map(([planName, count]) => ({
  planName,
  count,
  percentage: stats.total > 0 ? Math.round((count / stats.total) * 100) : 0,
}));

return { ...stats, byPlan };
```

**SubscriptionStats 타입 확장:**
```typescript
export interface SubscriptionStats {
  // 기존 필드 유지...
  byPlan: Array<{ planName: string; count: number; percentage: number }>;
}
```

**Verification:**
```bash
cd packages/features && pnpm tsc --noEmit
```

---

## Task 3: Frontend — useSubscribers hook 생성

**Files:**
- Create: `apps/system-admin/src/features/payment/hooks/use-subscribers.ts`
- Modify: `apps/system-admin/src/features/payment/hooks/index.ts` — re-export 추가

**Hook 내용:**

```typescript
import { useQuery } from '@tanstack/react-query';
import { useTRPC } from '@/lib/trpc';

export function useSubscribers(input: {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  planName?: string;
}) {
  const trpc = useTRPC();
  return useQuery(trpc.payment.admin.getSubscribers.queryOptions(input));
}
```

**hooks/index.ts에 추가:**
```typescript
export { useSubscribers } from './use-subscribers';
```

**참고 패턴:** `apps/system-admin/src/features/payment/hooks/use-admin-payment.ts`

**Verification:**
```bash
cd apps/system-admin && pnpm tsc --noEmit
```

---

## Task 4: Frontend — SubscribersPage 신규 생성

**Files:**
- Create: `apps/system-admin/src/features/payment/pages/SubscribersPage.tsx`
- Modify: `apps/system-admin/src/features/payment/pages/index.ts` — export 추가

**페이지 구성:**

```
┌──────────────────────────────────────────┐
│ PageHeader: "구독자 관리"                  │
│ description: "플랜 구독자 목록 및 관리"      │
├──────────────────────────────────────────┤
│ 검색바 (이름/이메일) + 상태 필터 + 플랜 필터 │
├──────────────────────────────────────────┤
│ Table                                    │
│ ┌──────┬───────┬──────┬──────┬──────────┐│
│ │사용자 │이메일  │플랜   │상태   │구독 시작  ││
│ ├──────┼───────┼──────┼──────┼──────────┤│
│ │Avatar │ ...  │Pro   │활성   │2026-01-15││
│ │+ Name │      │Badge │Badge │          ││
│ └──────┴───────┴──────┴──────┴──────────┘│
├──────────────────────────────────────────┤
│ 페이지네이션                               │
└──────────────────────────────────────────┘
```

**데이터 5가지 상태:**
- Loading: Skeleton 테이블
- Empty: "구독자가 없습니다" 메시지
- Error: 에러 메시지 + 재시도 버튼
- Default: 구독자 목록 테이블

**Import 및 사용할 컴포넌트:**
- `PageHeader` from `@repo/ui/components/page-header`
- `Table, TableBody, TableCell, TableHead, TableHeader, TableRow` from `@repo/ui/shadcn/table`
- `Avatar, AvatarFallback, AvatarImage` from `@repo/ui/shadcn/avatar`
- `Badge` from `@repo/ui/shadcn/badge`
- `Input` from `@repo/ui/shadcn/input`
- `Select, SelectContent, SelectItem, SelectTrigger, SelectValue` from `@repo/ui/shadcn/select`
- `Button` from `@repo/ui/shadcn/button`
- `Skeleton` from `@repo/ui/shadcn/skeleton`
- `useSubscribers` hook

**참고 패턴:** `apps/system-admin/src/features/role-permission/pages/UsersManagementPage.tsx` (테이블 + 검색 + 페이지네이션)

**Verification:**
```bash
cd apps/system-admin && pnpm tsc --noEmit
```

---

## Task 5: Frontend — SubscribersPage 라우트 등록

**Files:**
- Modify: `apps/system-admin/src/features/payment/routes.tsx` — 구독자 라우트 추가
- Modify: `apps/system-admin/src/features/payment/index.ts` — 경로 상수 re-export (필요 시)
- Modify: `apps/system-admin/src/feature-config.ts` — 서브메뉴에 "구독자 관리" 추가

**routes.tsx 변경:**

```typescript
import { SubscribersPage } from './pages';

// 경로 상수 추가
export const PAYMENT_ADMIN_SUBSCRIBERS_PATH = "/admin/payment/subscribers";

// createPaymentAdminRoutes 내부에 추가
const subscribersRoute = createRoute({
  getParentRoute: () => parentRoute,
  path: '/admin/payment/subscribers',
  component: SubscribersPage,
});

return [adminPaymentRoute, plansRoute, creditsRoute, pricingRoute, subscribersRoute];
```

**feature-config.ts 변경:**

```typescript
// import 추가
import {
  PAYMENT_ADMIN_PATH,
  PAYMENT_ADMIN_PLANS_PATH,
  PAYMENT_ADMIN_CREDITS_PATH,
  PAYMENT_ADMIN_PRICING_PATH,
  PAYMENT_ADMIN_SUBSCRIBERS_PATH,  // 추가
} from "./features/payment";

// submenus에 추가
submenus: [
  { id: "payment-dashboard", label: "대시보드", path: PAYMENT_ADMIN_PATH },
  { id: "payment-plans", label: "플랜 관리", path: PAYMENT_ADMIN_PLANS_PATH },
  { id: "payment-subscribers", label: "구독자 관리", path: PAYMENT_ADMIN_SUBSCRIBERS_PATH },  // 추가
  { id: "payment-credits", label: "크레딧 관리", path: PAYMENT_ADMIN_CREDITS_PATH },
  { id: "payment-pricing", label: "모델 가격", path: PAYMENT_ADMIN_PRICING_PATH },
],
```

**Verification:**
```bash
cd apps/system-admin && pnpm tsc --noEmit
```

---

## Task 6: Frontend — AdminPaymentPage 한국어화 + Feature 레이아웃 개선

**Files:**
- Modify: `apps/system-admin/src/features/payment/pages/AdminPaymentPage.tsx`

**현재 문제점:**
1. 영어 UI ("Payment Management", "Subscriptions", "Orders" 등)
2. `<div className="container mx-auto py-8">` — Feature 레이아웃 미사용
3. KPI 카드 4개 기본 구조만 있음
4. Skeleton이 단순 (`<Skeleton className="h-32" />`)

**개선 내용:**

1. **한국어화:**
   - "Payment Management" → "결제 대시보드"
   - "Total Subscriptions" → "전체 구독"
   - "Active" → "활성"
   - "MRR" → "월간 반복 수익 (MRR)"
   - "ARR" → "연간 반복 수익 (ARR)"
   - "Subscriptions" → "구독"
   - "Orders" → "주문"
   - "Refund Requests" → "환불 요청"
   - "Sync Products" → "상품 동기화"

2. **레이아웃:**
   - `<div className="container...">` → `<div className="space-y-6 p-6">`
   - `<h1>` → `<PageHeader>` 사용
   - 상품 동기화 버튼은 PageHeader의 actions로 이동

3. **데이터 5가지 상태 적용** (Tabs 내부):
   - Loading: Skeleton 테이블
   - Empty: 안내 메시지
   - Error: 재시도 버튼

**참고 패턴:** `apps/system-admin/src/features/role-permission/pages/UsersManagementPage.tsx`

**Verification:**
```bash
cd apps/system-admin && pnpm tsc --noEmit
```

---

## Task 7: 빌드 검증 및 레퍼런스 문서 업데이트

**Verification:**
```bash
cd packages/drizzle && pnpm tsc --noEmit
cd packages/features && pnpm tsc --noEmit
cd apps/server && pnpm tsc --noEmit
cd apps/system-admin && pnpm tsc --noEmit
```

**Files:**
- Modify: `docs/reference/features-backend.md` — payment admin에 `getSubscribers` 프로시저 추가, `getSubscriptionStats` byPlan 확장 기록
- Modify: `docs/reference/features-frontend.md` — payment admin에 `useSubscribers` hook, `SubscribersPage` 페이지 추가, AdminPaymentPage 개선 기록

---

## 파일 변경 요약

| 파일 | 작업 |
|------|------|
| `packages/features/payment/service/payment.service.ts` | `getSubscribers()` 추가, `getSubscriptionStats()` byPlan 확장 |
| `packages/features/payment/types/subscription.types.ts` | `SubscriptionStats` 타입에 `byPlan` 추가 |
| `packages/features/payment/payment.router.ts` | admin에 `getSubscribers` procedure 추가 |
| `apps/system-admin/src/features/payment/hooks/use-subscribers.ts` | **신규** 구독자 hook |
| `apps/system-admin/src/features/payment/hooks/index.ts` | re-export |
| `apps/system-admin/src/features/payment/pages/SubscribersPage.tsx` | **신규** 구독자 페이지 |
| `apps/system-admin/src/features/payment/pages/index.ts` | export 추가 |
| `apps/system-admin/src/features/payment/pages/AdminPaymentPage.tsx` | 한국어화 + Feature 레이아웃 |
| `apps/system-admin/src/features/payment/routes.tsx` | 구독자 라우트 추가 |
| `apps/system-admin/src/feature-config.ts` | 서브메뉴에 구독자 관리 추가 |
| `docs/reference/features-backend.md` | 업데이트 |
| `docs/reference/features-frontend.md` | 업데이트 |
