# Product Builder Base: KCB Identity Verification REUSE Feature Handoff

## 목적

`product-builder-base`에 KCB/Ok-name 본인확인 feature를 재사용 가능한 capability로 먼저 구현한다.

최종 목표는 Product Builder에서 `[KCB] 본인확인` 선택 시 신규 임시 구현이 아니라 아래처럼 검증 가능한 REUSE source를 사용할 수 있게 만드는 것이다.

```text
product-builder-base:packages/features/identity-verification/kcb@<tag-or-commit>
product-builder-base:packages/features/identity-verification/kcb-jar-bridge@<tag-or-commit>
product-builder-base:packages/features/identity-verification/schema@<tag-or-commit>
product-builder-base:packages/features/identity-verification/rest-api@<tag-or-commit>
product-builder-base:packages/features/identity-verification/ui@<tag-or-commit>
product-builder-base:apps/admin/features/identity-verification@<tag-or-commit>
product-builder-base:apps/kcb-identity-server@<tag-or-commit>
product-builder-base:tests/identity-verification/reusable-checklist@<tag-or-commit>
```

## 결론: Java 서버를 monorepo `apps/`에 둬도 되는가?

가능하다. 오히려 권장한다.

KCB 본인확인은 Java/JAR 모듈과 라이선스/네이티브 라이브러리 의존성이 있을 수 있으므로 Next.js/Vercel 함수 안에 직접 넣는 방식은 피한다. `product-builder-base` monorepo 안에 별도 Java adapter service를 두고, Node/Next API가 내부 HTTP로 호출하는 구조가 맞다.

권장 위치:

```text
apps/kcb-identity-server/
```

권장 역할:

- KCB JAR 모듈 로딩
- KCB license/dat/native lib 경로 관리
- 표준형/커스텀형 요청 암호화/복호화
- callback/result 검증
- KCB 결과 code normalization
- health check
- Node API가 호출할 내부 REST endpoint 제공

배포:

- 기본 Product Builder stack은 Neon + Vercel이다.
- KCB Java service는 예외적으로 별도 JVM runtime에 둔다.
- Railway, Fly.io, Render, ECS 같은 JVM 가능 환경을 후보로 둔다.
- Vercel/Node API는 `KCB_ADAPTER_BASE_URL` 같은 내부 endpoint로 Java service를 호출한다.
- Java service가 외부 공개되어야 한다면 auth token, IP allowlist, private networking, TLS를 적용한다.

금지:

- KCB JAR/license/native library를 public repo에 commit하지 않는다.
- Next.js API route에서 JAR을 직접 실행한다고 가정하지 않는다.
- 비공식 Node wrapper를 source-of-truth로 쓰지 않는다.

## feature 경계

KCB 본인확인은 로그인 대체가 아니다.

사용 위치:

- 보호 액션 identity gate
- 결제/환불/고가 상품 구매 전 확인
- 성인 인증
- 본인 소유 계정/권한 확인
- 계정 복구/민감 설정 변경

로그인/session은 별도 auth feature가 담당한다. KCB 완료 결과는 사용자 identity verification status와 action gate에 연결한다.

## 지원 방식 2종

### 1. 표준형

KCB가 제공하는 화면/팝업/페이지를 사용한다.

특징:

- 사용자가 KCB 제공 화면에서 정보 입력과 통신사 인증을 진행한다.
- 우리 서비스는 요청 생성, redirect/form, return/callback 검증, 결과 저장을 담당한다.
- 최초 구현 기본값은 표준형으로 둔다.
- UI/UX 자유도는 낮지만 구현/심사 리스크가 낮다.

필수 구현:

- 표준형 request 생성
- KCB 제공 URL/form redirect
- return/callback result 검증
- nonce/state/replay 방지
- 완료 후 원래 보호 액션으로 복귀

### 2. 커스텀형

우리 화면에서 사용자 정보를 입력받고 KCB 연동을 호출한다.

특징:

- 이름, 생년월일, 성별, 내외국인, 통신사, 휴대폰번호 등 입력 UI를 우리가 만든다.
- KCB 계약/가이드에서 커스텀형 허용 여부와 필수 고지/동의/입력 항목을 확인해야 한다.
- 개인정보 처리, 접근성, 통신사 선택, 오류 메시지, 재시도 흐름의 책임이 커진다.
- 표준형 구현 후 별도 feature flag로 확장한다.

필수 구현:

