# 해지 · 환불 (Cancellation & Refund)

구독을 종료하는 두 가지 방법과 환불 정책을 설명합니다.

---

## 14일 환불 정책

Product Builder는 EU 표준 14일 무조건 환불 정책을 적용합니다.

```
환불 가능 조건:
  now <= subscription.current_period_start + 14일 (inclusive)

예시:
  결제일: 2026-05-01 10:00 UTC
  환불 마감: 2026-05-15 10:00 UTC (14일 inclusive)
  2026-05-15 09:59 → 환불 가능
  2026-05-15 10:01 → 환불 불가 (mode at_period_end 만 가능)
```

**UI 동작:** CancelDialog 가 현재 시각과 `current_period_start + 14d` 를 비교해서 14일 이내면 두 옵션을, 이후면 한 옵션만 표시합니다.

---

## 해지 Mode 2가지

### Mode 1: `at_period_end` — 주기 종료 후 해지

결제 주기가 끝날 때까지 계속 이용하고, 이후 자동 종료합니다.

```
흐름:
  1. PolarAdapter.updateSubscription(polar_sub_id, {cancel_at_period_end: true})
     [Polar API 호출은 tx 밖]
  2. DB mirror:
     UPDATE payment_subscriptions SET
       cancel_at_period_end = true,
       canceled_at = now()
  3. Audit log: action='cancel_at_period_end'
  4. 반환: { effectiveAt: 'cycle_end', cancelAt: current_period_end, refundEligible }

  구독은 current_period_end 까지 유지됨.
  Polar 가 주기 종료 시 subscription.canceled webhook 발행 → DB status='canceled'.
```

**UI:** 구독 카드에 "YYYY-MM-DD 에 종료 예정" + [해지 취소] 버튼 표시.

---

### Mode 2: `with_refund` — 즉시 환불 + 종료

14일 이내에만 선택 가능. 즉시 결제 취소되고 환불 처리됩니다.

```
흐름:
  1. 서버 측 14일 윈도우 검증:
     if (now > sub.currentPeriodStart + 14d) throw 'refund_window_closed'

  2. db.transaction(async tx => {
       // Polar 즉시 취소 (revoke)
       await polar.revokeSubscription(polar_sub_id)
       // 환불
       await refundService.refundOrder(latestOrderId, { full: true })
       // DB mirror
       UPDATE payment_subscriptions SET
         status = 'canceled',
         canceled_at = now(),
         current_period_end = now()
       // Audit log
       AuditService.log('cancel_with_refund', { refundedCents, orderId })
     })

  3. 반환: { refundedCents, orderId }
```

**⚠️ Refund Orphan 리스크:** Polar revoke 성공 + refund 실패 시 구독은 종료됐으나 환불이 없는 상태가 됩니다. 이 경우 audit 로그 기록 + 운영자 알림 채널 발송 → 관리자가 수동 환불 처리 (`admin.router.refundOrder`).

자동 retry 는 v2.1 `payment_pending_refunds` 테이블 도입 시 추가 예정.

---

## 해지 취소 (Uncancel)

`cancel_at_period_end=true` 상태에서 마음이 바뀐 경우 해지를 취소합니다.

```
흐름:
  1. PolarAdapter.updateSubscription(polar_sub_id, {cancel_at_period_end: false})
     [tx 밖]
  2. DB mirror:
     UPDATE payment_subscriptions SET
       cancel_at_period_end = false,
       canceled_at = NULL
  3. Audit log: action='uncancel'
  4. 반환: { ok: true }
```

14일 환불 윈도우 만료 후에도 uncancel 가능합니다. 다음 cycle 에 정상 결제됩니다.

**멱등:** 이미 `cancel_at_period_end=false` 인 경우 → Polar 호출 없이 바로 `{ ok: true }` 반환.

---

## comp_* 구독 차단

`polar_subscription_id` 가 `comp_` 로 시작하는 관리자 발급 구독은 해지 관련 메서드(`scheduleCancelAtPeriodEnd`, `cancelImmediatelyWithRefund`, `uncancelSubscription`)를 지원하지 않습니다. 즉시 에러를 던집니다.

관리자 발급 구독은 `admin.router.cancelSubscriptionNow` 로 종료합니다.

---

## 에러 매핑

| 에러 코드 | HTTP | 사용자 메시지 |
|-----------|------|--------------|
| `refund_window_closed` | 422 | "이미 14일이 지나 즉시 환불이 불가합니다. 다음 결제일까지 이용 후 종료됩니다." |
| `subscription_not_active` | 400 | "활성 구독이 없습니다." |
| `already_canceled` | 400 | "이미 취소된 구독입니다." |
| Polar 5xx | 500 | "결제 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요." |

**UI 에러 처리:**
- `refund_window_closed` → CancelDialog 가 자동으로 `at_period_end` 모드로 fallback
- 기타 에러 → `<Toaster>` toast + 다이얼로그 안 인라인 메시지

---

## CancelDialog UI

```
[취소 사유 선택]

(14일 이내인 경우 두 옵션)
  ⓪ 결제 주기 종료까지 이용 (2026-05-27 까지)
  ⓪ 즉시 종료 + ₩13,900 환불

(14일 이후인 경우 한 옵션)
  ⓪ 결제 주기 종료까지 이용 (2026-05-27 까지)

[취소 진행] [닫기]
```

---

## 참조

- 구독 상태: [subscription-lifecycle.md](./subscription-lifecycle.md)
- 관련 tRPC endpoint: [api-reference.md#cancelSubscription](./api-reference.md)
- 관련 UI: [ui-components.md#canceldialog](./ui-components.md)
- 운영 절차: [operations.md](./operations.md)
