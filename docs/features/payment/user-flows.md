# 사용자 시나리오 Journey

실제 사용자가 결제 기능을 사용하는 12가지 시나리오를 단계별로 설명합니다.

---

## 1. 신규 가입 → Free 플랜 시작

**배경:** 처음 Product Builder에 가입한 사용자.

| 단계 | 사용자 행동 | 시스템 처리 |
|------|------------|------------|
| 1 | 이메일로 가입 | Better Auth: user + organization 생성 |
| 2 | — | `OrganizationService.create` 훅: `payment_extra_usage_settings` INSERT (default: enabled=false) |
| 3 | 서비스 진입 | `getMySubscription` → null 반환 |
| 4 | — | Free 플랜 자동 적용 (Polar 없음, DB-only) |
| 5 | 프로젝트 생성 | AI 사용 시 included credit 50 cents 범위 내 |

**데이터 상태:** subscription 없음, extra_usage_settings 기본값으로 row 존재.

---

## 2. Free → Pro 구독 시작

**배경:** Free 사용자가 Pro Monthly 로 업그레이드.

| 단계 | 사용자 행동 | 시스템 처리 |
|------|------------|------------|
| 1 | `/billing/upgrade` 방문 | `public.getPlans` 로 플랜 목록 표시 |
| 2 | "Pro Monthly · 시작하기" 클릭 | `createSubscriptionCheckout({ planId, billingCycle: 'monthly' })` |
| 3 | — | `PolarAdapter.createCheckout` → checkout URL |
| 4 | Polar 결제 페이지에서 카드 입력 | Polar 처리 |
| 5 | 결제 성공 → `/checkout-success` 리디렉트 | — |
| 6 | — | webhook: `subscription.created` → `payment_subscriptions` INSERT (status=trialing 또는 active) |
| 7 | — | webhook: `order.paid` → `payment_orders` INSERT + `payment_credit_ledger` INSERT (included credit grant) |
| 8 | `/billing/subscription` 새로고침 | `getMySubscription` → Pro 구독 반환 |

**Audit log:** subscription_grant (credit ledger).

---

## 3. Pro → Pro Plus 즉시 업그레이드

**배경:** Pro 사용자가 더 높은 티어로 즉시 변경.

| 단계 | 사용자 행동 | 시스템 처리 |
|------|------------|------------|
| 1 | `/billing/upgrade` → Pro Plus 카드 클릭 | `previewPlanChange({ targetPlanId })` |
| 2 | ChangePlanDialog 표시 | kind=upgrade, "₩X 즉시 결제" |
| 3 | "확인" 클릭 | `changePlan({ targetPlanId })` |
| 4 | — | `PolarAdapter.updateSubscription(proration_behavior: 'invoice')` |
| 5 | — | DB: `payment_subscriptions.plan_id` 갱신 |
| 6 | — | `CreditLedgerService.applyPlanChangeCredit` — 차액 credit grant |
| 7 | — | Audit log: change_plan_v2 {kind: 'upgrade', prorationCents} |
| 8 | 다이얼로그 닫힘, 구독 페이지 갱신 | 새 플랜 표시 |

---

## 4. Pro Plus → Pro 다운그레이드 예약

**배경:** 비용 절감을 위해 다음 달부터 저렴한 플랜으로 변경.

| 단계 | 사용자 행동 | 시스템 처리 |
|------|------------|------------|
| 1 | `/billing/upgrade` → Pro 카드 클릭 | `previewPlanChange({ targetPlanId })` |
| 2 | ChangePlanDialog | kind=downgrade, "다음 결제일 (2026-05-27) 부터 Pro 적용" |
| 3 | "확인" 클릭 | `changePlan({ targetPlanId })` |
| 4 | — | `payment_pending_plan_changes` INSERT (apply_at=current_period_end) |
| 5 | — | Audit log: schedule_downgrade |
| 6 | 구독 페이지 | "2026-05-27 부터 Pro로 변경 예정 [예약 취소]" 표시 |
| 7 | 2026-05-27 00:00 이후 | `PendingPlanChangeCron` 픽업 → Polar PATCH → DB plan_id 갱신 |

---

## 5. Monthly → Yearly 결제 주기 변경

**배경:** 연간 결제로 전환해 비용 절감.

| 단계 | 사용자 행동 | 시스템 처리 |
|------|------------|------------|
| 1 | Pro Yearly 카드 클릭 | `previewPlanChange` |
| 2 | ChangePlanDialog | kind=cycle-up, "₩큰 금액 즉시 결제 (연간 가격)" |
| 3 | 확인 | `PolarAdapter.updateSubscription(proration_behavior: 'invoice')` |
| 4 | — | Polar: 잔여 월간 잔액 크레딧 + 연간 즉시 청구 |
| 5 | — | DB: plan_id, period dates 갱신 |
| 6 | — | credit grant: 새 yearly 포함 크레딧 + 기존 잔액 비례 환원 |

---

## 6. 구독 해지 (주기 종료 예약)

**배경:** 이번 달까지만 쓰고 종료.

| 단계 | 사용자 행동 | 시스템 처리 |
|------|------------|------------|
| 1 | 구독 페이지 → "해지" 클릭 | CancelDialog 오픈 |
| 2 | 14일 이후이므로 한 옵션만 표시 | — |
| 3 | "결제 주기 종료까지 이용" 선택 → 확인 | `cancelSubscription({ mode: 'at_period_end' })` |
| 4 | — | `PolarAdapter.updateSubscription({ cancel_at_period_end: true })` |
| 5 | — | DB: cancel_at_period_end=true |
| 6 | — | Audit log: cancel_at_period_end |
| 7 | 구독 페이지 | "2026-05-27 에 종료 예정" + [해지 취소] 버튼 |
| 8 | 결제 주기 종료 시 | Polar webhook: subscription.canceled → status=canceled |