- 커스텀 입력 form
- 약관/고지/동의 UI
- 입력값 검증
- KCB 요청 암호화
- 인증 단계 상태 관리
- 오류/재시도 UX

커스텀형은 공식 계약/가이드에서 허용 방식과 payload가 확인되기 전까지 구현하지 않는다.

## 절대 규칙

1. 공식/계약 문서를 직접 보고 구현한다.
   - KCB/Ok-name 계약서
   - 공식 연동가이드
   - 테스트 계정
   - 서비스 코드/site code
   - JAR 파일
   - license/dat 파일
   - native library 요구사항
   - 암복호화/서명/hash 규칙
   - callback/return URL 설정
   - 결과 code table

2. 추측 구현 금지.
   - 공개 블로그, 비공식 GitHub wrapper, 오래된 샘플의 field/payload/hash를 그대로 구현하지 않는다.
   - 공식 문서와 받은 모듈에서 확인되지 않은 request/response field는 blocker로 남긴다.

3. JAR/JVM adapter 경계를 먼저 확정한다.
   - Java bitness, OS, native library, `LD_LIBRARY_PATH`, license path가 맞지 않으면 서버에서만 실패할 수 있다.
   - 로컬 성공만으로 완료 처리하지 않는다.

4. 민감정보 최소 저장.
   - 주민등록번호 저장 금지.
   - 원문 KCB payload 저장 금지.
   - CI/DI, 이름, 생년월일, 전화번호는 최소화, masking, retention/delete policy를 둔다.

5. 표준형과 커스텀형을 명확히 분리한다.
   - API, UI, 설정, 테스트, acceptance criteria에서 mode를 분리한다.

## 공식/검증 참조

공개 URL은 제품/서비스 존재 확인용이다. 구현 payload의 source-of-truth는 고객 계약 후 받은 공식 연동자료다.

- KCB Ok-name: `https://www.ok-name.co.kr/`
- KCB service intro: `https://datastore.koreacb.com/site/kcbserviceIntro.do`
- 비공식 Node wrapper 예시는 존재하지만 공식 제공 모듈이 아니므로 source-of-truth로 쓰지 않는다.

공식 자료에서 확인해야 하는 최소 항목:

- 표준형/커스텀형 지원 여부
- 요청 endpoint
- return/callback endpoint
- request field
- response field
- 암호화/복호화 함수
- hash/signature 규칙
- site/service code
- license/dat path
- JAR version/checksum
- native library requirement
- Java version/bitness
- 테스트/운영 URL
- result code table
- CI/DI 제공 여부와 보존 정책
- callback URL allowlist

## 구현 산출물

### 1. Java adapter service

권장 위치:

```text
apps/kcb-identity-server/
  build.gradle 또는 pom.xml
  src/main/java/...
  src/test/java/...
  README.md
```

Spring Boot 또는 경량 Java HTTP server를 사용한다. base repo 패턴이 있으면 따른다.

필수 endpoint:

```text
GET  /health
POST /internal/kcb/standard/request
POST /internal/kcb/standard/verify
POST /internal/kcb/custom/request
POST /internal/kcb/custom/verify
POST /internal/kcb/decrypt-result
```

책임:

- KCB JAR 로딩
- license/dat/native library path validation
- 표준형 request payload 생성
- 커스텀형 request payload 생성, 공식 문서 확인 후
- result decrypt/verify
- result code normalization
- adapter error normalization
- internal auth token 검증
- health check에서 JAR/license/native 상태 보고

환경변수 예시:

```text
KCB_MODE=test|production
KCB_SITE_CODE=
KCB_SERVICE_CODE=
KCB_MODULE_JAR_PATH=
KCB_LICENSE_PATH=
KCB_NATIVE_LIB_PATH=
KCB_LOG_DIR=
KCB_STANDARD_RETURN_URL=
KCB_STANDARD_CALLBACK_URL=
KCB_INTERNAL_AUTH_TOKEN=
```

주의:

- 실제 JAR/license/native 파일은 git에 넣지 않는다.
- local dev용 `.gitkeep`와 README만 둔다.
- 배포 환경에는 secret/artifact mechanism으로 주입한다.

### 2. Node/Next REST API wrapper

권장 위치:

```text
packages/features/identity-verification/kcb/
packages/features/identity-verification/rest-api/
```

Public/App API:

