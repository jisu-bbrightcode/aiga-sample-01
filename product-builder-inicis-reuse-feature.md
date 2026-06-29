# Product Builder Base: INICIS Payment REUSE Feature Handoff

## 목적

`product-builder-base`에 KG이니시스(INICIS) 결제 provider를 재사용 가능한 feature로 먼저 구현한다.

최종 목표는 Product Builder에서 INICIS 결제 선택 시 신규 구현이 아니라 아래처럼 검증 가능한 REUSE source를 사용할 수 있게 만드는 것이다.

```text
product-builder-base:packages/features/payment/inicis@<tag-or-commit>
product-builder-base:apps/admin/features/payment/inicis@<tag-or-commit>
product-builder-base:tests/payment/inicis@<tag-or-commit>
```

## 작업 위치

- 대상 repo: `/Users/bright/Projects/product-builder-base`
- 원격 repo: `https://github.com/BBrightcode-atlas/product-builder-base`
- 기준 branch: `develop`
- Paperclip/Product Builder repo는 템플릿과 issue 구조 참고용이다. 구현 코드는 Product Builder plugin repo가 아니라 `product-builder-base`에 넣는다.

## 절대 규칙

1. 추측 구현 금지.
   - 블로그, 기억, 기존 경험, 다른 PG 샘플을 근거로 파라미터, hash, callback payload, result code를 만들지 않는다.
   - 이니시스 공식 매뉴얼, 고객 상점 계약/설정, 테스트 상점 계정에서 확인된 값만 구현한다.

2. 이니시스 사이트의 인터페이스를 그대로 따른다.
   - 외부 INICIS 요청/응답 field 이름, encoding, content-type, endpoint, hash 대상, return/callback URL 처리는 공식 문서 기준 그대로 구현한다.
   - 내부 REST API는 product-builder-base 표준으로 감싸되, 외부 PG contract를 바꾸거나 임의 정규화해서 보내면 안 된다.

3. REST API, 관리자 화면, OpenAPI, 테스트를 함께 만든다.
   - 서버 기능만 만들고 끝내지 않는다.
   - 운영자가 주문/승인/웹훅/취소/환불 상태를 확인하고 재처리할 수 있어야 한다.

4. 결제완료 웹훅까지 범위에 포함한다.
   - returnUrl 승인 완료만으로 완료 처리하지 않는다.
   - 가상계좌 입금통보/노티처럼 비동기 결제완료 이벤트를 수신하고 idempotency, 로그, 재시도 응답까지 처리한다.

5. 민감정보 저장 금지.
   - 카드번호 전체, 주민등록번호, 불필요한 원문 개인정보를 DB/log/admin UI에 저장하지 않는다.
   - 필요 시 masked value, provider transaction id, audit metadata만 저장한다.

## 공식 참조 URL

첫 구현 세션은 아래 URL을 열고, 각 API별 요청/응답/주의사항을 issue 또는 구현 문서에 source map으로 남겨야 한다.

- PC 일반결제: `https://manual.inicis.com/pay/stdpay_pc.html`
- 정기결제/빌링: `https://manual.inicis.com/pay/bill.html`
- 취소/환불: `https://manual.inicis.com/pay/cancel.html`
- 노티서비스/입금통보: `https://manual.inicis.com/pay/etc-noti.html`
- 거래조회/정합성 확인: `https://manual.inicis.com/pay/etc-inquiry.html`

공식 문서에서 확인해야 하는 최소 항목:

- PC 일반결제
  - 결제요청
  - 인증결과 수신
  - 승인요청
  - 승인결과
  - 망취소 처리
  - returnUrl/closeUrl/authUrl/netCancelUrl 처리
  - signKey/mKey/signature/verification 생성 규칙
  - IDC 센터 코드 검증

- 정기결제/빌링
  - 빌링키 발급
  - 빌링승인
  - 월간/연간 구독 모델에 적용 가능한지
  - 별도 계약/상점 설정 필요 여부

