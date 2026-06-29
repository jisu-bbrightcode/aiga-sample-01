# 관리자 도구 (Admin Tools)

`admin.router` 를 통해서만 접근 가능한 관리자 전용 기능입니다. 모든 실행은 `payment_audit_log` 에 기록됩니다.

---

## 권한

- `admin` 또는 `super_admin` 역할만 접근 가능
- 모든 뮤테이션에 `actorUserId` 자동 기록 (audit trail)

---

## 도구 목록

### compSubscription — 수동 구독 발급

Polar 결제 없이 DB-only 구독을 발급합니다. 내부 테스트, 사용자 보상, QA 환경 등에 사용.

```typescript
// Input:
{
  organizationId: string;
  planId: string;
  reason: string;      // 필수 — 발급 사유
  durationDays?: number;  // 기본값: plan 기본 주기
}
```

- `polar_subscription_id`: `comp_{uuid}` 형식 (Polar 와 무관)
- 발급된 구독은 v2 메서드(changePlan, cancel, uncancel) 미지원
- **종료:** `cancelSubscriptionNow` 로만 가능

---

### cancelSubscriptionNow — 즉시 취소

환불 없이 즉시 구독을 종료합니다.

```typescript
// Input:
{
  subscriptionId: string;
  reason: string;
}
```

- `polar_subscription_id` 가 있으면 `PolarAdapter.revokeSubscription` 호출
- comp_* 구독은 DB-only 즉시 취소
- Audit log: `cancel_now`

**사용 시점:** 어뷰징 감지, 계정 문제 해결, comp 구독 종료.

---

### extendTrialEnd — 체험 기간 연장

무료 체험 기간을 N일 연장합니다.

```typescript
// Input:
{
  subscriptionId: string;
  days: number;       // 1-90
  reason: string;
}
```

- DB: `trial_end = trial_end + days`
- Polar 에 변경 없음 (DB-only 연장, 실제 결제는 Polar 기준)
- **주의:** Polar 측 trial 기간과 불일치할 수 있음 — 복잡한 경우 Polar 대시보드에서 직접 처리 권장

---

### refundOrder — 환불 처리

특정 주문을 환불합니다.

```typescript
// Input:
{
  orderId: string;       // payment_orders.id (UUID)
  amountCents?: number;  // null=전액 환불
  reason: string;
}
```

- `PolarAdapter.refundOrder(polarOrderId, amountCents)`
- webhook `order.refunded` 도래 시 `payment_orders.refunded_amount_cents` 갱신
- Audit log: `manual_refund`

**사용 시점:** 자동 환불 실패(refund orphan), CS 요청 환불, 부분 환불.

---

### grantCredits — 크레딧 수동 지급

특정 조직에 included credit 을 지급합니다.

```typescript
// Input:
{
  organizationId: string;
  amount: number;       // credits (1 credit = 1 cent)
  reason: string;
}
```

- `payment_credit_ledger` INSERT (reason=`admin_grant`)
- Audit log: `admin_grant`

---

### createDiscount — 쿠폰 생성

Polar discount 와 연결된 쿠폰을 생성합니다.

```typescript
// Input:
{
  code: string;
  polarDiscountId: string;
  scope: "subscription" | "top_up" | "any";
  discountType: "percentage" | "fixed";
  discountValue: number;
  maxRedemptions?: number;
  expiresAt?: Date;
}
```

---

### getSubscription — 사용자 구독 조회

특정 org 의 구독 상태를 조회합니다.

```typescript
// Input: { organizationId: string }
// Returns: PaymentSubscription + plan 정보
```

CS 지원 시 사용자 구독 상태 확인에 사용.

---

### getLedgerHistory — Ledger 조회

특정 org 의 credit/usage ledger 이력을 조회합니다.

```typescript
// Input:
{
  organizationId: string;
  ledgerType: "credit" | "usage";
  limit?: number;
  cursor?: string;
}
```

---

### Webhook Redeliver (스크립트)

컨트롤러 버그 수정 후 놓친 이벤트 재처리:

```bash
pnpm tsx apps/server/scripts/redeliver-polar-webhooks.ts --dry-run --limit=100
pnpm tsx apps/server/scripts/redeliver-polar-webhooks.ts --limit=100
```

자세한 절차: [webhook-events.md#webhook-재전송](./webhook-events.md)

---

## 감사 로그 조회

모든 관리자 액션은 `payment_audit_log` 에 기록됩니다.

```sql
-- 특정 org 의 최근 관리자 액션 조회
SELECT * FROM payment_audit_log
WHERE target_org_id = '{orgId}'
ORDER BY created_at DESC
LIMIT 50;

-- 특정 관리자의 액션 조회
SELECT * FROM payment_audit_log
WHERE actor_user_id = '{adminUserId}'
ORDER BY created_at DESC
LIMIT 50;
```

---

## 참조

- 운영 절차: [operations.md](./operations.md)
- Audit log 스키마: [data-model.md#payment_audit_log](./data-model.md)
- Webhook 재전송: [webhook-events.md](./webhook-events.md)
