# PB-NOTI-001 — 알림 서비스 기반 (`notification.core`)

| | |
|---|---|
| Issue | BBR-653 [PB-NOTI-001] |
| Decision | **EXTEND** — `notification.core` |
| Area / target | 서버/API · `apps/api` (delivery: `apps/notification` capability package) |
| Reuse source | `product-builder-base` @`111d7721` `packages/features/notification` + `packages/features/email` |
| Depends on | PB-AUTH-001 ✅ done · PB-PAY-002 ✅ done |
| Branch | `feat/pb-noti-001-notification-service` |
| Status | implemented + tested (tsc strict 0 err, `node --test` 44 pass); push gated by PB-REPO-001 / BBR-497 |

## 1. EXTEND 근거 (source-of-truth)

PB-BASE-001(@`111d7721`)에 기록된 base capability를 reference로 확인했다.
`notification.core`는 base의 **두** capability를 통합해야 한다:

- `packages/features/notification/` — in-app inbox + WebSocket gateway. 템플릿·외부발송·재시도 **없음**.
- `packages/features/email/` — `EmailProvider.send()` 포트 + `ResendProvider` + 템플릿 서비스, 그리고 `email_logs`(이미 `status`/`providerMessageId`/`retryCount`/`error` 보유 → 기존 발송이력+재시도 모델).

→ EXTEND = 이 둘을 채널-불문 서비스로 일반화하고 빠진 delta(채널 라우팅,
`<domain>.<event>` 레지스트리, 알림톡 채널, 통합 이력 테이블)만 구현.
base 로컬 미존재(`/Users/bright/...` maintainer host) → 문서화된 인터페이스 기준으로 구현.

## 2. Deliverables → 구현 매핑

| Deliverable | 모듈 |
|---|---|
| NotificationService 포트 | `lib/notification-service.ts` (+ `lib/types.ts` `NotificationChannelProvider`) |
| 템플릿 키 레지스트리 | `lib/template-registry.ts` (`<domain>.<event>`, 불변 register, 기본 AIGA 카탈로그) |
| 채널 라우팅 | `lib/channel-router.ts` (feature 선택값 ∩ 주소보유 ∩ 호출자허용) |
| 발송 이력/재시도 정책 | `lib/history-store.ts` + `lib/schema.ts`(`notification_logs`) + `lib/retry-policy.ts` |
| 채널 providers | `lib/providers/{resend,alimtalk,inapp}.ts` |
| apps/server 조립 | `nest/notification.factory.ts` (`createNotificationService`) |

## 3. Acceptance criteria

1. **신규 알림 = 템플릿 키 + 채널 설정으로 확장** — `TemplateRegistry.register()`는
   불변(새 레지스트리 반환)이며 `<domain>.<event>` 검증·채널별 renderer 필수.
   서비스 코드 변경 없이 카탈로그에 항목 추가만으로 알림 추가. ✅
2. **Email(Resend)/알림톡 feature 선택값이 채널 결정에 반영** —
   `routeChannels()`가 `ChannelFeatureConfig`와 템플릿 채널의 교집합을 계산,
   미선택 채널은 `feature_disabled`로 N/A-skip(삭제 아님). factory는 feature on인데
   transport 없으면 boot-time `NotificationConfigError`. ✅
3. **발송 이력 + 실패 재시도 정책 정의** — `notification_logs`(email_logs 확장:
   status/providerMessageId/retryCount/error + channel/template_key/correlation_id/
   idempotency_key, 부분 unique index로 멱등 보장). 재시도는 `retryable`일 때만
   지수 백오프, `retryCount` 영속화. ✅

## 4. 채널 정책

| 채널 | 출처 | 활성 조건 | 비고 |
|---|---|---|---|
| `inapp` | base inbox REUSE | 항상 | feature flag 없음 |
| `email` | base `ResendProvider` EXTEND | `features.email` + `RESEND_API_KEY` | 429/5xx/network = retryable |
| `alimtalk` | NEW(동일 포트) | `features.alimtalk` + 발신키 | 승인 template code 필수; client code permanent, 서버 code(≥3000) retryable |

미선택 feature는 관련 채널을 N/A-skip(워크플로 규칙: 삭제 아님).

## 5. 운영/납품 메모

- DB/배포: Neon + Vercel 고정. 마이그레이션 = `schema.ts` `NOTIFICATION_LOGS_UP_SQL`;
  실제 Drizzle 테이블 객체는 PB-REPO-001 seed 시 `packages/drizzle/**/notification`에 vendoring.
- transport는 주입식 → 실제 `fetch` 와이어링과 env(`RESEND_API_KEY`,
  `KAKAO_SENDER_KEY`/발신 프로필)는 apps/server 통합 시 추가. 본 capability는 secret 미포함.
- 개인정보: 이력 `to`는 redactable 주소만(RRN/KCB CI·DI 금지). render vars에 raw secret 금지.

## 6. 검증 로그

```
$ npx tsc --noEmit      → TypeScript: No errors found
$ node --test           → tests 44 / pass 44 / fail 0
```

## 7. 잔여 (PB-REPO-001 언블록 후)

- apps/server NestModule에 `createNotificationService` provider 바인딩 + 실제 transport/env.
- auth(비밀번호 재설정/인증메일)·payment(영수증/실패) 호출부 연결 — 호출부는 각 도메인 issue 소유.
- Neon에 `notification_logs` 마이그레이션 적용 + 발송 헬스체크(배포 evidence).
