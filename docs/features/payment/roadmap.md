# 로드맵 (Roadmap)

현재까지 완료된 v1~v3 결제 기반 위에 올라올 후속 개선 목록입니다.

---

## 완료 (v1 ~ v3)

| PR | 내용 |
|----|------|
| #56 v1 | Polar.sh 기반 구독 + checkout + webhook + credit ledger |
| #62 plan-change v2 | 플랜 변경 / 해지·환불 / 해지 취소 Polar 동기화 |
| #66 credit-extra-usage v1 | AI metering + auto-recharge + Anthropic 패턴 UI |

---

## v1.1 — 단기 Follow-up (다음 PR)

아래 항목은 설계에서 "별도 PR" 로 명시된 미완료 항목입니다.

### AI Service 측 계기 연결 (Instrumentation)

**내용:** `apps/server/src/ai/*` 에서 실제 AI 호출 전후로 `ai.reserve` / `ai.claim` / `ai.cancel` 을 호출하도록 wrapping.

**현재 상태:** tRPC endpoint 는 구현됨. AI service 측 호출 코드 미연결.

**우선순위:** 높음 — 연결 없이는 metering 이 실제로 동작하지 않음.

---

### LimitDialog PackageSelector

**내용:** LimitDialog 안의 자동 충전 패키지 선택 UI. 현재 `auto_recharge_package_id` 설정이 가능하지만 패키지 목록을 보여주는 드롭다운이 미완성.

---

### `triggerManualTopup` customerExternalId 통일

**내용:** `createTopUpCheckout` 가 `customerExternalId: ctx.user.id` 를 사용하는 반면, auto-recharge 는 org 레벨로 처리. v1.1 에서 orgId 로 통일.

---

### Polar Customer Portal 통합

**내용:** 사용자가 Polar 에서 직접 결제 수단을 관리할 수 있는 Customer Portal 링크 추가.

---

### Usage History Graph

**내용:** 결제 사용량 페이지에 일별 AI 사용량 차트 (현재는 목록만 표시).

---

### Email / Slack 알림

**내용:** 현재 in-app notification 만 구현. 80%/100% 한도 도달, 자동 충전 완료/실패, 구독 종료 예정 등의 외부 채널 알림.

---

### `payment_pending_refunds` 테이블 (Refund Orphan 자동 재시도)

**내용:** `cancelImmediatelyWithRefund` 에서 revoke 성공 + refund 실패 시 현재는 운영자 수동 처리. 자동 retry 를 위한 pending_refunds 테이블 도입.

---

## v2 — 중기 후보

### Multi-currency (KRW 지원)

한국 원화 결제 지원. 한국 PG (포트원 / 토스페이 / 카카오페이) 통합.

### Stripe 통합 옵션

Polar.sh 외 Stripe 를 선택적으로 사용할 수 있는 adapter 레이어.

### Team Seat 별 한도 분배

현재 extra usage settings 은 org 레벨. 팀원별 개별 AI 사용 한도 배분.

### Usage Forecast UI

"이번 달 예상 총 청구액 $XX" 예측 표시. 사용 패턴 기반 추정.

### Reconcile Cron 활성화

현재 TODO 로 남은 월간 자동 reconcile cron (DB ↔ Polar 불일치 자동 감지).

---

## v3 — 장기 후보

### Prepaid-only 모드

구독 없이 크레딧만 충전해서 사용하는 prepaid 결제 모드.

### Enterprise 맞춤 계약

대규모 팀을 위한 custom pricing, 볼륨 할인, 연간 선불 계약.

### License / Affiliate / Referral

파트너십 기반 결제 확장.

---

## 알려진 기술 부채

| 항목 | 위치 | 설명 |
|------|------|------|
| `reconcile.cron` TODO | `scheduler/reconcile.cron.ts` | Phase 15 에서 활성화 예정 |
| Admin UI `releaseSoftSuspend` | `admin.router` | 구현 예정 |
| audit_log hash chain | `J2` | 감사 로그 무결성 검증 미구현 |
| bounce/spam 추적 | `L3` | 이메일 bounce 처리 미구현 |
| mrrDelta30d 정확 계산 | 대시보드 | snapshot 테이블 필요 |
