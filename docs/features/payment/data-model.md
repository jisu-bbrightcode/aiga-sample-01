# 데이터 모델

결제 도메인의 전체 DB 스키마를 설명합니다. 모든 테이블은 `packages/drizzle/src/schema/features/payment/` 에 위치합니다.

---

## ER 다이어그램

```
organizations (Better Auth)
  │
  ├── payment_subscriptions ──── payment_plans
  │     │
  │     ├── payment_subscription_events
  │     ├── payment_pending_plan_changes ──── payment_plans
  │     └── payment_orders ──── payment_top_up_packages
  │
  ├── payment_credit_ledger
  ├── payment_usage_ledger
  ├── payment_usage_reserves
  ├── payment_extra_usage_settings ──── payment_top_up_packages
  └── payment_recharge_history ──── payment_top_up_packages

users (Better Auth)
  ├── payment_subscriptions
  ├── payment_credit_ledger (actor_user_id)
  └── payment_audit_log

payment_coupons ──── payment_coupon_redemptions
payment_audit_log
```

---

## 테이블 상세

### `payment_plans` (플랜 카탈로그)

플랜 SKU 5개 (Free · Pro Monthly · Pro Yearly · Team Monthly · Team Yearly).

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | uuid PK | 내부 식별자 |
| `polar_product_id` | text UNIQUE | Polar product ID (Free=null) |
| `polar_price_id` | text | Polar price ID |
| `slug` | text UNIQUE | 예: `pro-monthly`, `team-yearly` |
| `cycle` | enum | `lifetime` (Free) / `monthly` / `yearly` |
| `name` | text | 사용자 표시 이름 |
| `price_cents` | int | 가격 (USD cents, Free=0) |
| `currency` | text | 기본값 `USD` |
| `included_credits_per_cycle` | int | 주기당 포함 크레딧 (1 credit = 1 cent) |
| `seats` | int | 최대 팀원 수 |
| `trial_days` | int | 무료 체험 일수 |
| `is_active` | bool | 비활성화 시 체크아웃 불가 |

**Enum:** `payment_plan_cycle` — `lifetime`, `monthly`, `yearly`

---

### `payment_subscriptions` (구독 상태)

Polar 구독의 DB 미러. org 당 활성 구독은 1개.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | uuid PK | |
| `polar_subscription_id` | text UNIQUE | Polar subscription ID |
| `organization_id` | text FK | Better Auth organization |
| `user_id` | text FK | 결제 owner |
| `plan_id` | uuid FK | 현재 플랜 |
| `status` | enum | `trialing` / `active` / `past_due` / `grace` / `canceled` |
| `current_period_start` | timestamptz | 현재 결제 주기 시작 |
| `current_period_end` | timestamptz | 현재 결제 주기 종료 (= 다음 결제일) |
| `trial_end` | timestamptz | 체험 종료일 (nullable) |
| `cancel_at_period_end` | bool | 주기 종료 시 취소 예약 여부 |
| `canceled_at` | timestamptz | 취소 시각 |
| `past_due_since` | timestamptz | 결제 실패 시각 |
| `grace_ends_at` | timestamptz | 유예 기간 종료 시각 (7일) |
| `data_purge_at` | timestamptz | 취소 후 데이터 삭제 예정일 |
| `cached_paid_balance_cents` | int | paid usage 잔액 캐시 (30s polling 최적화) |
| `cached_balance_updated_at` | timestamptz | 캐시 갱신 시각 |

**INV-2 (DB CHECK):** `status='grace'` 이면 `grace_ends_at` 과 `past_due_since` 모두 NOT NULL.

**Enum:** `payment_subscription_status` — `trialing`, `active`, `past_due`, `grace`, `canceled`

**Index:** `(organization_id, status)`, `(status, grace_ends_at)`

---

### `payment_subscription_events` (Webhook 이벤트 기록)

Polar webhook 멱등 처리를 위한 이벤트 수신 로그.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | uuid PK | |
| `polar_event_id` | text UNIQUE | Polar webhook event ID — 중복 처리 차단 |
| `subscription_id` | uuid FK | 관련 구독 |
| `event_type` | text | `subscription.created` 등 |
| `payload` | jsonb | 원본 webhook payload |
| `processed_at` | timestamptz | 처리 완료 시각 |

---

### `payment_orders` (주문 기록)