- 취소/환불
  - 일반취소
  - 부분취소
  - 가상계좌 환불
  - 휴대폰 익월환불은 별도 계약 여부 확인
  - Cancel API V1/V2 중 사용할 방식
  - 환불 가능 상태, 중복 취소, 부분취소 잔액, 실패 보정

- 노티/웹훅
  - PC 가상계좌 입금 노티
  - 모바일 가상계좌 입금 노티
  - 노티 수신 URL 설정 위치
  - INICIS IP 확인
  - 성공 응답 문자열
  - 재전송 정책
  - payload field와 encoding

- 거래조회
  - 주문/승인/노티/취소 상태 불일치 시 정합성 확인 API
  - 운영자 재처리/대사 기능에 필요한 조회 범위

## 구현 산출물

### 1. Provider package

권장 위치는 base repo 구조를 먼저 확인한 뒤 맞춘다. 구조가 없다면 아래처럼 둔다.

```text
packages/features/payment/inicis/
  src/
    config.ts
    types.ts
    checkout.ts
    approval.ts
    noti.ts
    cancel.ts
    refund.ts
    billing.ts
    inquiry.ts
    event-log.ts
    index.ts
  README.md
```

필수 책임:

- INICIS env/config validation
- checkout request builder
- return/callback parser
- approval API client
- net-cancel handler
- noti/webhook parser and verifier
- cancel/refund API client
- billing key/billing approval client
- inquiry/reconciliation client
- provider event normalization
- idempotency key generation
- raw provider payload 보존 정책

### 2. DB/schema

Product Builder Base의 기존 payment schema가 있으면 확장하고, 없으면 provider-neutral schema를 먼저 만든다.

최소 테이블/엔티티:

- `payment_products`
- `payment_prices`
- `payment_orders`
- `payment_transactions`
- `payment_refunds`
- `payment_entitlements`
- `payment_provider_events`
- `payment_webhook_events`
- `payment_idempotency_keys`
- `inicis_merchant_configs` 또는 env reference 기반 config registry

INICIS 전용으로 반드시 저장할 매핑:

- local order id
- `oid` / `MOID`
- provider transaction id / `tid`
- auth transaction id
- payment method
- amount
- approval date/time
- cancel/refund status
- virtual account issue/deposit status
- provider result code/message
- event idempotency key

주의:

- 공식 문서에서 field명이 확인된 경우에는 provider raw payload 영역에 원명 그대로 보존한다.
- 내부 정규화 필드는 별도 컬럼/JSON으로 분리한다.
- raw payload 저장 시 개인정보/카드정보 masking 정책을 먼저 구현한다.

### 3. 내부 REST API

외부 INICIS interface는 공식 문서 그대로 호출하고, product-builder-base 내부 API는 REST + OpenAPI로 제공한다.

#### Public/App API

```text
POST /api/payment/inicis/checkouts
GET  /api/payment/orders/:orderId
POST /api/payment/inicis/return
POST /api/payment/inicis/callback
POST /api/webhooks/inicis/noti
```

각 endpoint 책임:

- `POST /api/payment/inicis/checkouts`
  - local order 생성
  - idempotency 적용
  - 상품/가격/권한 검증
  - INICIS 결제요청 form/redirect payload 생성
  - 공식 매뉴얼 기준 hash/signature 생성

- `POST /api/payment/inicis/return` 또는 `callback`
  - INICIS 인증결과 수신
  - result code 검증
  - authUrl이 공식/IDC 검증을 통과했는지 확인
  - approval API 호출
  - 승인결과 저장
  - entitlement 부여 또는 실패 처리
  - 승인 후 DB 저장 실패 시 netCancel 처리

- `POST /api/webhooks/inicis/noti`
  - 입금통보/노티 수신
  - INICIS 발신 IP/방화벽 정보 검증
  - form encoding 처리
  - idempotency 적용
  - 가상계좌 입금 완료 시 order/transaction/entitlement 동기화
  - 성공 시 공식 문서가 요구하는 응답 문자열 반환
  - 실패 시 재전송을 고려한 로그와 상태 저장

