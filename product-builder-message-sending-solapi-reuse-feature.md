# Product Builder Base: SOLAPI Message Sending REUSE Feature Handoff

## 목적

기존 Product Builder의 `알림톡` feature 이름을 더 넓은 **메시지 발송** feature로 바꾼다.

`product-builder-base`에는 SOLAPI 기반 메시지 발송 capability를 재사용 가능한 feature로 먼저 구현한다. 최종 목표는 Product Builder에서 메시지 발송 선택 시 신규 임시 구현이 아니라 아래처럼 검증 가능한 REUSE source를 사용할 수 있게 만드는 것이다.

```text
product-builder-base:packages/features/message-sending/solapi@<tag-or-commit>
product-builder-base:packages/features/message-sending/schema@<tag-or-commit>
product-builder-base:packages/features/message-sending/rest-api@<tag-or-commit>
product-builder-base:apps/admin/features/message-sending@<tag-or-commit>
product-builder-base:tests/message-sending/reusable-checklist@<tag-or-commit>
```

## 이름 변경

Product Builder feature label:

```text
Before: 알림톡
After: 메시지 발송
```

내부 capability naming:

```text
notification.alimtalk.*        -> message-sending.solapi.*
notification.optional-channel  -> message-sending.optional-channel
```

하위 채널:

- SMS
- LMS
- MMS
- 카카오 알림톡
- 카카오 친구톡/브랜드 메시지, SOLAPI 공식 SDK와 계약/채널 설정에서 확인되는 경우

## 작업 위치

- 대상 repo: `/Users/bright/Projects/product-builder-base`
- 원격 repo: `https://github.com/BBrightcode-atlas/product-builder-base`
- 기준 branch: `develop`
- Paperclip/Product Builder repo는 템플릿과 issue 구조 참고용이다. 구현 코드는 Product Builder plugin repo가 아니라 `product-builder-base`에 넣는다.

## 절대 규칙

1. 추측 구현 금지.
   - SOLAPI 공식 문서, SDK 문서, 콘솔 설정, 발신번호/카카오 채널/템플릿 승인 상태에서 확인되지 않은 field, channel type, template field, result code를 추측 구현하지 않는다.
   - 알림톡 템플릿 변수, 버튼, 대체발송 payload는 공식 문서와 승인된 템플릿 정보 기준으로만 구현한다.

2. feature 이름은 `메시지 발송`으로 둔다.
   - UI/issue/template에서는 `알림톡`을 상위 feature명으로 쓰지 않는다.
   - `알림톡`은 SOLAPI 메시지 발송 feature의 하위 채널 중 하나다.

3. SOLAPI Node.js SDK 기준으로 구현한다.
   - 공식 예제는 Node.js SDK 5.5.1 기준이다.
   - SDK package는 `solapi`를 기준으로 확인한다.
   - server-side only로 사용하고 API key/secret을 클라이언트에 노출하지 않는다.

4. REST API, 관리자 화면, OpenAPI, 테스트를 함께 만든다.
   - 서버 발송 함수만 만들고 끝내지 않는다.
   - 운영자가 템플릿, 승인 상태, 테스트 발송, 실발송, 발송 이력, 실패/재시도, fallback을 확인할 수 있어야 한다.

5. 전화번호 형식은 공식 문서 기준으로 검증한다.
   - SOLAPI 발송 예제는 발신번호와 수신번호를 `01012345678` 형식으로 요청해야 하며 `+`, `-`, `*` 같은 특수문자를 넣지 말라고 안내한다.
   - DB 저장/관리자 입력/UI display는 필요하면 formatting을 허용하되, provider request 직전에는 공식 형식으로 정규화하고 검증한다.

6. 개인정보/마케팅 동의 정책을 분리한다.
   - 인증/거래성 메시지와 마케팅 메시지의 동의/수신거부/야간발송 정책을 분리한다.
   - 수신자 전화번호, 발송 본문, 변수값 저장 기간과 masking 정책을 정의한다.

## 공식 참조 URL

첫 구현 세션은 아래 URL을 열고, 각 API별 요청/응답/주의사항을 source map으로 남겨야 한다.

- SOLAPI Node.js 메시지 발송 예제: `https://solapi.com/developers/sdk/nodejs-sendingexample`
- SOLAPI Node.js SDK GitHub: `https://github.com/solapi/solapi-nodejs`
- SOLAPI Node.js SDK API reference: `https://solapi.github.io/solapi-nodejs/classes/index.SolapiMessageService.html`
- SOLAPI Developers: `https://developers.solapi.com/category/nodejs`

공식 문서에서 확인해야 하는 최소 항목:

- SDK 설치와 초기화
  - `solapi` package
  - API key / API secret 설정
  - server-side usage boundary

