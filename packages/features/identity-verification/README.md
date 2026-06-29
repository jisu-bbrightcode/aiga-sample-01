# Identity Verification Feature

KCB/Ok-name 본인확인 reusable feature입니다. 서버 API와 서버 DB를 기준으로
세션을 생성하고, Java bridge가 KCB 공식 OkCert3 모듈을 호출합니다.

## KCB 환경 정책

- KCB는 현재 별도 `TEST` target/site를 지원하지 않습니다.
- 연동 검증은 항상 `PROD` target, 운영 회원사 코드, 운영 라이선스로 진행합니다.
- KCB 측에서 운영 계약에 테스트 기간을 열어주면 그 기간 동안 운영 엔드포인트에서
  제한된 live verification으로 검증합니다.
- 따라서 신규 배포와 로컬 검증 모두 `KCB_MODE=PROD`를 사용합니다.
- `KCB_MODE=TEST`를 새 환경에 설정하지 마십시오. 코드에 legacy target 처리가 남아
  있어도 현재 KCB 운영 방식의 검증 경로가 아닙니다.

## 구성 요소

- `identity-verification.module.ts`: Nest module entry.
- `controller/`: public KCB session/return/custom REST API와 admin REST API.
- `service/`: session lifecycle, replay guard, minimal result persistence.
- `kcb/`: Java bridge client, provider contracts, stable error codes.
- `schema/`: DB schema exports.
- `ui/`: reusable app UI blocks.
- `capability-registry.ts`: REUSE capability IDs.

Java bridge는 feature package 밖의 `apps/kcb-identity-server`에 있습니다. 공식 JAR,
라이선스, native library는 저장소에 커밋하지 않고 배포 artifact/secret으로 주입합니다.

## 서버 사용 방법

Nest 서버에 `IdentityVerificationModule`을 등록하면 아래 REST API가 열립니다.

- `POST /api/identity-verifications/kcb/sessions`
- `GET /api/identity-verifications/kcb/sessions/:sessionId`
- `POST /api/identity-verifications/kcb/sessions/:sessionId/link`
- `GET /api/identity-verifications/kcb/me`
- `POST /api/identity-verifications/kcb/callback`
- `POST /api/identity-verifications/kcb/return`
- `GET|POST /api/identity-verifications/kcb/popup-return`
- `POST /api/identity-verifications/kcb/custom/start`
- `POST /api/identity-verifications/kcb/custom/verify`
- `GET /api/admin/identity-verifications`
- `GET /api/admin/identity-verifications/:id`
- `GET /api/admin/identity-verifications/kcb/health`
- `POST /api/admin/identity-verifications/:id/retry`
- `POST /api/admin/identity-verifications/:id/archive`

Node API 환경변수:

```bash
export KCB_ADAPTER_BASE_URL=http://localhost:18999
export KCB_INTERNAL_AUTH_TOKEN=<same-token-as-java-bridge>
export KCB_STANDARD_RETURN_URL=https://<api-domain>/api/identity-verifications/kcb/popup-return
export KCB_STANDARD_CALLBACK_URL=https://<api-domain>/api/identity-verifications/kcb/callback
export KCB_CUSTOM_MODE_ENABLED=false
```

`KCB_INTERNAL_AUTH_TOKEN`은 Node API와 Java bridge 사이의 내부 인증 토큰입니다.
사용자에게 노출하지 않습니다.

## Callback / 결과 검증 (PB-IDV-KCB-CALLBACK-001)

`callback` / `return` / `popup-return`은 동일한 검증 파이프라인을 거칩니다.

1. 세션 조회 (없으면 `session_not_found`).
2. `state` / `nonce` 해시 일치 검증 — 불일치는 `replay_detected` (provider 호출 안 함).
   `popup-return`은 KCB가 항상 돌려주는 단일 사용 `mdl_tkn` 해시로 세션을 찾습니다.
3. 만료 시각 검증 — 만료 시 provider 호출 없이 `expired`.
4. 서명/복호화 검증은 **KCB JAR adapter 경계**(`/internal/kcb/*/verify`)에서만 수행하고,
   서비스는 결과만 매핑합니다 (임의 복호화/코드 매칭 금지).

결과 code → 내부 상태 / 사용자 메시지 매핑:

| adapter 응답 | 내부 status | failureCode | 사용자 메시지 키 |
|---|---|---|---|
| `verified: true` | `verified` | – | `verified` |
| `canceled: true` | `canceled` | `canceled` | `canceled` |
| `verified: false` | `failed` | `provider_rejected` | `failed` |
| adapter 오류/timeout | `failed` | (stable blocker code) | 해당 code |
| 세션 만료 | `expired` | `session_expired` | `expired` |

