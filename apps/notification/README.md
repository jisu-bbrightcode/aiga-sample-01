# aiga-notification (PB-NOTI-001) — `notification.core`

공통 알림 서비스 기반. 가입/인증, 비밀번호 재설정, 결제, 주요 서비스 이벤트에
필요한 **provider-agnostic NotificationService 포트 · 템플릿 키 레지스트리 ·
채널 라우팅 · 발송 이력/재시도 정책**을 한 곳에서 제공한다.

> **EXTEND** of `product-builder-base` @`111d7721`
> (`packages/features/notification` in-app inbox + `packages/features/email`
> Resend/`email_logs`). 새 코드가 아니라 기존 capability의 customer/provider
> delta. Flotter는 reference로만 추적(복사 대상 아님).

## 왜 EXTEND인가

base는 두 capability로 갈라져 있다:

| base capability | 가진 것 | 없는 것 |
|---|---|---|
| `packages/features/notification` | in-app inbox + WebSocket gateway | 템플릿, 외부 발송, 재시도 |
| `packages/features/email` | `EmailProvider.send()` 포트 · `ResendProvider` · 템플릿 서비스 · `email_logs`(status/providerMessageId/retryCount/error) | email 외 채널, 채널 라우팅 |

이 capability는 그 둘을 하나의 채널-불문 서비스로 통합하고, 빠진 delta만 구현한다.

## 구조 (framework-agnostic core + nest 어댑터)

```
lib/
  types.ts                 # 포트/타입: NotificationChannelProvider, History, …
  template-registry.ts     # <domain>.<event> 템플릿 키 레지스트리 (불변)
  channel-router.ts        # feature 선택값 → 채널 라우팅 결정
  retry-policy.ts          # 지수 백오프 + 재시도 판정
  history-store.ts         # 발송 이력 포트 + in-memory 구현
  schema.ts                # notification_logs 마이그레이션 (email_logs 확장)
  providers/
    resend.ts              # email 채널 (base ResendProvider 확장)
    alimtalk.ts            # 알림톡 채널 (NEW, 동일 포트)
    inapp.ts               # in-app inbox 채널 (base inbox REUSE)
  notification-service.ts  # 오케스트레이터 = capability 포트
nest/
  notification.factory.ts  # apps/server DI 조립 (env + feature → providers)
```

## 사용 (apps/server)

```ts
import { createNotificationService } from 'aiga-notification/nest';

const notifications = createNotificationService({
  features: { email: true, alimtalk: true },   // PB-DECIDE-001 feature 선택
  history: drizzleHistoryStore,                 // notification_logs (schema.ts)
  inboxSink: baseInboxRepo.append,              // base notification inbox
  resend:   { from: env.MAIL_FROM, transport: resendFetch(env.RESEND_API_KEY) },
  alimtalk: { senderKey: env.KAKAO_SENDER_KEY, transport: alimtalkFetch(env) },
});

await notifications.send({
  templateKey: 'payment.receipt',
  recipient: { email, phone, userId },
  vars: { orderId, amount },
  idempotencyKey: `receipt:${orderId}`,
});
```

## Acceptance criteria 매핑

| 기준 | 충족 위치 |
|---|---|
| 신규 알림 = 템플릿 키 + 채널 설정으로 확장 | `template-registry.ts` (불변 `register`, `<domain>.<event>` 검증) |
| Email(Resend)/알림톡 feature 선택값이 채널 결정에 반영 | `channel-router.ts` (`ChannelFeatureConfig` 교집합) + `nest/notification.factory.ts` (feature on이면 transport 필수) |
| 발송 이력 + 실패 재시도 정책 정의 | `history-store.ts` + `schema.ts`(notification_logs) + `retry-policy.ts` |

## 검증

```bash
npm install
npm run typecheck   # tsc --noEmit (strict) → 0 errors
npm test            # node --test → 44 passing
```

## 납품 메모

- 기본 DB/배포: Neon(Postgres) + Vercel (PB-REPO-001 §6). `notification_logs`
  마이그레이션은 `schema.ts`의 `NOTIFICATION_LOGS_UP_SQL`.
- 채널 transport는 주입식 — 실제 `fetch` 와이어링(`api.resend.com`,
  알림톡 게이트웨이) + env(`RESEND_API_KEY`, `KAKAO_SENDER_KEY`)는 PB-REPO-001
  seed 시 apps/server에 vendoring.
- 개인정보: 이력의 `to`는 redactable 주소만 저장(RRN/KCB CI·DI 금지,
  PB-API-001 §1.6 / PB-LOG-001 정렬).
