# 용어집 (Glossary)

결제 도메인에서 사용하는 핵심 용어를 정리합니다.

---

## Product Builder 도메인 용어

| 용어 | 영문 | 정의 |
|------|------|------|
| **구독** | Subscription | 플랜에 대한 정기 결제 계약. org 당 최대 1개 활성 구독. |
| **플랜** | Plan | 구독 티어 (Free / Pro / Team). 포함 크레딧, 가격, cycle 이 다름. |
| **크레딧** | Credit | Plan 에 포함된 기본 사용 단위. 1 credit = 1 cent (USD). AI 사용 시 먼저 차감. |
| **Included Credit** | — | 구독 플랜에 기본 포함된 크레딧. 주기 시작 시 지급, 주기 종료 시 만료. |
| **Paid Balance** | — | 유료로 충전한 잔액 (auto-recharge 또는 수동 top-up). Paid Usage Ledger 로 추적. |
| **추가 사용량** | Extra Usage | Plan 포함 크레딧 소진 후 별도 과금되는 AI 사용량. `payment_usage_ledger` 로 추적. |
| **결제 주기** | Billing Cycle | 월간(Monthly) 또는 연간(Yearly). 주기 시작 시 크레딧 지급, 주기 종료 시 갱신. |
| **자동 충전** | Auto-Recharge | 유료 잔액이 임계값 아래로 떨어지면 저장된 패키지를 자동 결제. OpenAI 패턴. |
| **임계값** | Threshold | 자동 충전 trigger 조건. 잔액 < threshold 시 충전 시작. 기본값 $5. |
| **예약** | Reserve | AI 호출 전 예상 사용량을 잠시 잠가두는 pessimistic 잔액 예약. |
| **확정** | Claim | AI 호출 성공 후 실제 사용량을 ledger 에 기록하고 예약을 해제. |
| **해지 예약** | Cancel at Period End | 현재 결제 주기가 끝날 때 구독이 자동 종료되도록 예약. |
| **즉시 환불** | Immediate Refund | 14일 이내 즉시 취소 + 전액 환불. EU 표준 정책. |
| **해지 취소** | Uncancel | 해지 예약을 취소해 구독을 정상 상태로 복귀. |
| **다운그레이드 지연** | Deferred Downgrade | 더 저렴한 플랜으로 변경 시 즉시 처리하지 않고 결제 주기 종료 시 적용. |
| **크레딧 장부** | Credit Ledger | 크레딧 입출 기록을 모아둔 append-only 장부 (이벤트 소싱). |
| **보정 구독** | Comp Subscription | Polar 없이 DB-only 로 발급한 관리자용 구독 (`polar_subscription_id` = `comp_*`). |
| **월간 한도** | Monthly Limit | 이번 달 최대 AI 사용 금액. 사용자가 직접 설정 가능. |
| **충전 패키지** | Top-up Package | 일회성 유료 잔액 충전 상품 ($10 / $50 / $200). |

---

## 결제 상태 (Subscription Status)

| 상태 | 영문 | 설명 |
|------|------|------|
| **체험 중** | trialing | 무료 체험 기간. 결제 없음. |
| **정상** | active | 구독 활성 상태. |
| **결제 지연** | past_due | 결제 실패. Polar 재시도 중. |
| **유예** | grace | 7일 유예 기간. 기능 제한. |
| **종료** | canceled | 구독 완전 종료. |

---

## 플랜 변경 종류 (Plan Change Kind)

| Kind | 설명 |
|------|------|
| **upgrade** | 같은 cycle, 더 비싼 플랜으로 즉시 변경 |
| **downgrade** | 같은 cycle, 더 저렴한 플랜으로 주기 종료 시 변경 |
| **cycle-up** | 월간 → 연간 전환 (즉시 처리) |
| **cycle-down** | 연간 → 월간 전환 (즉시 처리) |
| **noop** | 동일 플랜 변경 시도 → 오류 |

---

## Polar 측 용어

| Polar 용어 | 우리 시스템 대응 | 설명 |
|-----------|----------------|------|
| Checkout | — | 결제 페이지. `createCheckout` 로 URL 생성. |
| Customer | `payment_subscriptions.userId` | Polar 고객 ID. `customerExternalId` = 우리 user.id. |
| Product | `payment_plans.polar_product_id` | Polar 상품. 플랜 하나당 하나. |
| Price | `payment_plans.polar_price_id` | 상품의 가격 설정. |
| Subscription | `payment_subscriptions.polar_subscription_id` | Polar 구독 레코드. |
| Order | `payment_orders.polar_order_id` | 결제 건 (인보이스). |
| Discount | `payment_coupons.polar_discount_id` | 할인 코드 / 쿠폰. |
| Refund | — | 환불 처리. `refundOrder` API 로 발행. |
| Webhook | — | 결제 이벤트 HTTP 알림. |
| Proration | — | 주기 중간 플랜 변경 시 일할 계산. |
| `invoice` proration | — | 잔액 즉시 청구 (upgrade 기본). |
| `prorate` proration | — | 잔액 다음 청구에 크레딧 (cycle-down). |
| `next_period` proration | — | proration 없이 다음 주기부터 적용 (downgrade). |
| Revoke | — | 구독 즉시 취소 (환불 없음). `revokeSubscription` 사용. |

---

## 기술 패턴 용어

| 용어 | 설명 |
|------|------|
| **Append-only Ledger** | 기록을 수정하지 않고 새 행만 추가하는 이벤트 소싱 패턴. 감사 가능성 보장. |
| **Idempotency Key** | 같은 요청을 여러 번 보내도 결과가 달라지지 않도록 하는 중복 방지 키. |
| **Advisory Lock** | PostgreSQL `pg_advisory_xact_lock` — DB 레벨 분산 락. 동시 충전 race 차단. |
| **Reserve/Claim** | AI 호출 전 잔액 잠금(Reserve) → 호출 후 실제 금액 확정(Claim). Over-billing 방지. |
| **Webhook Mirror** | Polar 의 이벤트를 우리 DB 에 동기 복제. 동기 호출 실패 시 백업 보정. |
| **Partial Unique Index** | `WHERE status='...'` 조건이 있는 부분 인덱스. pending 상태에만 UNIQUE 적용. |
| **INV** | Invariant — 시스템이 항상 유지해야 하는 불변 조건. 테스트로 검증. |