---

## 7. 14일 이내 즉시 환불

**배경:** 결제 5일 후 사용을 그만두고 싶음.

| 단계 | 사용자 행동 | 시스템 처리 |
|------|------------|------------|
| 1 | "해지" 클릭 | CancelDialog — 14일 이내이므로 두 옵션 표시 |
| 2 | "즉시 종료 + ₩13,900 환불" 선택 | — |
| 3 | 확인 | `cancelSubscription({ mode: 'with_refund' })` |
| 4 | — | 서버: `now <= period_start + 14d` 검증 |
| 5 | — | `polar.revokeSubscription` → 즉시 종료 |
| 6 | — | `refundService.refundOrder(latestOrderId, full=true)` |
| 7 | — | DB: status=canceled, canceled_at=now, current_period_end=now |
| 8 | — | Audit log: cancel_with_refund {refundedCents, orderId} |
| 9 | 구독 페이지 | "구독이 종료되었습니다" |

---

## 8. 해지 취소 (Uncancel)

**배경:** 해지 예약 후 마음이 바뀜.

| 단계 | 사용자 행동 | 시스템 처리 |
|------|------------|------------|
| 1 | "해지 취소 (구독 유지)" 버튼 클릭 | `uncancelSubscription()` |
| 2 | — | `PolarAdapter.updateSubscription({ cancel_at_period_end: false })` |
| 3 | — | DB: cancel_at_period_end=false, canceled_at=null |
| 4 | — | Audit log: uncancel |
| 5 | 구독 페이지 | 정상 active 상태로 복귀 |

---

## 9. AI Usage 발생 → Credit 차감

**배경:** 사용자가 Product Builder AI 기능을 사용.

| 단계 | 사용자 행동 | 시스템 처리 |
|------|------------|------------|
| 1 | AI 기능 사용 시작 | AI service → `ai.reserve({ estimate_cents: 200, refId })` |
| 2 | — | `AiUsageMeterService.reserve` — included balance 확인 → `payment_usage_reserves` INSERT |
| 3 | AI 응답 생성 | Anthropic/OpenAI API 호출 |
| 4 | — | AI service → `ai.claim({ reservationId, actualTokens, model })` |
| 5 | — | `model_pricing.calculate` → actual_cents |
| 6 | — | tx: paymentCreditLedger INSERT delta=-actual (included balance 충분 시) |
| 7 | — | tx: payment_usage_reserves UPDATE status=claimed |
| 8 | — | `UsageNotificationService.maybeNotify` (80% 체크) |

---

## 10. 잔액 부족 → 자동 충전

**배경:** AI 사용 중 paid 잔액이 threshold 아래로 떨어짐.

| 단계 | 사용자 행동 | 시스템 처리 |
|------|------------|------------|
| 1 | AI 기능 사용 | `ai.reserve` — balance < threshold 감지 |
| 2 | — | `AutoRechargeService.maybeTrigger` |
| 3 | — | advisory lock + pending 검사 + `payment_recharge_history` INSERT (pending) |
| 4 | — | `PolarAdapter.createCheckout` (idempotency_key 명시) |
| 5 | — | Polar 결제 처리 (~1-3초) |
| 6 | — | webhook: `order.paid` → `payment_usage_ledger` INSERT delta=+package_cents |
| 7 | — | `payment_subscriptions.cached_paid_balance_cents` UPDATE |
| 8 | — | `payment_recharge_history` UPDATE status=paid |
| 9 | 잔액 갱신됨 | UI: "처리 중" → 30초 후 새 잔액 표시 |

---

## 11. 80% / 100% 알림

**배경:** 이번 달 사용량이 급증.

| 단계 | 사용자 행동 | 시스템 처리 |
|------|------------|------------|
| 1 | AI 사용 중 | `ai.claim` 후 `UsageNotificationService.maybeNotify` |
| 2 | — | 누적 사용량 ≥ 80% → in-app notification 발행 (한 번만) |
| 3 | 알림 확인 | 알림 배너: "이번 달 사용량이 한도의 80%에 도달했습니다." |
| 4 | 계속 사용 | 100% 도달 → "한도에 도달했습니다." 알림 + AI 차단 |
| 5 | [한도 조정] 클릭 | `LimitDialog` → `updateExtraUsageSettings` |
| 6 | 즉시 반영 | AI 사용 재개 가능 |

---

## 12. 추가 사용량 수동 구매

**배경:** 자동 충전 없이 직접 잔액을 충전하고 싶음.

| 단계 | 사용자 행동 | 시스템 처리 |
|------|------------|------------|
| 1 | ExtraUsageCard → "추가 사용량 구매" 클릭 | 패키지 선택 UI (top-up 패키지 목록) |
| 2 | "$10 패키지" 선택 | `createTopUpCheckout({ packageId, successUrl })` |
| 3 | Polar checkout 결제 | — |
| 4 | — | webhook: `order.paid` → `payment_usage_ledger` INSERT delta=+1000 cents |
| 5 | — | `cached_paid_balance_cents` UPDATE |
| 6 | 구독 페이지 | 새 잔액 "$10.00 증가" 반영 |