```text
POST /api/identity-verifications/kcb/sessions
GET  /api/identity-verifications/kcb/sessions/:sessionId
POST /api/identity-verifications/kcb/callback
POST /api/identity-verifications/kcb/return
POST /api/identity-verifications/kcb/custom/start
POST /api/identity-verifications/kcb/custom/verify
```

Admin API:

```text
GET /api/admin/identity-verifications
GET /api/admin/identity-verifications/:id
GET /api/admin/identity-verifications/kcb/health
POST /api/admin/identity-verifications/:id/retry
POST /api/admin/identity-verifications/:id/archive
```

책임:

- session 생성
- target action 저장
- mode 선택: `standard | custom`
- nonce/state 생성
- Java adapter 호출
- callback/return 검증
- result 저장 최소화
- user verification status 업데이트
- 보호 액션 복귀
- admin audit log

### 3. DB/schema

최소 테이블/엔티티:

- `identity_verification_sessions`
- `identity_verification_results`
- `identity_verification_provider_events`
- `identity_verification_consents`
- `identity_verification_admin_actions`

필수 필드:

- provider: `kcb`
- mode: `standard | custom`
- user id
- target action/resource
- session status: `created | redirected | pending | verified | failed | canceled | expired`
- nonce/state hash
- request id
- provider transaction id, 공식 문서 확인 후
- CI/DI hash or encrypted minimal value, 공식/정책 확인 후
- name masked
- birth year or birth date, 저장 필요성 검토 후 최소화
- phone masked
- result code/message normalized
- verifiedAt
- expiresAt
- retention/delete fields
- audit fields

저장 금지:

- 주민등록번호
- 원문 KCB request/response payload
- 암호화 키/라이선스
- 불필요한 전체 전화번호, 정책상 필요 없으면 저장하지 않는다.

### 4. UI

권장 위치:

```text
packages/features/identity-verification/ui/
```

필수 UI:

- 보호 액션 gate
- 표준형 시작 버튼
- KCB 팝업/redirect return 처리
- 완료/실패/취소/만료 상태
- 원래 액션 복귀
- 커스텀형 입력 form, 공식 허용 확인 후
- 개인정보/본인확인 고지/동의 UI

주의:

- 온라인 서비스 전체를 login wall로 만들지 않는다.
- 필요한 액션에서 auth modal 이후 KCB gate로 이어진다.
- 커스텀형 입력값 error는 사용자 친화 문구로 표시하고 raw provider error를 보여주지 않는다.

### 5. 관리자 화면

권장 위치:

```text
apps/admin/features/identity-verification/
```

필수 화면:

- 본인확인 이력 목록
- session detail
- mode: 표준형/커스텀형
- 상태/결과 code
- provider event timeline
- Java adapter health
- JAR/license/native lib 검증 상태
- callback URL 설정 상태
- 개인정보 masking/retention 상태
- 실패/취소/만료/재시도 필요 상태

### 6. OpenAPI

아래를 OpenAPI에 포함한다.

- KCB session create/read
- callback/return
- custom start/verify, 공식 허용 시
- admin list/read
- admin health
- normalized error shape
- mode enum
- status enum

OpenAPI에는 KCB secret, license path, 원문 payload, CI/DI 원문 예시를 넣지 않는다.

### 7. Tests / QA

필수 테스트:

- Java adapter config validation
- JAR/license/native path missing
- internal auth token required
- standard session create
- callback nonce/state replay 방지
- result decrypt/verify, 공식 fixture 확보 시
- custom input validation, 공식 허용 시
- success/fail/cancel/expired
- user verification status update
- protected action resume
- admin permission
- sensitive data masking
- retention/delete policy

필수 E2E/smoke 증거:

- KCB 테스트 계정/사이트 코드 존재
- Java adapter health pass
- JAR version/checksum 기록
- 표준형 인증 성공
- 표준형 실패/취소/만료
- callback 위조/replay 거부
- 커스텀형은 공식 허용과 테스트 성공 시에만 pass
- 관리자 이력 조회
- 배포 환경 callback/return URL 일치

## Product Builder issue mapping

이 구현이 완료되면 Product Builder의 KCB 관련 task는 아래처럼 REUSE/EXTEND 판정이 가능해야 한다.

- `PB-IDV-KCB-001`
  - REUSE source: `product-builder-base:packages/features/identity-verification/kcb@<tag-or-commit>`

- `PB-IDV-KCB-JAR-001`
  - REUSE source: `product-builder-base:apps/kcb-identity-server@<tag-or-commit>`

