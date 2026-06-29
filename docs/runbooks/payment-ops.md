# Payment Ops Runbook (v1, Polar.sh)

## 0. 환경 / 상태

| Field | Value |
|---|---|
| PSP | Polar.sh, MoR |
| Currency | USD |
| Sandbox org | `bbrightcode` (id `c3bbd923-b869-4d78-8b23-1613887f2096`) |
| Production org | (출시 시 별도 등록) |
| Catalog SKU | 7 (Pro/Team × monthly/yearly + top-up 1k/5k/20k) — id 매핑은 `docs/superpowers/specs/2026-04-26-payment-system-catalog.json` |
| Webhook endpoint (sandbox) | id `fd272d73-70e7-4176-9398-a04d4123faca` |

## 1. Webhook 등록 절차 (sandbox & production)

Polar dashboard 클릭 대신 **API 직접 호출** 권장 (스크립트 가능).

### Sandbox (이미 완료)

```bash
TOKEN=$POLAR_ACCESS_TOKEN  # polar_oat_*
ORG=c3bbd923-b869-4d78-8b23-1613887f2096
TUNNEL=https://<your-ngrok-or-cloudflared>.ngrok-free.app

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
      "checkout.created", "checkout.updated",
      "benefit_grant.created", "benefit_grant.updated", "benefit_grant.revoked"
    ]
  }'
```

응답의 `secret` 필드 (`polar_whs_*`) 를 `.env.local` 의 `POLAR_WEBHOOK_SECRET=` 에 그대로 채운다. PolarWebhookController 가 `polar_whs_` / `whsec_` prefix 를 자동 strip 후 standardwebhooks 의 base64 secret 으로 처리한다.

### Production 전환

1. Production org token 발급 (`https://polar.sh/dashboard/<org>/settings`)
2. `.env.production` 또는 배포 환경의 secrets 에 `POLAR_ACCESS_TOKEN`/`POLAR_ENV=production`/`POLAR_ORGANIZATION_ID` 설정
3. Production 서버 도메인 (예 `https://app.product-builder.app/api/webhook/polar`) 으로 동일 curl 호출
4. 응답 secret 을 production env 에 반영

### Dev tunnel 갱신

ngrok free tier 는 재시작 시 URL 이 매번 바뀐다 (`https://<random>.ngrok-free.app`).

URL 바뀌면:
1. `curl PATCH https://sandbox-api.polar.sh/v1/webhooks/endpoints/<id>` 로 url 업데이트 (또는 endpoint 삭제 후 재등록)
2. `.env.local` 갱신 불필요 (secret 동일)

영구 URL 원하면 ngrok 유료 또는 cloudflared 사용 권장.

### §1.4 Webhook redelivery after a controller fix

When a controller/dispatcher bug caused 401/500 on a batch of Polar webhook
deliveries (e.g. signature library mismatch, missing case in switch), use
this procedure to recover the missed events:

#### Pre-conditions

- The fix is shipped (server is processing new webhooks correctly).
- You have `POLAR_ACCESS_TOKEN` (sandbox: `polar_oat_*`, prod: separate).
- You have `POLAR_WEBHOOK_ENDPOINT_ID` (find at
  `https://sandbox.polar.sh/dashboard/<org>/settings/webhooks`).

#### Steps

1. **Dry-run first** to see what would be redelivered:
   ```bash
   POLAR_ACCESS_TOKEN=polar_oat_... \
   POLAR_WEBHOOK_ENDPOINT_ID=fd272d73-... \
   POLAR_ENV=sandbox \
   pnpm tsx apps/server/scripts/redeliver-polar-webhooks.ts --dry-run --limit=100
   ```