- 메시지 발송
  - SMS 발송 payload
  - LMS 발송 payload
  - MMS 발송 payload
  - 여러 건 발송 지원 방식
  - 발신번호/수신번호 형식
  - provider response와 message id

- 카카오 메시지
  - 알림톡 발송 payload
  - 친구톡/브랜드 메시지 지원 여부
  - pfId 또는 카카오 채널 식별자
  - templateId, template variables, buttons
  - 승인된 템플릿만 발송 가능한지
  - 알림톡 실패 시 SMS/LMS fallback 가능 여부와 payload

- 발송 결과/이력
  - 발송 요청 결과
  - 상태 조회 API
  - 실패 code/message
  - webhook/callback 제공 여부
  - 재시도 가능/불가 상태

- 운영 선행조건
  - 계정/잔액/과금
  - 발신번호 등록
  - 카카오 비즈채널/발신 프로필
  - 알림톡 템플릿 승인
  - 수신거부/광고성 표기/야간발송 제한

## 구현 산출물

### 1. Provider package

base repo 구조를 먼저 확인해서 맞춘다. 구조가 없다면 아래 형태를 권장한다.

```text
packages/features/message-sending/solapi/
  src/
    config.ts
    types.ts
    client.ts
    phone-number.ts
    send-sms.ts
    send-lms.ts
    send-mms.ts
    send-alimtalk.ts
    send-bulk.ts
    templates.ts
    fallback.ts
    status.ts
    webhook.ts
    index.ts
  README.md
```

필수 책임:

- SOLAPI API key / API secret / sender number config validation
- phone number normalization and validation
- SMS/LMS/MMS send
- 알림톡 send
- bulk send, 공식 SDK에서 지원되고 product requirement가 있을 때
- approved template mapping
- SMS/LMS fallback policy
- provider message id 저장
- send status normalization
- provider error normalization
- idempotency key handling
- rate limit/throttle guard
- webhook/status polling, 공식 제공 방식 확인 후 구현

### 2. DB/schema

기존 notification schema가 있으면 `message-sending`으로 확장/rename하고, 없으면 독립 feature schema를 둔다.

최소 테이블/엔티티:

- `message_templates`
- `message_template_versions`
- `message_template_approvals`
- `message_send_requests`
- `message_send_recipients`
- `message_send_results`
- `message_provider_events`
- `message_suppression_list`
- `message_sender_profiles`

필수 필드:

- channel: `sms | lms | mms | alimtalk | friendtalk | brand_message`
- provider: `solapi`
- template key
- provider template id
- approval status
- variables schema
- fallback channel
- sender number
- pfId/channel id, 공식 문서와 콘솔에서 확인되는 이름으로 저장
- recipient phone, masked display value
- provider message id
- send status: `queued | sent | delivered | failed | canceled | unknown`
- failure code/message
- retry count
- idempotency key
- requestedBy/admin actor
- consent category: `transactional | marketing`
- sentAt / deliveredAt / failedAt
- retention/delete policy fields

주의:

- 전화번호와 변수값은 개인정보다. 관리자 목록에는 masked value를 기본으로 보여준다.
- provider API key/secret은 DB에 평문 저장하지 않는다.
- 광고성 메시지와 거래성 메시지의 정책을 분리한다.

### 3. 내부 REST API

외부 SOLAPI SDK는 provider package가 감싸고, product-builder-base 내부 API는 REST + OpenAPI로 제공한다.

#### App/Internal API

```text
POST /api/messages/send
POST /api/messages/send-bulk
GET  /api/messages/:messageId/status
```

각 endpoint 책임:

- `POST /api/messages/send`
  - template key 또는 ad-hoc transactional message 요청
  - channel 선택: sms/lms/mms/alimtalk
  - 수신자 전화번호 정규화/검증
  - consent/policy 검증
  - idempotency 적용
  - SOLAPI 발송 호출
  - provider message id와 normalized status 저장

- `POST /api/messages/send-bulk`
  - bulk 발송이 공식 SDK와 운영 정책에서 허용될 때만 구현
  - recipient별 결과를 분리 저장
  - rate limit/throttle 적용

- `GET /api/messages/:messageId/status`
  - 내부 서비스 또는 관리자 UI에서 발송 상태 조회
  - 사용자 공개 API로 열 필요가 없으면 internal/admin only로 제한

#### Admin API

```text
GET    /api/admin/message-templates
GET    /api/admin/message-templates/:id
POST   /api/admin/message-templates
PATCH  /api/admin/message-templates/:id
DELETE /api/admin/message-templates/:id
POST   /api/admin/message-templates/:id/test-send
POST   /api/admin/message-templates/:id/sync-approval
GET    /api/admin/message-sends
GET    /api/admin/message-sends/:id
POST   /api/admin/message-sends/:id/retry
GET    /api/admin/message-sender-profiles
POST   /api/admin/message-sender-profiles/sync
```