- `PB-IDV-KCB-DATA-001`
  - REUSE source: `product-builder-base:packages/features/identity-verification/schema@<tag-or-commit>`

- `PB-IDV-KCB-API-SESSION-001`
  - REUSE source: `product-builder-base:packages/features/identity-verification/rest-api/session@<tag-or-commit>`

- `PB-IDV-KCB-CALLBACK-001`
  - REUSE source: `product-builder-base:packages/features/identity-verification/rest-api/callback@<tag-or-commit>`

- `PB-IDV-KCB-API-STATUS-001`
  - REUSE source: `product-builder-base:packages/features/identity-verification/rest-api/status@<tag-or-commit>`

- `PB-IDV-KCB-UI-001`
  - REUSE source: `product-builder-base:packages/features/identity-verification/ui@<tag-or-commit>`

- `PB-IDV-KCB-ADMIN-001`
  - REUSE source: `product-builder-base:apps/admin/features/identity-verification@<tag-or-commit>`

- `PB-IDV-KCB-QA-001`
  - REUSE source: `product-builder-base:tests/identity-verification/reusable-checklist@<tag-or-commit>`

## Definition of Done

완료 조건:

- `product-builder-base`에 KCB identity verification capability가 구현되어 있다.
- Java adapter service가 `apps/kcb-identity-server`에 있다.
- REST API와 OpenAPI가 있다.
- 표준형이 구현되어 있다.
- 커스텀형은 공식 문서/계약에서 허용되고 fixture가 확보된 경우에만 구현되어 있다. 아니면 명시적 blocker로 남긴다.
- 관리자 화면이 있다.
- Java adapter health, JAR/license/native library 상태를 검증할 수 있다.
- 공식 문서 source map이 Java service README 또는 feature docs에 남아 있다.
- capability registry에 `identity-verification.kcb.*`가 등록되어 있다.
- Product Builder에서 REUSE source로 쓸 수 있는 tag 또는 commit SHA가 있다.

완료로 보면 안 되는 상태:

- 표준형/커스텀형 구분 없이 섞여 있다.
- JAR 없이 mock으로 성공 처리한다.
- 비공식 Node wrapper나 블로그 샘플을 기준으로 payload/hash를 만들었다.
- Java adapter health가 JAR/license/native 상태를 확인하지 않는다.
- 주민등록번호나 원문 KCB payload를 저장한다.
- callback replay/위조 방지가 없다.
- 관리자 화면이 없다.
- 배포 환경 callback/return URL 증거가 없다.

## 새 세션 시작 프롬프트

아래를 새 세션 첫 메시지로 사용한다.

```text
Product Builder Base repo에서 KCB/Ok-name 본인확인 feature를 재사용 가능한 capability로 구현해줘.

작업 위치:
- /Users/bright/Projects/product-builder-base
- branch 기준은 develop

목표:
- Product Builder에서 [KCB] 본인확인 선택 시 PB-IDV-KCB-* task를 REUSE로 판정할 수 있게 packages/features/identity-verification/kcb, schema, REST API, UI, admin UI, tests, capability registry를 만든다.
- KCB JAR/JVM adapter는 monorepo apps/kcb-identity-server에 별도 Java service로 둔다.

절대 규칙:
- KCB/Ok-name 공식 계약서, 연동가이드, 테스트 계정, 서비스 코드, JAR/license/native library, 결과 코드표를 직접 보고 구현할 것.
- 공식 문서에서 확인되지 않은 request/response field, 암호화/hash, callback payload, result code는 추측 구현하지 말 것.
- 표준형(제공 화면 사용)과 커스텀형을 분리할 것. 최초 기본은 표준형이고, 커스텀형은 공식 허용과 fixture 확보 전에는 blocker로 남길 것.
- JAR/license/native file은 git에 넣지 말고 배포 secret/artifact로 주입할 것.
- REST API, OpenAPI, Java adapter health, 관리자 화면, 보호 액션 UI, QA까지 다룰 것.

참조:
- KCB Ok-name: https://www.ok-name.co.kr/
- KCB service intro: https://datastore.koreacb.com/site/kcbserviceIntro.do
- 비공식 wrapper/blog는 source-of-truth로 쓰지 말 것.

먼저 이 문서를 읽고 source map과 구현 계획을 짧게 만든 뒤, base repo 구조를 확인해서 기존 feature/admin/API 패턴에 맞춰 구현해.
```
