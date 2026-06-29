# 구독 생명주기 (Subscription Lifecycle)

구독이 만들어지고, 유지되고, 종료되는 전체 흐름을 설명합니다.

---

## 상태 머신

```
                    ┌─────────────────────────┐
                    │        (신규 가입)       │
                    └────────────┬────────────┘
                                 │ checkout → subscription.created webhook
                                 ▼
                          ┌────────────┐
                          │  trialing  │  (Pro 14일 무료 체험)
                          └─────┬──────┘
                                │ trial 종료 → 자동 결제 성공
                                ▼
┌──────────┐   결제 실패    ┌────────┐   결제 7일 연체
│ past_due │◄──────────────│ active │──────────────────►┌───────┐
└────┬─────┘               └───┬────┘                   │ grace │
     │                         │                         └───┬───┘
     │ 결제 성공               │ cancel 예약 후 주기 종료     │ 7일 후 미납
     └──────────►              ▼                         ┌───▼───┐
                         ┌──────────┐                    │canceled│
                         │ canceled │◄───────────────────└───────┘
                         └──────────┘ (즉시 취소 or 14일 환불)
```

---

## 각 상태 설명

### `trialing` — 무료 체험 중

- 트리거: `subscription.created` webhook (`status=trialing`)
- Pro 플랜: 14일 무료 체험. Team 플랜은 체험 없이 즉시 `active`.
- `trial_end` 시각까지 모든 기능 사용 가능.
- trial 종료 시 Polar 가 자동 결제 시도 → 성공 시 `active`, 실패 시 `past_due`.
- UI: "체험 중 — X일 남음" 배지 표시.

### `active` — 정상 구독 중

- 트리거: `subscription.updated` (status=active) 또는 최초 결제 성공.
- 모든 기능 완전 사용 가능.
- `current_period_end` 마다 Polar 자동 결제 → `subscription.updated` webhook.
- `cancel_at_period_end=true` 면 다음 결제 없이 주기 종료 시 canceled.

### `past_due` — 결제 실패

- 트리거: 자동 결제 실패 → `subscription.updated` (status=past_due) webhook.
- Polar 가 자동 재시도 (Dunning). 성공 시 `active` 복귀.
- `past_due_since` 설정 → DunningCron 이 7일 후 `grace` 로 전환.
- UI: "결제 실패 — X일 안에 결제 수단을 업데이트해주세요" 경고.

### `grace` — 유예 기간

- 트리거: `past_due` 후 7일 경과 (DunningCron).
- **INV-2 (DB CHECK):** `grace_ends_at` 과 `past_due_since` 모두 NOT NULL.
- 기능 제한 시작 (읽기 전용 모드 등, 구체적 정책은 product 결정).
- `grace_ends_at` 초과 → `canceled` 로 자동 전환.
- 결제 성공 시 즉시 `active` 복귀.

### `canceled` — 종료

- 트리거: (1) 사용자 취소 + 주기 종료, (2) 14일 즉시 환불, (3) grace 만료, (4) 관리자 강제 취소.
- `data_purge_at` 설정 → DataPurgeCron 이 PII 마스킹.
- 재가입 가능 (`reactivateSubscription`).

---

## Webhook → 상태 동기화

| Polar 이벤트 | 처리 | DB 결과 |
|-------------|------|---------|
| `subscription.created` | `SubscriptionService.processEvent` | INSERT subscription (status=trialing 또는 active) + credit grant |
| `subscription.updated` (status 변경) | upsertSubscription | UPDATE status, period, plan_id |
| `subscription.updated` (cancel_at_period_end) | upsertSubscription | UPDATE cancel_at_period_end |
| `subscription.canceled` | upsertSubscription | UPDATE status=canceled, canceled_at |
| `subscription.trial_end` | upsertSubscription | 체험 종료 → status 전환 |

**멱등 보장:** `payment_subscription_events.polar_event_id` UNIQUE — 같은 이벤트 두 번 처리 차단.

**plan_id 동기화 (PR #62):** `subscription.updated` 에서 `product_id` 가 바뀌면 `polar_product_id → plan.id` 룩업 후 DB 반영.

---

## 각 상태에서 보이는 UI

| 상태 | /billing/subscription 페이지 | 기능 접근 |
|------|------------------------------|-----------|
| `trialing` | "Pro 체험 중 · 14일 무료" + 업그레이드 CTA | 전체 |
| `active` | SubscriptionCard + 플랜 변경/해지 버튼 | 전체 |
| `active` + `cancel_at_period_end=true` | "YYYY-MM-DD 에 종료 예정" + 해지 취소 버튼 | 전체 (주기 종료 전) |
| `past_due` | "결제 실패 알림" 배너 | 제한적 |
| `grace` | "유예 기간 경고" 배너 | 읽기 전용 |
| `canceled` | "구독이 종료되었습니다 · 재가입" CTA | 차단 |

---

## 관리자 전용 운영 메서드

`admin.router` 를 통해서만 사용 가능. 일반 사용자 접근 불가.

| 메서드 | 설명 |
|--------|------|
| `cancelSubscriptionNow(subscriptionId)` | 즉시 취소 (환불 없음) |
| `compSubscription(orgId, planId, reason)` | Polar 없이 DB-only 구독 발급 (테스트/보상) |
| `extendTrialEnd(subscriptionId, days)` | 체험 기간 연장 |

**주의:** `comp_*` 로 시작하는 `polar_subscription_id` 를 가진 구독은 `changePlanV2`, `scheduleCancelAtPeriodEnd` 등 v2 메서드 사용 불가 (즉시 에러).

---

## 참조

- 상태 정의: [data-model.md#payment_subscriptions](./data-model.md)
- 플랜 변경: [plan-change-flows.md](./plan-change-flows.md)
- 해지·환불: [cancellation-and-refund.md](./cancellation-and-refund.md)
- Webhook 이벤트 목록: [webhook-events.md](./webhook-events.md)