2. Inspect the JSON output — confirm every entry is something you want
   replayed (no third-party noise, no event types we don't subscribe to).
3. **Live run** (drop `--dry-run`):
   ```bash
   pnpm tsx apps/server/scripts/redeliver-polar-webhooks.ts --limit=100
   ```
4. Tail the server log and confirm 200 responses for each `webhook-id`.
5. Verify DB state — for the original payment that triggered the fix:
   - `payment_subscription_events` has rows for every `polar_event_id`.
   - `payment_credit_ledger` has the cycle credits (subscription) or top-up credits.
   - `payment_orders` has the mirrored order row (Task 3 mirror).

#### Replay-tolerance window

Polar's webhook signature is timestamped; our controller rejects deliveries
older than 5 minutes (`REPLAY_TOLERANCE_SEC` in
`packages/features/payment/controller/public/polar-webhook.controller.ts`).
Polar redeliver issues a fresh signature with current timestamp, so the
5-min replay window does NOT prevent recovery — it only blocks naive
re-POSTing of saved bodies.

#### When NOT to redeliver

- During an incident where the dispatcher is still buggy — wait for the fix.
- For deliveries older than 30 days (Polar may have GC'd the body).
- For events we no longer subscribe to (script will skip but warn).

#### Known no-op cases

- `order.refunded` for a top-up order: the dispatcher's `OrderMirrorService`
  skips top-up mirrors silently (Task 3 INV-7), so the refund's UPDATE WHERE
  `polar_order_id` = ... returns 0 rows. No ledger reversal happens
  (because no top-up ledger row was granted to reverse). Acceptable today;
  revisit when top-up package mirroring lands.

## 2. Secret rotation

Polar 는 endpoint 별 secret 1개. rotation 시:
1. 새 endpoint 등록 (다른 URL 아니어도 가능)
2. 신규 secret 으로 deploy → 30분 dual-window
3. 기존 endpoint 삭제

또는 endpoint update API 로 secret regenerate (Polar 가 지원하면). 미지원이면 위 절차.

## 3. 환불 처리

### 정상 흐름 (admin UI)
1. Admin → `/payment/orders/$id` → "환불" 버튼
2. 다이얼로그 → 금액 + 사유 입력 → 확인
3. `payment.admin.refundOrder` tRPC 호출
4. PolarAdapter.refundOrder → Polar API
5. Polar webhook `refund.created` → CreditLedgerService.refundReverse (FIFO)
6. payment_orders.status → `refunded` 또는 `partially_refunded`
7. Resend transactional `refund-completed` 메일

### Polar 직접 환불 (예외)
Admin UI 가 다운된 경우 Polar dashboard 에서 직접 refund. 이 경우에도 webhook 이 도달하므로 우리 ledger 동기화됨.

## 4. Dunning / Soft-suspend

| 상태 | trigger | 우리 동작 |
|---|---|---|
| `active` → `past_due` | Polar payment.failed (= order.created with status=failed) | DunningService.markPastDue, in-app 배너 |
| `past_due` 7일 경과 | dunning.cron daily 03:00 UTC | grace 진입, soft-suspend, Resend `soft-suspend` 메일 |
| `grace` 만료 | dunning.cron | canceled, data_purge_at = +30일 |
| `cancel` 후 30일 | data-purge.cron daily 03:30 UTC | 사용자 작업 데이터 read-only archive |

수동 강등 해제: admin → `/payment/subscribers/$id` → "Release Suspend" → `payment.admin.releaseSoftSuspend`.

## 5. 결제 drift 발견 시

DB ↔ Polar 불일치:
1. `reconcile.cron` (TODO Phase 15: 활성화) 가 monthly 자동 reconcile 예정
2. 수동 reconcile: Polar dashboard 에서 sub 조회 → DB `payment_subscriptions.status` 와 비교 → 불일치 시 Polar SDK get 으로 수동 update

## 6. 알려진 deferred items (v1.1)

- audit_log hash chain (J2)
- bounce/spam 추적 (L3)
- 사용자 cancel 시 즉시 삭제 토글 (G4)
- 한국 PG (포트원/토스/카카오페이) 추가
- license/affiliate/referral 도메인
- mrrDelta30d 정확 계산 (snapshot table 필요)
- changePlan downgrade deferred-intent 테이블

## 7. 비상 종료 (테스트 청소)

dev DB 의 모든 payment 데이터 청소:
```sql
DELETE FROM payment_subscription_events;
DELETE FROM payment_credit_ledger;
DELETE FROM payment_coupon_redemptions;
DELETE FROM payment_subscriptions;
DELETE FROM payment_orders;
DELETE FROM payment_coupons;
DELETE FROM payment_audit_log;
DELETE FROM payment_customers;
-- catalog (plans, top_up_packages, model_pricing) 는 유지
```

## 8. 관련 코드 위치

- 서버: `packages/features/payment/`
- 스키마: `packages/drizzle/src/schema/features/payment/`
- 카탈로그 seed: `packages/drizzle/src/seed/payment-catalog.ts`
- Admin UI: `apps/admin/src/features/payment/`
- 사용자앱 UI: `apps/app/src/features/payment/`
- Email templates: `packages/features/payment/templates/`
- Spec: `docs/superpowers/specs/2026-04-26-payment-system-design.md`

---

## v2 Plan Change 운영 절차 (2026-04-26 추가)

### §9 다운그레이드 pending 모니터링

`cycle_end` 에 도달했지만 cron 이 처리 못 한 row 점검:

```sql
SELECT *
FROM payment_pending_plan_changes
WHERE status='pending'
  AND apply_at < NOW() - INTERVAL '2 hours';
```

결과가 비어있어야 정상. 행 발견 시 cron 로그 확인:

```
[PendingPlanChangeCron] pending plan change tick: applied=N failed=N skipped=N elapsedMs=N
```

- `applied` = 정상 처리
- `failed` = Polar 호출 실패 또는 sub/plan 미존재 → 다음 tick 재시도 (또는 comp_* 는 terminal canceled)
- `skipped` = 다른 cron 인스턴스가 SKIP LOCKED 정상 동작

전체 `failed` 가 비정상적으로 누적되면 Polar API 상태 + DB `sub.polarSubscriptionId` 값 (comp_* 비율 등) 점검.

### §10 Refund orphan 복구

`cancelImmediatelyWithRefund` 가 revoke 성공 + refund 실패 시 sub 은 active 유지 + Polar revoke 는 그대로 남음. 다음 `subscription.canceled` webhook 이 동기화하지만 webhook 지연 시 admin 매뉴얼:

1. Polar 대시보드에서 sub 상태 확인 (revoked 인지)
2. `payment_subscriptions.status` 가 'active' 면서 sub 이 Polar 측 revoked 일 때:
   ```sql
   UPDATE payment_subscriptions
   SET status='canceled', canceled_at=NOW(), current_period_end=NOW()
   WHERE id=$SUBSCRIPTION_ID;
   ```
3. AuditLog 에 `manual_reconcile` 로 기록

### §11 changePlanV2 Polar orphan

`changePlanV2` 가 Polar PATCH 성공 + DB mirror 실패 시 명시 throw + `subscription.updated` webhook 이 mirror 복원. webhook 은 한 시간 안에 도래해야 정상.

webhook 지연 시:
1. `payment_subscriptions.plan_id` 와 Polar 측 `product_id` 비교
2. 불일치 시 admin SQL update 또는 Polar 대시보드에서 webhook redeliver

### §12 PendingPlanChangeCron 비상 재처리

특정 pending row 가 Polar 측 오류로 계속 failed 상태면:

1. 원인 파악 후 Polar sub 직접 PATCH (대시보드 또는 API)
2. row 수동 applied 처리:
   ```sql
   UPDATE payment_pending_plan_changes
   SET status='applied', applied_at=NOW()
   WHERE id=$ROW_ID;
   ```
3. `payment_subscriptions.plan_id` mirror 수동 업데이트 확인

---

## §13 Credit + Extra Usage 운영

### §13.1 사용량 모니터링

```sql
-- 이번 cycle 의 paid usage 합 (org 별)
SELECT organization_id, period_start, SUM(-delta_cents) AS used_cents
FROM payment_usage_ledger
WHERE reason = 'ai_usage' AND period_start = (SELECT MAX(period_start) FROM payment_usage_ledger)
GROUP BY organization_id, period_start
ORDER BY used_cents DESC LIMIT 20;

-- pending in-flight reservations
SELECT organization_id, COUNT(*), SUM(estimate_cents) AS reserved_cents
FROM payment_usage_reserves
WHERE status = 'reserved'
GROUP BY organization_id
ORDER BY reserved_cents DESC;

-- stuck recharges
SELECT *
FROM payment_recharge_history
WHERE status = 'pending' AND attempted_at < NOW() - INTERVAL '5 minutes';
```

### §13.2 Auto-recharge 실패 복구

```sql
-- failed/timeout recharge 의 재시도
UPDATE payment_recharge_history
SET status = 'cancelled', completed_at = NOW()
WHERE id = $RECHARGE_ID;
-- 다음 reserve 시 새 trigger 발사
```

### §13.3 Extra Usage 알림 누락 복구

80%/100% 알림이 도달했는데 사용자가 못 받았을 경우 audit_log 의 'usage_limit_reached' row 검색 + 수동 알림.

### §13.4 cycle 별 사용량 리포트

```sql
SELECT date_trunc('day', created_at) AS day,
       SUM(-delta_cents) FILTER (WHERE delta_cents < 0) AS used_cents,
       SUM(delta_cents) FILTER (WHERE reason = 'auto_recharge') AS recharge_cents
FROM payment_usage_ledger
WHERE organization_id = $ORG_ID
  AND period_start = $CURRENT_CYCLE_START
GROUP BY day ORDER BY day;
```