각 endpoint 책임:

- 템플릿 목록/상세/생성/수정/archive
- 알림톡 승인 상태와 provider template id 관리
- 테스트 발송
- 실발송 이력 조회
- 실패/재시도
- 발신번호/카카오 채널 profile 상태 조회
- provider 설정 health check
- 운영자 action audit log

#### Webhook or Status Sync API

SOLAPI가 발송 상태 webhook/callback을 제공하면 공식 문서 기준으로 구현한다. 제공 방식이 명확하지 않으면 status polling 또는 admin sync task로 분리하고 추측 webhook을 만들지 않는다.

```text
POST /api/webhooks/solapi/messages
POST /api/admin/message-sends/sync-status
```

책임:

- 공식 문서의 signature/header 검증이 있으면 적용
- raw provider event 저장
- idempotency 적용
- recipient별 상태 반영
- 실패 code/message normalization

### 4. 관리자 화면

권장 위치:

```text
apps/admin/features/message-sending/
```

필수 화면:

- 메시지 템플릿 목록
  - template key, channel, provider, approval status, fallback, updatedAt
  - 채널 필터: SMS/LMS/MMS/알림톡

- 템플릿 상세/편집
  - 제목/본문
  - 변수 schema
  - provider template id
  - 알림톡 승인 상태
  - fallback 메시지
  - archive/publish

- 테스트 발송
  - 테스트 수신번호
  - 변수값 입력
  - channel/fallback 확인
  - provider response 표시, raw secret 없음

- 발송 이력
  - 요청 id, template, channel, recipient masked, status, provider message id, failure code
  - 검색: 기간, 채널, 상태, template key, recipient

- 발송 상세
  - 요청 payload normalized view
  - provider event timeline
  - retry 가능 여부
  - fallback 실행 여부

- 발신 프로필/설정
  - API key 존재 여부만 표시
  - 발신번호 등록 상태
  - 카카오 채널/pfId 상태
  - 잔액/계정 상태, 공식 SDK/API로 확인 가능할 때

### 5. OpenAPI

아래를 OpenAPI에 포함한다.

- message send request/response
- bulk send request/response
- template CRUD
- test send
- send history
- send status
- status sync/webhook
- provider error shape
- channel enum
- approval status enum

OpenAPI에는 SOLAPI API key, API secret, 실제 전화번호, 실제 알림톡 template id 예시를 넣지 않는다.

### 6. Tests / QA

필수 테스트:

- config validation
- phone number normalization: `01012345678` 형식
- invalid phone rejection: `+`, `-`, `*` 포함 케이스
- SMS send payload builder
- LMS send payload builder
- MMS send payload builder
- 알림톡 payload builder
- template variable validation
- fallback policy
- idempotency
- rate limit/throttle
- provider response normalization
- status sync/webhook, 공식 방식 확인 시
- admin permission
- masking/no secret leak
- transactional vs marketing consent policy

필수 E2E/smoke 증거:

- SOLAPI API key/API secret env 존재 확인
- 발신번호 등록 상태 확인
- SMS 테스트 발송
- LMS 또는 장문 발송 테스트
- 알림톡은 카카오 채널/템플릿 승인 상태가 있는 경우 테스트 발송
- 실패 케이스와 fallback 처리
- 관리자 템플릿 CRUD
- 관리자 테스트 발송
- 관리자 발송 이력 조회

## Product Builder issue mapping

이 구현이 완료되면 Product Builder의 기존 알림톡 관련 task는 `메시지 발송` feature task로 rename하고 아래처럼 REUSE/EXTEND 판정이 가능해야 한다.

- `PB-MSG-001`
  - title: `SOLAPI 메시지 발송 provider/승인 선행작업`
  - REUSE source: `product-builder-base:packages/features/message-sending/solapi/config@<tag-or-commit>`

- `PB-MSG-DATA-001`
  - title: `메시지 템플릿/발송 데이터 모델`
  - REUSE source: `product-builder-base:packages/features/message-sending/schema@<tag-or-commit>`

- `PB-MSG-TEMPLATE-API-LIST-001`
  - title: `메시지 템플릿 조회 API`
  - REUSE source: `product-builder-base:packages/features/message-sending/rest-api/templates-read@<tag-or-commit>`

- `PB-MSG-TEMPLATE-API-CREATE-001`
  - title: `메시지 템플릿 생성 API`
  - REUSE source: `product-builder-base:packages/features/message-sending/rest-api/templates-create@<tag-or-commit>`

