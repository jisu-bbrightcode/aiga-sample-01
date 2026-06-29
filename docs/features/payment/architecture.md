# 시스템 아키텍처

결제 도메인의 전체 구조와 서비스 간 흐름을 설명합니다.

---

## 전체 아키텍처 다이어그램

```
┌─────────────────────────────────────────────────────────────────┐
│  Frontend (apps/app/src/features/payment/)                      │
│   pages: upgrade, my-subscription, top-up, billing-overview     │
│   components: PlanCard, ChangePlanDialog, CancelDialog,         │
│               ExtraUsageCard, LimitDialog                       │
│   hooks: use-plan-change, use-extra-usage, use-my-subscription  │
└──────────────────────────┬──────────────────────────────────────┘
                           │ tRPC (HTTPS)
┌──────────────────────────▼──────────────────────────────────────┐
│  tRPC Routers (packages/features/payment/trpc/)                 │
│   auth.router    — 인증 사용자 (15+ procedures)                  │
│   admin.router   — 관리자 전용 (comp, refund, grant 등)          │
│   public.router  — 인증 불필요 (webhook, pricing)                │
└──────────────────────────┬──────────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
┌─────────────┐  ┌──────────────────┐  ┌─────────────────┐
│Subscription │  │ CreditLedger     │  │ AiUsageMeter    │
│Service      │  │ Service          │  │ Service         │
│ changePlanV2│  │ getBalance       │  │ reserve()       │
│ schedCancel │  │ applyPlanChange  │  │ claim()         │
│ cancelImm.  │  │ Credit          │  │ cancel()        │
│ uncancel    │  └────────┬─────────┘  └────────┬────────┘
└──────┬──────┘           │                     │
       │                  ▼                     ▼
       │         ┌──────────────────┐  ┌─────────────────┐
       │         │ ExtraUsage       │  │ AutoRecharge    │
       │         │ Service          │  │ Service         │
       │         │ getSettings CRUD │  │ trigger()       │
       │         └──────────────────┘  │ monthlyCapCheck │
       │                               └────────┬────────┘
       │                                        │
       └────────────────┬───────────────────────┘
                        ▼
         ┌──────────────────────────────┐
         │ PolarAdapter                 │
         │ createCheckout()             │
         │ updateSubscription()         │
         │ revokeSubscription()         │
         │ refundOrder()                │
         └──────────────┬───────────────┘
                        │ Polar.sh REST API (HTTPS)
                        ▼
         ┌──────────────────────────────┐
         │ Polar.sh                     │
         │ (sandbox / production)       │
         │ subscription, order, refund  │
         └──────────────┬───────────────┘
                        │ Webhook (HTTP POST)
                        ▼
         ┌──────────────────────────────┐
         │ WebhookDispatcher            │
         │ (packages/features/payment/  │
         │  webhooks/)                  │
         │ subscription.* / order.*     │
         │ / refund.*                   │
         └──────────────┬───────────────┘
                        │
                        ▼
         ┌──────────────────────────────┐
         │ Neon DB (PostgreSQL)         │
         │ (packages/drizzle)           │
         │ 17개 payment 테이블          │
         └──────────────────────────────┘
```

---

## Service Map

| Service | 파일 | 주요 책임 |
|---------|------|-----------|
| `SubscriptionService` | `service/subscription.service.ts` | 구독 CRUD, plan 변경, 취소, uncancel |
| `CreditLedgerService` | `service/credit-ledger.service.ts` | included credit 잔액 추적 (append-only ledger) |
| `AiUsageMeterService` | `service/ai-usage-meter.service.ts` | Reserve/Claim/Cancel 패턴, paid usage 차감 |
| `ExtraUsageService` | `service/extra-usage.service.ts` | extra usage settings CRUD, 잔액 분기 |
| `AutoRechargeService` | `service/auto-recharge.service.ts` | threshold trigger, advisory lock, cap 검사 |
| `UsageNotificationService` | `service/usage-notification.service.ts` | 80%/100% 알림 (cycle 안 중복 방지) |
| `PolarAdapter` | `service/polar.adapter.ts` | Polar REST API 단일 진입점 |
| `OrderMirrorService` | `service/order-mirror.service.ts` | Polar order → `payment_orders` 동기화 |
| `CouponService` | `service/coupon.service.ts` | 쿠폰 검증, Polar discount ID 매핑 |
| `AuditService` | `service/audit.service.ts` | `payment_audit_log` append |
| `DunningService` | `service/dunning.service.ts` | past_due → grace → canceled 전환 |
| `NotificationService` | `service/notification.service.ts` | in-app notification 발행 |

---

## Cron 스케줄러

