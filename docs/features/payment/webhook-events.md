# Webhook 이벤트

Polar.sh 가 결제 이벤트를 Product Builder 서버로 전달하는 방식과 각 이벤트의 처리 방법을 설명합니다.

---

## Webhook 수신 경로

```
Polar.sh → POST /api/webhook/polar
  → PolarWebhookController (standardwebhooks 서명 검증)
  → WebhookDispatcher.dispatch(event)
  → 이벤트 종류별 handler
```

**서명 검증:** `POLAR_WEBHOOK_SECRET` 환경 변수 사용. `polar_whs_` / `whsec_` prefix 자동 strip 후 base64 처리.

**Replay 방지:** 5분 초과 타임스탬프의 webhook 거부 (`REPLAY_TOLERANCE_SEC`). Polar redeliver 는 새 타임스탬프로 서명하므로 5분 제한에 걸리지 않습니다.

---

## 이벤트 카탈로그

### subscription.created

| 항목 | 내용 |
|------|------|
| 트리거 | 신규 구독 결제 성공 또는 free trial 시작 |
| Handler | `SubscriptionService.processEvent` |
| DB 결과 | `payment_subscriptions` INSERT (status=trialing 또는 active) |
| 부수 효과 | `CreditLedgerService.grantPlanCredits` — plan included credit grant |

### subscription.updated

| 항목 | 내용 |
|------|------|
| 트리거 | 상태 변경, plan 변경, cancel_at_period_end 토글, 기간 갱신 |
| Handler | `SubscriptionService.upsertSubscription` |
| DB 결과 | UPDATE status, current_period_start, current_period_end, plan_id (PR #62 추가), cancel_at_period_end |
| 멱등 | `polar_event_id` UNIQUE — 중복 webhook 두 번째는 skip |

**plan_id 동기화:** `polar_product_id → payment_plans.id` 룩업 후 `plan_id` 갱신. changePlanV2 의 동기 mirror 와 충돌 시 같은 값으로 덮어쓰기 (noop 효과).

### subscription.canceled

| 항목 | 내용 |
|------|------|
| 트리거 | 구독 최종 종료 (주기 종료 후 / 즉시 revoke) |
| Handler | `SubscriptionService.upsertSubscription` |
| DB 결과 | UPDATE status='canceled', canceled_at |

### subscription.trial_end

| 항목 | 내용 |
|------|------|
| 트리거 | 무료 체험 기간 종료 시 |
| DB 결과 | UPDATE status 갱신 (결제 성공 → active, 실패 → past_due) |

---

### order.created

| 항목 | 내용 |
|------|------|
| 트리거 | 결제 시작 (아직 처리 중) |
| Handler | `OrderMirrorService.handleOrderCreated` |
| DB 결과 | `payment_orders` INSERT (status=pending 또는 paid) |

### order.paid

| 항목 | 내용 |
|------|------|
| 트리거 | 결제 성공 |
| Handler | `OrderMirrorService.handleOrderPaid` |
| DB 결과 | `payment_orders` UPDATE status=paid |
| 분기 1 | `metadata.kind === 'top_up'` → `payment_credit_ledger` INSERT (credit grant) |
| 분기 2 | `metadata.trigger === 'auto_recharge'` → `payment_usage_ledger` INSERT + `payment_recharge_history` UPDATE + `cached_paid_balance_cents` UPDATE |
| 분기 3 | `metadata.kind === 'subscription'` → 구독 활성화 (subscription.created 가 주로 처리) |

### order.refunded

| 항목 | 내용 |
|------|------|
| 트리거 | 환불 완료 |
| DB 결과 | `payment_orders` UPDATE status=refunded, refunded_amount_cents |
| 부수 효과 | `CreditLedgerService.reverseRefund` — INV-5 FIFO 환원 |

---

### refund.created / refund.updated

| 항목 | 내용 |
|------|------|
| 트리거 | 환불 처리 시작 / 상태 변경 |
| DB 결과 | (order 상태 갱신 보조) |

---

### checkout.created / checkout.updated

| 항목 | 내용 |
|------|------|
| 트리거 | Polar checkout session 시작/변경 |
| 현재 처리 | 로그만 기록 (구독 확인은 subscription.created 에서) |

---

## 멱등 보장

```
1. payment_subscription_events.polar_event_id UNIQUE
   → 같은 이벤트 ID 두 번 수신 시 두 번째는 즉시 200 반환 (skip)

2. paymentCreditLedger (org, ref_type, ref_id) UNIQUE
   → order.paid 두 번 처리 시 두 번째 ledger insert 는 unique 충돌로 no-op

3. payment_usage_ledger (org, ref_type, ref_id) UNIQUE
   → auto_recharge 충전 두 번 처리 시 동일
```

---

## Webhook 등록 (개발 환경)

```bash
# ngrok 터널 시작
ngrok http 3000

# Polar sandbox webhook endpoint 등록
TOKEN=$POLAR_ACCESS_TOKEN
ORG=c3bbd923-b869-4d78-8b23-1613887f2096
TUNNEL=https://<your-random>.ngrok-free.app

curl -X POST https://sandbox-api.polar.sh/v1/webhooks/endpoints \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "url": "'"$TUNNEL"'/api/webhook/polar",
    "format": "raw",
    "events": [
      "subscription.created", "subscription.updated", "subscription.canceled",
      "order.created", "order.paid", "order.refunded",
      "refund.created", "refund.updated",
      "checkout.created", "checkout.updated"
    ]
  }'
```

응답의 `secret` 필드 → `.env.local` 의 `POLAR_WEBHOOK_SECRET=` 에 설정.

**ngrok URL 갱신 시:** `PATCH /v1/webhooks/endpoints/{id}` 로 URL 만 변경 (secret 재발급 불필요).

---

## Webhook 재전송 (Redeliver)

컨트롤러 버그 수정 후 놓친 이벤트를 재처리합니다.

```bash
# 드라이런 (영향 없이 대상 확인)
POLAR_ACCESS_TOKEN=polar_oat_... \
POLAR_WEBHOOK_ENDPOINT_ID=fd272d73-... \
POLAR_ENV=sandbox \
pnpm tsx apps/server/scripts/redeliver-polar-webhooks.ts --dry-run --limit=100

# 실제 재전송
pnpm tsx apps/server/scripts/redeliver-polar-webhooks.ts --limit=100
```

**확인 사항:**
- `payment_subscription_events` — 재전송 이벤트 row 존재
- `payment_credit_ledger` — cycle credit grant row 존재
- `payment_orders` — order row 존재

---

## 참조

- Webhook 운영 절차: [operations.md#webhook-지연](./operations.md)
- Polar API 인덱스: `docs/reference/polar-api-index.md`
- 구독 처리: [subscription-lifecycle.md](./subscription-lifecycle.md)
