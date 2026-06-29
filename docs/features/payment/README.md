# 결제 도메인 (Payment Domain)

Product Builder의 결제 시스템 전체 문서 진입점입니다. 3개 PR 에 걸쳐 구축된 기능을 한곳에서 이해할 수 있습니다.

---

## 구축 히스토리

| PR | 브랜치 | 내용 | 상태 |
|----|--------|------|------|
| #56 (v1) | `feat/payment-v1` | Polar.sh 기반 구독 + checkout + webhook + credit ledger | 머지 완료 |
| #62 (plan-change v2) | `feat/payment-plan-change-v2` | 플랜 변경 / 해지·환불 / 해지 취소 Polar 동기화 | 머지 완료 |
| #66 (credit/extra-usage v1) | `feat/credit-extra-usage` | AI metering + 자동 충전 + 추가 사용량 UI | 머지 완료 |

---

## 핵심 기능 5가지

### 1. 구독 (Subscription)
사용자가 Free · Pro · Team 플랜을 선택하고 Polar.sh 를 통해 결제합니다. 구독 상태(trialing / active / past_due / grace / canceled)가 Polar webhook 을 통해 DB 에 실시간 동기화됩니다.

### 2. 플랜 변경 (Plan Change)
업그레이드 · 다운그레이드 · cycle 변경(월간↔연간)을 지원합니다. 업그레이드는 즉시 차액 결제, 다운그레이드는 결제 주기 종료 시 자동 적용됩니다.

### 3. 해지 · 환불 (Cancellation & Refund)
결제 후 14일 이내라면 즉시 환불 + 종료가 가능합니다. 14일 이후에는 결제 주기 종료 후 자동 종료를 선택합니다. 해지 예약 후 마음이 바뀌면 예약을 취소(uncancel)할 수 있습니다.

### 4. Credit · Extra Usage
AI 사용량을 cents 단위로 추적합니다. Plan 에 포함된 크레딧(included credit)을 먼저 소진하고, 이후 유료 잔액(paid balance)에서 차감합니다. 사용자는 월간 지출 한도와 자동 충전 여부를 직접 설정합니다.

### 5. 자동 충전 (Auto-Recharge)
유료 잔액이 설정된 임계값 아래로 떨어지면 저장된 패키지를 자동 결제합니다. 동시 중복 충전을 Advisory Lock + idempotency key 로 차단합니다.

---

## 문서 인덱스

| 문서 | 내용 |
|------|------|
| [architecture.md](./architecture.md) | 시스템 아키텍처 · Service map · Data flow |
| [data-model.md](./data-model.md) | DB 스키마 전체 · ER 다이어그램 · INV |
| [subscription-lifecycle.md](./subscription-lifecycle.md) | 구독 상태 머신 · Webhook 동기화 |
| [plan-change-flows.md](./plan-change-flows.md) | 5 kind 분류 · preview · changePlanV2 |
| [cancellation-and-refund.md](./cancellation-and-refund.md) | 14일 환불 · cancel mode · uncancel |
| [credit-and-extra-usage.md](./credit-and-extra-usage.md) | AI metering · 차감 우선순위 · Reserve/Claim |
| [auto-recharge.md](./auto-recharge.md) | threshold trigger · race 차단 · idempotency |
| [webhook-events.md](./webhook-events.md) | Polar webhook 이벤트 · dispatcher |
| [api-reference.md](./api-reference.md) | tRPC endpoint 카탈로그 |
| [ui-components.md](./ui-components.md) | frontend 컴포넌트 카탈로그 |
| [user-flows.md](./user-flows.md) | 12 사용자 시나리오 journey |
| [admin-tools.md](./admin-tools.md) | 관리자 도구 |
| [operations.md](./operations.md) | 운영 절차 · on-call 시나리오 |
| [glossary.md](./glossary.md) | 용어집 |
| [roadmap.md](./roadmap.md) | v1.1 follow-up · v2 후보 |

---

## 빠른 시작

### 개발자
1. [architecture.md](./architecture.md) — Service map 으로 전체 그림 파악
2. [data-model.md](./data-model.md) — DB 스키마 확인
3. [api-reference.md](./api-reference.md) — tRPC endpoint 시그니처 확인
4. 해당 도메인 문서 (plan-change-flows, credit-and-extra-usage 등)

### 디자이너
1. [user-flows.md](./user-flows.md) — 12 사용자 여정 확인
2. [ui-components.md](./ui-components.md) — 컴포넌트 구성 파악

### 운영자
1. [operations.md](./operations.md) — 일상 점검 · on-call 절차
2. [admin-tools.md](./admin-tools.md) — 관리자 도구 사용법
3. [webhook-events.md](./webhook-events.md) — webhook 재전송 절차

---

## 외부 시스템 의존성

| 시스템 | 역할 | 비고 |
|--------|------|------|
| **Polar.sh** | 결제 처리 · 구독 관리 · 환불 | sandbox-api.polar.sh (개발), api.polar.sh (운영) |
| **ngrok / cloudflared** | Webhook 터널 (개발 환경) | sandbox dev tunnel; URL 변경 시 webhook endpoint 갱신 필요 |
| **Better Auth** | 인증 · organization 관리 | `ctx.activeOrganizationId` 가 결제의 단위 |
| **Neon DB (PostgreSQL)** | 영속 데이터 저장 | Drizzle ORM |

---

## 코드 위치

```
packages/features/payment/     — 백엔드 (NestJS + tRPC)
  service/                     — 비즈니스 로직 (11개 service)
  trpc/                        — tRPC router (auth / admin / public)
  scheduler/                   — cron (pending-plan-change, usage-reserve, dunning, reconcile)
  webhooks/                    — Polar webhook dispatcher
  common/                      — errors, types, constants

packages/drizzle/src/schema/features/payment/   — DB 스키마 (17개 파일)

apps/app/src/features/payment/   — 프론트엔드 (React)
  pages/                         — 페이지 (my-subscription, upgrade, top-up 등)
  components/                    — UI 컴포넌트
  hooks/                         — React Query hooks
```
