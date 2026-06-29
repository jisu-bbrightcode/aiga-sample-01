# Credit + Extra Usage v1 — 2026-04-27

## 변경사항

AI 토큰 사용량을 cents 단위 metered usage 로 추적하고, plan included quota 외 추가 사용을 자동/수동 충전 으로 처리한다. UI 는 Anthropic Claude for Work "추가 사용량" 카드 패턴.

### 새로 지원하는 시나리오
- **AI usage metering** — Reserve/Claim 패턴 (advisory lock 으로 race 차단)
- **자동 충전** — 잔액 < threshold 도달 시 saved package 자동 결제 (OpenAI 표준 패턴)
- **월간 지출 한도** — 사용자 직접 설정, plan default (Pro $50, Team $200)
- **Anthropic 패턴 UI** — 토글 / progress / 한도 조정 / 잔액 / 자동 새로고침
- **Plan 변경 시 credit 처리** — upgrade 차액 즉시 grant, cycle 변경 시 잔액 환원 + 새 cycle grant
- **80%/100% 한도 알림** — in-app notification (cycle 안 중복 방지)

### 기술 변경
- 4 신규 테이블: payment_usage_ledger / payment_extra_usage_settings / payment_usage_reserves / payment_recharge_history
- 4 신규 service: AiUsageMeterService / ExtraUsageService / AutoRechargeService / UsageNotificationService
- 신규 cron: UsageReserveCron (reserve expiry + recharge timeout sweep)
- payment_subscriptions.cached_paid_balance_cents 캐시 컬럼 (30s polling cheap read)
- tRPC ai.{reserve, claim, cancel} + extraUsage.{getSettings, updateSettings, getStats, triggerManualTopup}
- ExtraUsageCard + LimitDialog 신규 컴포넌트
- payment_audit_log enum 6 신규 액션 (auto_recharge_*, usage_limit_reached, extra_usage_settings_updated, usage_reserve_expired)
- paymentCreditLedger reason enum 확장 (plan_change_grant, plan_change_revoke, subscription_event)

### 운영 노트
- **차감 우선순위**: included credit (paymentCreditLedger) 먼저 → paid usage_ledger → auto-recharge
- **단위 매핑**: 1 included credit = 1 cent (UI 환산 표시)
- **race 차단**: pg_advisory_xact_lock + idempotency_key + FOR UPDATE
- **Polar 호출 tx 밖** (T5 plan-change v2 학습 일관)
- **comp_* sub 차단** (admin 발급 sub 은 v2 미지원)
- **Free plan**: paid usage 적용 X (Pro/Team 만)

### 마이그레이션
- 0011: payment_usage_ledger / payment_extra_usage_settings / payment_usage_reserves / payment_recharge_history + payment_subscriptions cached column + audit enum 6 신규
- 0012: payment_credit_ledger reason enum 확장 (plan_change_grant/revoke + subscription_event)

### 회귀 영향
- v1 paymentCreditLedger 기존 reason / lifecycle 그대로 보존
- v1 createTopUpCheckout (manual) 그대로 — UI 의 "추가 사용량 구매" 도 같은 endpoint 호출 (TODO v1.1: customerExternalId 통일)
- changePlanV2 의 mirror tx 안 credit 변경 추가 (PR #62 changePlanV2 통합)

### v1.1 follow-up (별도 PR)
- AI service 측 reserve/claim instrumentation (apps/server/src/ai/* 영역)
- ExtraUsageCard 의 PackageSelector (LimitDialog 안 자동 충전 패키지 선택)
- triggerManualTopup customerExternalId orgId 로 통일
- usage 분석 dashboard
- Email/Slack 알림 (in-app 만 v1)
- team seat 별 limit 분배