- `GET /api/payment/orders/:orderId`
  - 사용자가 자기 주문/결제 상태만 조회
  - pending/approved/paid/canceled/refunded/failed 상태 제공

#### Admin API

```text
GET  /api/admin/payment/orders
GET  /api/admin/payment/orders/:orderId
GET  /api/admin/payment/inicis/events
GET  /api/admin/payment/inicis/events/:eventId
POST /api/admin/payment/orders/:orderId/cancel
POST /api/admin/payment/orders/:orderId/refund
POST /api/admin/payment/inicis/events/:eventId/replay
POST /api/admin/payment/inicis/orders/:orderId/inquiry
```

각 endpoint 책임:

- 주문/거래/환불/웹훅 이벤트 검색
- provider raw/normalized event 확인
- 전체취소/부분취소/가상계좌 환불 요청
- 취소/환불 idempotency
- 거래조회 API를 통한 정합성 확인
- 실패 webhook replay
- 운영자 action audit log

관리자 API는 모든 mutation에 actor/audit log를 남긴다.

### 4. 관리자 화면

권장 위치:

```text
apps/admin/features/payment/inicis/
```

필수 화면:

- 주문 목록
  - 주문번호, 사용자, 금액, 결제수단, provider, 상태, 승인일시, 환불상태
  - provider result code/message
  - 검색: 주문번호, tid, 사용자, 상태, 기간

- 주문 상세
  - local order
  - INICIS oid/MOID/tid mapping
  - 승인/입금/취소/환불 timeline
  - entitlement 적용 상태
  - provider raw event는 masked view로만 표시

- 취소/환불 패널
  - 전체취소
  - 부분취소
  - 가상계좌 환불
  - 환불 가능 금액/상태 검증
  - 실행 전 확인 modal
  - 처리 결과와 실패 사유 표시

- 웹훅/노티 이벤트 목록
  - 수신시각, source IP, event type, idempotency key, 처리 상태
  - 성공/실패/replayed 상태
  - 재처리 버튼

- 설정/상태 화면
  - MID/signKey/API key 존재 여부만 표시한다. 값 자체는 노출하지 않는다.
  - 테스트/운영 mode
  - returnUrl/notiUrl/admin configured URL
  - INICIS 공식 설정과 현재 Vercel URL의 일치 여부

### 5. OpenAPI

아래를 OpenAPI에 포함한다.

- public checkout request/response
- callback/return response
- webhook/noti response
- admin order list/detail
- admin cancel/refund
- admin event replay
- provider error shape

OpenAPI에는 secret/hash 원문을 예시로 넣지 않는다.

### 6. Tests / QA

필수 테스트:

- config validation
- checkout payload builder
- hash/signature generation: 공식 문서 또는 공식 샘플의 test vector가 있을 때만 fixture로 사용
- callback parser
- approval success/fail
- netCancel path
- noti/webhook success/fail/retry/idempotency
- cancel/refund full/partial
- billing key/billing approval, 계약/상점 설정이 없으면 blocker로 남김
- inquiry/reconciliation
- admin permission
- masking/no sensitive log

필수 E2E/smoke 증거:

- 테스트 상점 결제 생성
- 승인 callback 처리
- 결제완료 상태 반영
- 가상계좌 입금통보 테스트, 사용 범위에 포함될 경우
- 관리자 주문 조회
- 관리자 전체취소 또는 부분취소
- 환불/취소 후 entitlement 회수
- Vercel preview/prod URL의 returnUrl/notiUrl이 INICIS 설정과 일치

## Product Builder issue mapping

이 구현이 완료되면 Product Builder의 INICIS 관련 task는 아래처럼 REUSE/EXTEND 판정이 가능해야 한다.

- `PB-PAY-INICIS-001`
  - REUSE source: `product-builder-base:packages/features/payment/inicis/config@<tag-or-commit>`
  - 남는 일: 고객 사업자 계약/MID/signKey/env 입력