- **Idempotency**: 종료 상태(verified/failed/canceled/expired)인 세션에 중복 callback이
  와도 저장된 결과를 그대로 반환합니다 — provider 재호출·verification 중복 insert 없음.
- 각 결과는 `identity_verification_attempts`에 비민감 코드만(원문/CI/DI/RRN 제외) audit row로 남습니다.
- KCB 응답 원문은 로그·DB에 저장하지 않으며, identity는 hash(`ci_hash`/`di_hash`)·masked로만 보관합니다.

## Java bridge 사용 방법

1. KCB에서 받은 공식 artifact를 ignored directory에 배치합니다.

```bash
cp <official-OkCert3-jar> apps/kcb-identity-server/artifacts/jar/
cp <official-PROD-license.dat> apps/kcb-identity-server/artifacts/license/
```

2. Java bridge 환경변수를 설정합니다.

```bash
export KCB_MODE=PROD
export KCB_SITE_CODE=<운영-회원사-코드>
export KCB_SITE_NAME=<계약-사이트명>
export KCB_SITE_URL=https://<public-app-origin>
export KCB_POPUP_URL=https://safe.ok-name.co.kr/CommonSvl
export KCB_STANDARD_RETURN_URL=https://<api-domain>/api/identity-verifications/kcb/popup-return
export KCB_INTERNAL_AUTH_TOKEN=<internal-token>
export KCB_MODULE_JAR_PATH="$PWD/apps/kcb-identity-server/artifacts/jar/OkCert3-java1.5-2.3.5.jar"
export KCB_LICENSE_PATH="$PWD/apps/kcb-identity-server/artifacts/license/<official-PROD-license.dat>"
export KCB_OFFICIAL_SOURCE_MAP="<internal-contract-record>"
```

3. Java bridge를 실행합니다.

```bash
cd apps/kcb-identity-server
mvn -DskipTests package
SERVER_PORT=18999 java -jar target/kcb-identity-server-0.1.0.jar
curl localhost:18999/health
```

`/health`는 artifact, return URL, site code, official source map readiness를
보여줍니다. `ok:true`와 `blockers:[]`가 아니면 Node API는 성공 payload를 만들지
않고 stable blocker code를 반환합니다.

## 앱 UI 사용 방법

Reusable UI는 `@repo/features/identity-verification/ui`에서 가져옵니다.

```tsx
import { KcbIdentityGate, KcbReturnPanel } from "@repo/features/identity-verification/ui";
```

일반 흐름:

1. 사용자가 동의 후 본인확인을 시작합니다.
2. 앱이 `POST /sessions`를 호출합니다.
3. 응답의 `redirectForm`으로 KCB `CommonSvl` popup을 엽니다.
4. 사용자가 popup에서 휴대폰 본인확인을 완료합니다.
5. KCB가 `popup-return`으로 돌아오고, popup page가 opener에 결과를 알린 뒤 닫힙니다.
6. host page가 `GET /sessions/:sessionId`를 polling하여 서버 DB의 session 상태를
   표시합니다.

사용자 화면에는 provider raw error, 서버 stack trace, KCB 원문 reason을 표시하지
않습니다. UI copy는 stable code 기반 메시지를 사용합니다.

## Live 검증 체크리스트

- KCB 운영 회원사 코드와 운영 라이선스가 맞는지 확인합니다.
- KCB 측 테스트 기간이 열린 상태인지 확인합니다.
- `KCB_MODE=PROD`인지 확인합니다.
- `KCB_SITE_URL`과 `KCB_STANDARD_RETURN_URL`이 KCB 계약 allowlist와 일치하는지
  확인합니다.
- Java bridge host가 `https://safe.ok-name.co.kr`로 outbound 접속 가능한지 확인합니다.
- `/api/admin/identity-verifications/kcb/health`에서 blocker가 없는지 확인합니다.
- 실제 사용자 popup 1회를 완료해 `IDS_HS_POPUP_RESULT` decode와 DB persistence를
  확인합니다.

## 제한 사항

- KCB TEST 환경은 없습니다. TEST target 전제로 fixture를 만들거나 성공 payload를
  추측하지 않습니다.
- Custom mode는 별도 공식 계약/문서/fixture가 확인될 때까지 차단합니다.
- CI/DI, 휴대폰, 이름 등 민감 정보는 정책상 허용된 최소값만 저장합니다.
- 공식 JAR/license/native artifact는 git에 커밋하지 않습니다.