Polar order 미러. top-up 구매 OR 구독 인보이스.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `polar_order_id` | text UNIQUE | Polar order ID |
| `organization_id` | text FK | |
| `user_id` | text FK | |
| `package_id` | uuid FK? | top-up 구매 시 설정 |
| `subscription_id` | uuid FK? | 구독 인보이스 시 설정 |
| `amount_cents` | int | 결제 금액 |
| `currency` | text | |
| `status` | enum | `paid` / `refunded` / `partially_refunded` / `failed` |
| `refunded_amount_cents` | int | 환불된 금액 |
| `invoice_url` | text | Polar 인보이스 URL |

**INV-7 (DB CHECK):** `package_id IS NOT NULL OR subscription_id IS NOT NULL` (둘 중 하나는 필수)

---

### `payment_credit_ledger` (Included Credit 장부, append-only)

Plan 에 포함된 크레딧 추적. 1 credit = 1 cent.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | bigserial PK | 순차 ID (조회 순서 보장) |
| `organization_id` | text FK | |
| `delta` | int | + 는 충전, - 는 차감 |
| `reason` | enum | 사유 코드 |
| `ref_type` | enum | 소스 문서 유형 |
| `ref_id` | text | 소스 문서 ID |
| `balance_after` | int | 이 row 이후 잔액 (캐시) |
| `spend_meta` | jsonb | AI 사용 메타데이터 |
| `actor_user_id` | text FK | 실행 주체 |
| `idempotency_key` | text | 호출자 제공 멱등 키 |

**INV-1 (test):** `balance_after = SUM(delta)` per organization.
**INV-5 (test):** `refund_reverse` delta = -(grant - used) FIFO.
**INV-6 (service):** insert 후 balance ≥ 0.

**Enum (reason):** `subscription_grant`, `top_up`, `spend`, `admin_grant`, `admin_revoke`, `refund_reverse`, `expire`, `plan_change_grant`, `plan_change_revoke`

**Unique:** `(organization_id, ref_type, ref_id)` WHERE ref_type IS NOT NULL

---

### `payment_top_up_packages` (충전 패키지 카탈로그)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `polar_product_id` | text | Polar product ID |
| `amount_cents` | int | 충전 금액 (USD cents) |
| `label` | text | UI 표시 레이블 (예: "$10") |
| `is_active` | bool | 판매 중 여부 |

현재 SKU: 1k / 5k / 20k cents 패키지.

---

### `payment_coupons` (쿠폰)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `code` | text UNIQUE | 쿠폰 코드 |
| `polar_discount_id` | text | Polar discount ID |
| `scope` | enum | `subscription` / `top_up` / `any` |
| `discount_type` | enum | `percentage` / `fixed` |
| `discount_value` | int | 할인율(%) 또는 금액(cents) |
| `max_redemptions` | int | 최대 사용 횟수 (null=무제한) |
| `expires_at` | timestamptz | 만료일 |
| `is_active` | bool | |

### `payment_coupon_redemptions` (쿠폰 사용 기록)

쿠폰 코드별 사용 내역 추적.

---

### `payment_audit_log` (감사 로그)

관리자 뮤테이션 전체 기록. 7년 보관 (탈퇴 후 PII 마스킹).

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | bigserial PK | |
| `actor_user_id` | text FK | 실행 주체 |
| `action` | text | 액션 코드 (아래 목록 참조) |
| `target_org_id` | text FK | 대상 조직 |
| `target_subscription_id` | uuid | 대상 구독 |
| `payload_before` | jsonb | 변경 전 상태 |
| `payload_after` | jsonb | 변경 후 상태 |
| `ip_address` | text | |
| `user_agent` | text | |
| `reason` | text | 사유 자유 텍스트 |