- `PB-PAY-INICIS-CHECKOUT-001`
  - REUSE source: `product-builder-base:packages/features/payment/inicis/checkout@<tag-or-commit>`

- `PB-PAY-INICIS-APPROVAL-001`
  - REUSE source: `product-builder-base:packages/features/payment/inicis/approval@<tag-or-commit>`

- `PB-PAY-INICIS-WEBHOOK-001`
  - REUSE source: `product-builder-base:packages/features/payment/inicis/noti@<tag-or-commit>`

- `PB-PAY-INICIS-CANCEL-001`
  - REUSE source: `product-builder-base:packages/features/payment/inicis/cancel-refund@<tag-or-commit>`

- `PB-PAY-INICIS-COMPAT-001`
  - REUSE or EXTEND source: `product-builder-base:packages/features/payment/inicis/billing@<tag-or-commit>`
  - 정기결제는 공식 정기결제 매뉴얼과 상점 계약이 확인된 경우에만 REUSE로 둔다.

## Definition of Done

완료 조건:

- `product-builder-base`에 INICIS provider feature가 구현되어 있다.
- REST API와 OpenAPI가 있다.
- 관리자 화면이 있다.
- 결제, 승인, 결제완료 웹훅/노티, 취소, 환불, 거래조회, 정기결제 gap이 모두 처리되거나 명시적 blocker로 남아 있다.
- 공식 문서 source map이 `packages/features/payment/inicis/README.md` 또는 별도 docs에 남아 있다.
- 각 request/response/parser/test fixture가 어떤 공식 문서/상점 설정에 근거했는지 추적 가능하다.
- 테스트 상점 또는 검증 가능한 mock fixture로 핵심 flow가 통과한다.
- capability registry에 `payment.inicis.*`가 등록되어 있다.
- Product Builder에서 REUSE source로 쓸 수 있는 tag 또는 commit SHA가 있다.

완료로 보면 안 되는 상태:

- 결제 요청만 있고 승인/callback 처리가 없다.
- 승인만 있고 입금통보/결제완료 webhook이 없다.
- 서버 API만 있고 관리자 화면이 없다.
- 취소/환불이 관리자에서 실행/추적되지 않는다.
- 공식 매뉴얼에 없는 field/hash/payload를 추측해서 넣었다.
- 테스트 상점/env/returnUrl/notiUrl 증거가 없다.

## 새 세션 시작 프롬프트

아래를 새 세션 첫 메시지로 사용한다.

```text
Product Builder Base repo에서 KG이니시스(INICIS) 결제 provider를 재사용 가능한 feature로 구현해줘.

작업 위치:
- /Users/bright/Projects/product-builder-base
- branch 기준은 develop

목표:
- Product Builder에서 INICIS 결제를 REUSE로 판정할 수 있게 packages/features/payment/inicis, admin UI, REST API, OpenAPI, tests, capability registry를 만든다.

절대 규칙:
- 이니시스 공식 매뉴얼과 고객 상점 설정에서 확인되지 않은 파라미터/hash/callback/result code는 추측 구현하지 말 것.
- 외부 INICIS interface는 공식 문서 그대로 구현하고, 내부 API만 REST/OpenAPI로 감쌀 것.
- 결제, 승인, 결제완료 웹훅/노티, 취소, 환불, 거래조회, 정기결제 gap까지 다룰 것.
- 관리자 화면에서 주문/승인/웹훅/취소/환불 상태를 확인하고 취소/환불/재처리할 수 있게 할 것.

참조 문서:
- PC 일반결제: https://manual.inicis.com/pay/stdpay_pc.html
- 정기결제/빌링: https://manual.inicis.com/pay/bill.html
- 취소/환불: https://manual.inicis.com/pay/cancel.html
- 노티서비스/입금통보: https://manual.inicis.com/pay/etc-noti.html
- 거래조회: https://manual.inicis.com/pay/etc-inquiry.html

먼저 이 문서를 읽고 source map과 구현 계획을 짧게 만든 뒤, base repo 구조를 확인해서 기존 payment/admin/API 패턴에 맞춰 구현해.
```
