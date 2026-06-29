# 결제 Plan Change v2 — 2026-04-26

## 변경사항

v1 의 stub 상태였던 changePlan/cancel 을 Polar API 와 완전 통합한 v2.

### 새로 지원하는 시나리오

- **즉시 업그레이드** — Pro → Pro Plus 같은 cycle 안 plan 변경 시 즉시 차액 결제
- **예약 다운그레이드** — Pro Plus → Pro 변경 시 다음 결제일에 자동 적용
- **Cycle 변경** — Monthly ↔ Yearly 전환 시 즉시 prorate
- **취소 (cycle_end)** — 결제 주기 종료까지 이용 후 자동 종료
- **취소 + 즉시 환불** — 결제 후 14일 이내라면 즉시 환불 + 사용 종료
- **해지 취소** — 취소 예약 해제 (subscription 유지)

### 기술 변경

- `SubscriptionService` 에 5 메서드 추가:
  - `previewPlanChange` — 5 kind 분류 (upgrade / downgrade / cycle-up / cycle-down / same)
  - `changePlanV2` — 4 kind 즉시 변경 (upgrade/cycle-up/cycle-down) + downgrade deferred
  - `scheduleCancelAtPeriodEnd` — cycle_end 취소 예약
  - `cancelImmediatelyWithRefund` — 14일 환불 윈도우 즉시 취소
  - `uncancelSubscription` — 취소 예약 해제
- `payment_pending_plan_changes` 신규 테이블 (downgrade pending state)
- `PendingPlanChangeCron` — 매시간 `apply_at <= now` row 처리, multi-instance SKIP LOCKED 안전
- tRPC auth router 에 4 엔드포인트 추가:
  - `payment.previewPlanChange` (query)
  - `payment.changePlan` v2 (mutation)
  - `payment.cancelSubscription` (mode=cycle_end | immediate_refund)
  - `payment.uncancelSubscription` (mutation)
- Frontend: `ChangePlanDialog`, `CancelDialog` 컴포넌트 + `use-plan-change.ts` hooks
- Polar API adapter: `updateSubscription` (PATCH), `revokeSubscription` (즉시 종료)
- AuditLog: 7 신규 액션 (`plan_changed`, `plan_change_scheduled`, `plan_change_canceled`, `subscription_cancel_scheduled`, `subscription_canceled_with_refund`, `subscription_uncancel_requested`, `subscription_uncanceled`)

### 운영 노트

- **Polar tx 외부 호출 패턴** — `changePlanV2` / `scheduleCancelAtPeriodEnd` / `uncancelSubscription` 은 Polar 호출이 tx 밖. Polar 성공 + DB 실패 시 `subscription.updated`/`subscription.canceled` webhook 이 멱등 동기화
- **Polar tx 내부 호출 예외** — `cancelImmediatelyWithRefund` 만 revoke + refund 원자성 위해 단일 tx
- **14일 환불 윈도우** — `subscription.currentPeriodStart + 14d` (inclusive, server/client 모두 `<=`)
- **comp_* sub 가드** — admin 발급 non-Polar sub 은 v2 메서드 미지원 (즉시 에러)

### 마이그레이션

- `0009`: `payment_pending_plan_changes` 테이블 + `payment_pending_plan_change_status` enum 추가
- `0010`: status enum pgEnum 정착 (text → enum cast)

### 회귀 영향

- v1 `changePlan` 메서드는 `SubscriptionService` 에 보존 (기존 호출자 보호)
- auth.router 만 v2 로 전환
- 기존 webhook dispatcher 의 `subscription.updated` 가 `plan_id` mirror 추가 (T3) — 기존 데이터 backfill 영향 없음

## 의존

- PR #56 (payment v1, Polar.sh 기반 구독 + checkout + webhook) 머지 완료 (`42ad3a89`)
- Drizzle migration 0009, 0010 실행 필요 (staging/prod 배포 시)

## 리뷰 포인트

- `packages/features/payment/service/subscription.service.ts` — 5 v2 메서드
- `packages/features/payment/scheduler/pending-plan-change.cron.ts` — multi-instance 안전 cron
- `apps/app/src/features/payment/` — 페이지/컴포넌트/hooks 통합