**알려진 action 값:**
- Plan change (PR #62): `change_plan_v2`, `schedule_downgrade`, `cancel_at_period_end`, `cancel_with_refund`, `uncancel`, `apply_pending_change`, `cancel_pending_change`
- Credit/extra-usage (PR #66): `auto_recharge_triggered`, `auto_recharge_failed`, `auto_recharge_timeout`, `extra_usage_settings_updated`, `usage_limit_reached`, `usage_reserve_expired`

---

### `payment_pending_plan_changes` (다운그레이드 대기 큐)

다운그레이드 deferred apply 를 위한 임시 테이블.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `subscription_id` | uuid FK | 대상 구독 |
| `target_plan_id` | uuid FK | 변경할 목표 플랜 |
| `apply_at` | timestamptz | 적용 예정 시각 (= current_period_end) |
| `status` | enum | `pending` / `applied` / `canceled` |
| `applied_at` | timestamptz | cron 이 적용한 시각 |
| `canceled_at` | timestamptz | 취소된 시각 |
| `reason` | text | `user_initiated` / `scheduled_apply` |

**INV:** 구독 당 동시에 1건만 pending — `uniqueIndex WHERE status='pending'`.

---

### `payment_usage_ledger` (Paid Usage 장부, append-only)

AI metered usage 를 cents 단위로 추적. plan included credit 과 분리된 별도 장부.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `organization_id` | text FK | |
| `delta_cents` | int | + 는 충전(recharge/topup), - 는 AI 사용 차감 |
| `balance_after_cents` | int | 이 row 이후 paid 잔액 (캐시) |
| `reason` | enum | `ai_usage` / `auto_recharge` / `manual_topup` / `refund_reverse` |
| `ref_type` | enum | `usage_claim` / `polar_order` / `manual_admin` |
| `ref_id` | text | 소스 문서 ID |
| `period_start` | timestamptz | 결제 주기 시작 |
| `period_end` | timestamptz | 결제 주기 종료 |
| `metadata` | jsonb | model, input_tokens, output_tokens, conversation_id 등 |

**INV:** `balance_after_cents = SUM(delta_cents)` per organization.
**Unique:** `(organization_id, ref_type, ref_id)` — 멱등 보장.

---

### `payment_extra_usage_settings` (추가 사용량 설정)

Organization 당 1 row. Extra usage 토글, 월간 한도, 자동 충전 설정.

| 컬럼 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `organization_id` | text FK UNIQUE | | |
| `enabled` | bool | false | Extra usage 활성화 (Anthropic 패턴 토글) |
| `monthly_limit_cents` | int | 0 | 월간 지출 한도 (Pro=5000, Team=20000) |
| `auto_recharge_enabled` | bool | false | 자동 충전 여부 |
| `auto_recharge_threshold_cents` | int | 500 | 잔액 < $5 시 trigger |
| `auto_recharge_package_id` | uuid FK? | | 자동 충전 패키지 |
| `monthly_recharge_cap_count` | int | 5 | 월 자동 결제 최대 횟수 |
| `monthly_recharge_cap_cents` | int? | | 월 자동 결제 최대 금액 (선택) |

---

### `payment_usage_reserves` (In-flight AI 예약)

AI 호출 전 pessimistic balance reservation. Reserve → Claim/Cancel 패턴.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `organization_id` | text FK | |
| `estimate_cents` | int | 예상 사용량 (cents) |
| `status` | enum | `reserved` / `claimed` / `cancelled` / `expired` |
| `ref_type` | enum | `ai_call` |
| `ref_id` | text | AI service 측 idempotency key |
| `expires_at` | timestamptz | 5분 후 자동 만료 |
| `claimed_actual_cents` | int? | claim 시 실제 사용량 |
| `claimed_at` | timestamptz? | |
| `cancelled_at` | timestamptz? | |

**INV:** `(organization_id, ref_type, ref_id)` UNIQUE WHERE status='reserved'.

---

### `payment_recharge_history` (자동 충전 이력)

auto-recharge 발생 기록. idempotency_key 로 중복 충전 방지.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `organization_id` | text FK | |
| `period_start` | timestamptz | 결제 주기 시작 |
| `period_end` | timestamptz | 결제 주기 종료 |
| `trigger_reason` | enum | `threshold` / `manual` |
| `package_id` | uuid FK | 충전 패키지 |
| `amount_cents` | int | 충전 금액 |
| `idempotency_key` | text | `{orgId}:{period_start}:{sequence_in_cycle}` |
| `polar_order_id` | text? | webhook 도래 시 채움 |
| `status` | enum | `pending` / `paid` / `failed` / `cancelled` / `timeout` |
| `attempted_at` | timestamptz | 시도 시각 |
| `completed_at` | timestamptz? | 완료 시각 |
| `timeout_at` | timestamptz? | timeout 처리 시각 |

**INV:** `(organization_id, idempotency_key)` UNIQUE — 이중 충전 방지.

---

## 마이그레이션 히스토리

| 번호 | 내용 |
|------|------|
| 0001~0008 | PR #56 v1 기반 스키마 (plans, subscriptions, orders, credit_ledger, top_up_packages, coupons, audit_log, subscription_events) |
| 0009 | `payment_pending_plan_changes` + enum (PR #62) |
| 0010 | status enum pgEnum 정착 (text → enum cast) |
| 0011 | `payment_usage_ledger` + `payment_extra_usage_settings` + `payment_usage_reserves` + `payment_recharge_history` + `payment_subscriptions.cached_paid_balance_cents` (PR #66) |
| 0012 | `payment_credit_ledger` reason enum 확장 (`plan_change_grant`, `plan_change_revoke`) |