- `PB-MSG-TEMPLATE-API-UPDATE-001`
  - title: `메시지 템플릿 수정/승인상태 동기화 API`
  - REUSE source: `product-builder-base:packages/features/message-sending/rest-api/templates-update@<tag-or-commit>`

- `PB-MSG-TEMPLATE-API-DELETE-001`
  - title: `메시지 템플릿 archive API`
  - REUSE source: `product-builder-base:packages/features/message-sending/rest-api/templates-delete@<tag-or-commit>`

- `PB-MSG-SEND-API-001`
  - title: `메시지 발송/SMS fallback API`
  - REUSE source: `product-builder-base:packages/features/message-sending/rest-api/send@<tag-or-commit>`

- `PB-MSG-ADMIN-001`
  - title: `메시지 발송 관리자 UI`
  - REUSE source: `product-builder-base:apps/admin/features/message-sending@<tag-or-commit>`

- `PB-MSG-QA-001`
  - title: `메시지 발송 검증`
  - REUSE source: `product-builder-base:tests/message-sending/reusable-checklist@<tag-or-commit>`

기존 `PB-NOTIFY-ALIMTALK-*` 또는 `notification.alimtalk.*` task는 Product Builder plugin에서 위 naming으로 rename한다. 단, 하위 채널 설명에는 `알림톡`을 유지한다.

## Definition of Done

완료 조건:

- `product-builder-base`에 SOLAPI message sending capability가 구현되어 있다.
- REST API와 OpenAPI가 있다.
- 관리자 화면이 있다.
- SMS/LMS/MMS/알림톡 발송 경계가 공식 문서 기준으로 구현되어 있다.
- 발신번호, 카카오 채널, 알림톡 템플릿 승인, fallback 정책이 운영 선행조건으로 추적된다.
- 공식 문서 source map이 `packages/features/message-sending/solapi/README.md` 또는 별도 docs에 남아 있다.
- 각 request/response/parser/test fixture가 어떤 공식 문서/API reference에 근거했는지 추적 가능하다.
- capability registry에 `message-sending.solapi.*`가 등록되어 있다.
- Product Builder에서 REUSE source로 쓸 수 있는 tag 또는 commit SHA가 있다.

완료로 보면 안 되는 상태:

- 알림톡만 구현하고 SMS/LMS/MMS 기본 발송 경계가 없다.
- provider 발송 함수만 있고 템플릿 CRUD/관리자 UI/발송 이력이 없다.
- API key/secret이 클라이언트나 OpenAPI 예시에 노출된다.
- 전화번호 형식 검증 없이 provider로 보낸다.
- 승인되지 않은 알림톡 템플릿을 발송 가능하다고 처리한다.
- 공식 문서/API reference에 없는 payload/result code를 추측해서 넣었다.
- 마케팅/거래성 메시지 동의 정책이 없다.

## 새 세션 시작 프롬프트

아래를 새 세션 첫 메시지로 사용한다.

```text
Product Builder Base repo에서 SOLAPI 기반 메시지 발송 feature를 재사용 가능한 capability로 구현해줘.

작업 위치:
- /Users/bright/Projects/product-builder-base
- branch 기준은 develop

목표:
- 기존 Product Builder의 “알림톡” feature를 “메시지 발송” feature로 확장/rename할 수 있게 packages/features/message-sending/solapi, schema, REST API, admin UI, tests, capability registry를 만든다.

절대 규칙:
- SOLAPI 공식 문서/SDK/API reference에서 확인되지 않은 request/response field, 카카오 템플릿 field, result code, status sync 방식은 추측 구현하지 말 것.
- 상위 feature 이름은 “메시지 발송”으로 두고, 알림톡은 SMS/LMS/MMS와 함께 하위 채널로 다룰 것.
- SOLAPI API key/API secret은 server-side only로 사용하고 클라이언트/OpenAPI 예시에 노출하지 말 것.
- REST API, OpenAPI, 관리자 템플릿 CRUD, 테스트 발송, 실발송, 발송 이력, 실패/재시도, SMS fallback, QA까지 다룰 것.

참조 문서:
- SOLAPI Node.js 메시지 발송 예제: https://solapi.com/developers/sdk/nodejs-sendingexample
- SOLAPI Node.js SDK GitHub: https://github.com/solapi/solapi-nodejs
- SOLAPI Node.js SDK API reference: https://solapi.github.io/solapi-nodejs/classes/index.SolapiMessageService.html
- SOLAPI Developers: https://developers.solapi.com/category/nodejs

먼저 이 문서를 읽고 source map과 구현 계획을 짧게 만든 뒤, base repo 구조를 확인해서 기존 feature/admin/API 패턴에 맞춰 구현해.
```