| Cron | 파일 | 주기 | 역할 |
|------|------|------|------|
| `PendingPlanChangeCron` | `scheduler/pending-plan-change.cron.ts` | 매시간 | 다운그레이드 deferred apply — `apply_at <= now()` row 처리 |
| `UsageReserveCron` | `scheduler/usage-reserve.cron.ts` | 10분 | Reserve 만료 sweep + stuck recharge timeout |
| `DunningCron` | `scheduler/dunning.cron.ts` | 주기적 | past_due → grace → canceled 전환 |
| `ReconcileCron` | `scheduler/reconcile.cron.ts` | 주기적 | Polar 상태와 DB 간 불일치 감지 |
| `DataPurgeCron` | `scheduler/data-purge.cron.ts` | 주기적 | `data_purge_at` 도달 후 PII 마스킹 |

---

## Data Flow: 결제 (구독 시작)

```
사용자 → /billing/upgrade 클릭 → PlanCard CTA
  → tRPC payment.createSubscriptionCheckout
  → PolarAdapter.createCheckout (idempotency_key 5초 버킷)
  → Polar hosted checkout 페이지 (리디렉트)
  → 결제 완료 → successUrl (/checkout-success)
  → Polar webhook: subscription.created + order.paid
  → WebhookDispatcher
      → subscription.created → SubscriptionService.processEvent
          → payment_subscriptions INSERT (status=trialing 또는 active)
          → CreditLedgerService.grantPlanCredits
      → order.paid → OrderMirrorService.handleOrderPaid
          → payment_orders INSERT
```

---

## Data Flow: 플랜 변경

```
사용자 → ChangePlanDialog 확인
  → tRPC payment.changePlan
  → SubscriptionService.changePlanV2
      ① kind = upgrade / cycle-up / cycle-down:
         PolarAdapter.updateSubscription (tx 밖)
         → Polar 응답 → DB mirror (plan_id, period)
         → CreditLedgerService.applyPlanChangeCredit
         → AuditLog write
      ② kind = downgrade:
         payment_pending_plan_changes INSERT (status=pending)
         → PendingPlanChangeCron (매시간) apply_at 도달 시
         → PolarAdapter.updateSubscription (proration_behavior=next_period)
         → DB mirror
```

---

## Data Flow: AI Usage

```
AI service (별도 PR) → tRPC ai.reserve
  → AiUsageMeterService.reserve
      → includedBalance 확인
      → paidBalance 확인 (cached_paid_balance_cents)
      → 잔액 충분 → payment_usage_reserves INSERT (status=reserved)
      → 잔액 부족 → ExtraUsageService.handleInsufficient
          → auto_recharge_enabled → AutoRechargeService.trigger
          → 기타 → throw 'insufficient_balance'

AI call 완료 → tRPC ai.claim
  → AiUsageMeterService.claim
      → actual_cents = model_pricing.calculate(model, in, out)
      → tx 안:
          a) includedBalance ≥ actual → paymentCreditLedger INSERT delta=-actual
          b) 부분: paymentCreditLedger + paymentUsageLedger 분할
          c) 전부 paid: paymentUsageLedger INSERT delta_cents=-actual
          → payment_usage_reserves UPDATE status=claimed
          → payment_subscriptions UPDATE cached_paid_balance_cents
      → UsageNotificationService.maybeNotify (80%/100%)
```

---

## 트랜잭션 경계 정책

Polar API 호출은 외부 사이드이펙트라 DB 트랜잭션으로 롤백 불가합니다. PR #62 에서 확립된 정책:

| 메서드 | Polar 호출 위치 | 이유 |
|--------|-----------------|------|
| `changePlanV2` | tx **밖** | Polar 성공 + DB 실패 → webhook 이 멱등 보정 |
| `scheduleCancelAtPeriodEnd` | tx **밖** | 동일 |
| `uncancelSubscription` | tx **밖** | 동일 |
| `cancelImmediatelyWithRefund` | tx **안** | revoke + refund 원자성 우선 (orphan 시 alert) |
| `AutoRechargeService.trigger` | tx **밖** | Polar checkout → webhook → ledger insert 별도 tx |

---

## Race 차단 패턴

| 상황 | 패턴 |
|------|------|
| 동시 auto-recharge trigger | `pg_advisory_xact_lock(hashtext(orgId))` |
| 중복 auto-recharge 결제 | `recharge_history.idempotency_key` UNIQUE |
| 동시 active reserve 중복 | partial unique idx (`WHERE status='reserved'`) |
| 중복 credit ledger insert | `(org, ref_type, ref_id)` UNIQUE (partial) |
| 중복 webhook 처리 | `payment_subscription_events.polar_event_id` UNIQUE |
| 다운그레이드 pending 중복 | partial unique idx (`WHERE status='pending'`) |
| 결제 checkout 중복 클릭 | idempotency_key 5초 버킷 |
