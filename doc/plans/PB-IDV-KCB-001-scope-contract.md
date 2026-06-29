# PB-IDV-KCB-001 — KCB 본인확인 provider / 계약 범위 (Scope & Contract Lock)

- Issue: `BBR-570` `[PB-IDV-KCB-001]`
- Product Builder build: `bp-0b891299-66b7-438f-a3a4-7a63fbf8632b`
- Blueprint: `온라인 서비스` (online-service-standard)
- Decision: **EXTEND** (verified base capability + AIGA customer delta)
- Agent role: Solution Architect
- Status of this doc: scope-lock proposal pending operator confirmation
- Blocks: `BBR-571` `[PB-IDV-KCB-JAR-001]` (JAR 실행 경계/JVM adapter), `BBR-572` `[PB-IDV-KCB-DATA-001]` (결과/동의 데이터 모델)
- Depends on (all `done`): `BBR-496` PB-BASE-001, `BBR-488` PB-DECIDE-001, PB-INFRA-001

> 이 issue는 **범위/계약 lock** 게이트입니다. 실제 세션/콜백 구현, JAR 실행 경계, 데이터
> 모델은 downstream task(BBR-571/BBR-572 등)에서 수행합니다. 본 문서는 그 task들이 추론
> 없이 착수할 수 있도록 **무엇을 재사용하고, 무엇이 AIGA 고객 delta이며, 무엇이 외부
> (KCB/Ok-name·고객) 입력으로 막혀 있는지**를 확정합니다.

---

## 0. 공식 서비스 소개 URL (acceptance 기록 요건)

- 공개 서비스 소개: https://www.ok-name.co.kr/
- KCB 서비스 소개: https://datastore.koreacb.com/site/kcbserviceIntro.do

위 URL은 **소개/참조용**입니다. 요청/응답 필드, 암복호화, 서명/hash, callback payload는
이 URL이 아니라 **고객 KCB/Ok-name 계약·연동가이드·KCB 제공 테스트 자료**에서 확인된 값만
사용합니다 (§5, §6).

---

## 1. 결정: EXTEND (NEW 아님) — 근거와 PB-DECIDE-001 정정

### 1.1 무엇이 바뀌었나
- PB-DECIDE-001(BBR-488)은 KCB를 **NEW** identity gate로 잠갔습니다. 그 값은
  *"PB-BASE-001이 capability registry를 기록하기 전까지 잠정"* 이라는 게이팅 규칙이
  붙어 있었습니다.
- PB-BASE-001(BBR-496)의 8-capability registry는 **identity-verification.kcb를
  열거하지 않았습니다** (PB-BASE-001 산출물의 누락). 그러나 검증된 base ref에는 KCB
  capability가 **완전한 형태로 존재**합니다 (§2).
- 따라서 blueprint 기본값(EXTEND)이 실제 검증된 코드와 일치합니다. **이 build의 KCB는
  NEW가 아니라 EXTEND** 로 확정합니다.

### 1.2 정정 액션
- PB-DECIDE-001 §KCB: `NEW` → `EXTEND` (verified base capability 존재).
- PB-BASE-001 capability registry: `identity-verification.kcb` 를 REUSE/EXTEND
  가능 capability로 **추가 기록 필요** (registry 누락 보완). 본 문서가 그 source map을
  사실상 채웁니다. (재오픈 대신 finding으로 surface — §9.)

> 규칙 적용: "REUSE/EXTEND는 issue가 검증 가능한 source를 명시할 때만 유효." 아래 §2가
> 그 source(repo/path/pinned ref)를 명시합니다.

---

## 2. 검증된 base capability (재사용 source)

- Source repo: `https://github.com/BBrightcode-atlas/product-builder-base`
- Pinned ref: **`main@111d7721dae1aeeef764f3caf0005d16993a704a`** (PB-BASE-001 검증;
  develop 브랜치/태그 없음 → commit SHA pin). 본 delivery repo에 base@111d7721로 vendoring됨.
- Capability path: `product-builder-base:packages/features/identity-verification/kcb@111d7721`
  및 동반 JVM 서비스 `apps/kcb-identity-server@111d7721`.

### 2.1 재사용되는 표면 (있는 그대로 EXTEND)

| 영역 | 경로 | 내용 |
|------|------|------|
| Feature 모듈 | `packages/features/identity-verification/` | Nest module, controller(public+admin), service(세션 수명/replay guard/최소 persistence), kcb bridge client/contracts/error codes, schema, reusable UI |
| 공식 모듈 bridge (JVM) | `apps/kcb-identity-server/` | KCB 공식 **OkCert3** Java 모듈 호출 어댑터(별도 JVM 프로세스), Dockerfile, pom.xml, internal-auth filter, health |
| 앱 UI | `apps/app/src/features/identity-verification/` | `KcbIdentityGate`, `KcbReturnPanel`, `use-kcb-identity`, `open-kcb-popup`, ko/en/ja/zh locale |
| 관리자 UI | `apps/admin/src/features/identity-verification/` | 본인확인 목록/상세/재시도/아카이브, health |

### 2.2 capability IDs (registry)
`packages/features/identity-verification/kcb/contracts.ts` 의 `KCB_CAPABILITY_IDS`:
- `identity-verification.kcb.standard`
- `identity-verification.kcb.jar-bridge`
- `identity-verification.kcb.schema`
- `identity-verification.kcb.rest-api`
- `identity-verification.kcb.ui`
- `identity-verification.kcb.admin`
- `identity-verification.kcb.qa`

### 2.3 노출되는 REST API (재사용)
Public:
- `POST /api/identity-verifications/kcb/sessions`
- `GET  /api/identity-verifications/kcb/sessions/:sessionId`
- `POST /api/identity-verifications/kcb/sessions/:sessionId/link`
- `GET  /api/identity-verifications/kcb/me`
- `POST /api/identity-verifications/kcb/callback`
- `POST /api/identity-verifications/kcb/return`
- `GET|POST /api/identity-verifications/kcb/popup-return`
- `POST /api/identity-verifications/kcb/custom/start` *(custom 모드는 차단 상태)*
- `POST /api/identity-verifications/kcb/custom/verify` *(차단)*

Admin:
- `GET  /api/admin/identity-verifications`
- `GET  /api/admin/identity-verifications/:id`
- `GET  /api/admin/identity-verifications/kcb/health`
- `POST /api/admin/identity-verifications/:id/retry`
- `POST /api/admin/identity-verifications/:id/archive`

Java bridge internal (`Authorization: Bearer $KCB_INTERNAL_AUTH_TOKEN`):
- `GET  /health`
- `POST /internal/kcb/standard/request` · `POST /internal/kcb/standard/verify`
- `POST /internal/kcb/custom/request` · `POST /internal/kcb/custom/verify` *(차단)*
- `POST /internal/kcb/decrypt-result`

---

## 3. Feature 범위 — identity gate (로그인 대체 아님)

- KCB 본인확인은 **로그인 자체가 아니라 보호 액션에서 호출되는 reusable identity gate**
  입니다. 호출 지점: 보호 액션(저장/구매/이용 시작), 결제, 성인/연령 확인, 특정 권한 확인.
- 호출 계약은 코드에 이미 모델링됨 (`createKcbSessionInputSchema.target`):
  `{ action, resourceType?, resourceId?, returnUrl? }` — "왜/어디서 본인확인을
  요구하는가"를 액션 단위로 표현.
- 익명 사용자도 본인확인을 시작할 수 있고, 이후 `state` 비밀값(서버는 hash만 저장)으로
  사용자 계정에 **link** 합니다 — IDOR 방지(다른 사용자가 request id 추측으로 가로채기 불가).
- **standard(휴대폰 팝업) 모드만 활성**. custom 모드는 별도 공식 계약/문서/fixture가
  확인될 때까지 **차단**(`KCB_CUSTOM_MODE_ENABLED=false`).
- 온라인 서비스 규칙 준수: 공개 페이지는 비로그인 탐색 가능, 보호 액션에서 auth/identity
  gate를 띄우고 완료 후 원래 액션으로 복귀.

### 3.1 미선택 시 N/A 규칙 (해당 없음, 규칙만 기록)
- 이 build에서 KCB는 **선택됨** → 본 task 및 PB-IDV-KCB-* 는 실행됨.
- 만약 미선택이면 PB-IDV-KCB-* task는 **삭제하지 않고 N/A 완료 issue**로 남김
  (workflow 불변식). 본 build에는 적용되지 않음.

---

## 4. JAR 실행 경계 (PB-IDV-KCB-JAR-001로 위임)

- acceptance 요건: **기본 Vercel Node runtime에서 JAR을 직접 실행한다고 가정하지 않는다.**
- base는 이미 이 경계를 해결: KCB OkCert3 모듈을 **별도 JVM 프로세스
  `apps/kcb-identity-server`** (Spring Boot, Dockerfile, pom.xml)로 분리하고, Node API는
  `KCB_ADAPTER_BASE_URL` + `KCB_INTERNAL_AUTH_TOKEN` 으로 internal HTTP 호출.
- 따라서 PB-IDV-KCB-JAR-001의 실제 결정은 **이 JVM 어댑터를 어디에 배포할지**:
  Railway(Spring Boot 가이드/네트워킹/변수 docs)가 후보. Vercel(Node)에서 JAR 직접 실행 금지.
- 본 scope task는 경계 결정을 BBR-571로 **위임 확정**만 합니다(중복 구현 금지).

---

## 5. 고객 KCB/Ok-name 계약·연동 문서 체크리스트 (BLOCKER — 외부 입력)

base는 **코리아메디케어(Korea Medicare)** 계약(site code `V72010000000`, JAR
`OkCert3-java1.5-2.3.5.jar`, license `V72010000000_IDS_01_PROD_AES_license.dat`)을
기준으로 구현되어 있습니다. **이 값들은 AIGA의 것이 아닙니다.** AIGA EXTEND delta는
아래를 **AIGA 자체 계약으로 교체**하는 것입니다. 아래는 고객/operator가 제공해야 하며,
확인 전까지 live 검증과 본 issue의 "계약 확정" acceptance는 **blocked**:

- [ ] AIGA KCB/Ok-name **계약 상태**(운영 계약 체결 여부, 회원사 계정)
- [ ] AIGA **운영 site code / service code** (코리아메디케어 `V72010000000` 대체)
- [ ] **연동 가이드 문서 일체** (아래 base가 사용한 문서의 AIGA 버전):
  - `KCB_OkCert3_본인확인서비스_1.공통가이드` (gateway/popup URL, TLS 전제)
  - `KCB_OkCert3_본인확인서비스_2.JAVA모듈가이드` (`kcb.module.v3.OkCert`, `callOkCert(...)`)
  - `KCB_OkCert3_본인확인서비스_3.휴대폰본인확인_팝업` (`IDS_HS_POPUP_START` /
    `IDS_HS_POPUP_RESULT`, request/response key)
  - 팝업 JSP 샘플 (`phone_popup1~4.jsp`)
- [ ] **KCB 제공 테스트 자료 / 테스트 기간**: KCB는 별도 TEST target/site 미제공.
  운영 계약·운영 site code·운영 license로 `KCB_MODE=PROD`, KCB가 운영 환경에 여는
  **제한적 테스트 기간** 중 live 검증. (TEST target 전제 fixture·성공 payload 추측 금지.)
- [ ] **callback / return URL allowlist**: AIGA api-domain의 popup-return/callback URL을
  KCB 계약 allowlist에 등록 (§7 env의 `KCB_STANDARD_RETURN_URL`/`KCB_STANDARD_CALLBACK_URL`).
- [ ] **결과 코드표** (성공 `B000` 등 / 실패 코드 매핑) — UI는 stable code 기반 메시지만 사용.
- [ ] **암복호화·서명/hash 규칙**: license(.dat) 기반 AES, OkCert3 모듈 호출 규약. 문서로
  확인되지 않은 파라미터/hash/redirect payload는 추론 구현 금지 → blocker로 남김.

미확인 항목은 코드의 stable blocker code로 표면화됨(`kcbBlockerCodeSchema`):
`official_documents_required`, `site_code_required`, `return_url_required`,
`popup_url_required`, `jar_required`, `license_required`, `native_library_required`,
`configuration_required`, `custom_mode_not_enabled`.

---

## 6. KCB JAR 파일/버전/checksum 기록 (AIGA delta — BLOCKER)

> 공식 JAR/license/native artifact는 **git에 커밋하지 않음**. 배포 secret/artifact로 주입.
> 아래 표는 AIGA 계약으로 확정 후 채움. base 참고값은 코리아메디케어용임.

| 항목 | base 참고값 (코리아메디케어) | AIGA 확정값 |
|------|------------------------------|-------------|
| OkCert3 JAR 파일명 | `OkCert3-java1.5-2.3.5.jar` | ☐ KCB 제공 (TBD) |
| JAR 버전 | java1.5 / 2.3.5 | ☐ TBD |
| JAR checksum (sha256) | ☐ artifact 수령 후 기록 | ☐ TBD |
| PROD license(.dat) | `V72010000000_IDS_01_PROD_AES_license.dat` | ☐ AIGA site code용 발급 (TBD) |
| native library 필요 여부 | health `nativeLibraryRequired` 로 판정 | ☐ TBD |
| JVM 요구사항 | Spring Boot (pom.xml) | ☐ JAR 호환 JVM 확정 (TBD) |
| 배포 가능 범위 | 별도 JVM 서비스(`apps/kcb-identity-server`) | Railway 등 JVM 호스트 (BBR-571) |

`/health`(및 `/api/admin/identity-verifications/kcb/health`)가 JAR/license/native
**readable + checksum** 을 노출 → `ok:true, blockers:[]` 가 아니면 Node API는 성공
payload를 만들지 않고 stable blocker code 반환.

---

## 7. 테스트/운영 환경변수 목록

> base `.env.demo.example` + 양쪽 README 기준. AIGA 운영값은 §5/§6 확정 후 주입.
> KCB는 TEST target 미제공 → **TEST/PROD 모두 `KCB_MODE=PROD`** (KCB가 운영에 여는 테스트
> 기간으로 검증). 새 환경에 `KCB_MODE=TEST` 설정 금지.

### Java bridge (`apps/kcb-identity-server`)
```
KCB_MODE=PROD
KCB_SITE_CODE=<AIGA 운영 site code>        # base 데모: V72010000000 (코리아메디케어)
KCB_SERVICE_CODE=<AIGA service code>
KCB_SITE_NAME=<AIGA 계약 사이트명>
KCB_SITE_URL=https://<AIGA public app origin>
KCB_POPUP_URL=https://safe.ok-name.co.kr/CommonSvl
KCB_STANDARD_RETURN_URL=https://<api-domain>/api/identity-verifications/kcb/popup-return
KCB_STANDARD_CALLBACK_URL=https://<api-domain>/api/identity-verifications/kcb/callback
KCB_INTERNAL_AUTH_TOKEN=<Node↔Java 내부 토큰, 사용자 비노출>
KCB_MODULE_JAR_PATH=<주입된 JAR 경로>
KCB_LICENSE_PATH=<주입된 PROD license 경로>
KCB_NATIVE_LIB_PATH=<필요 시>
KCB_LOG_DIR=<로그 경로>
KCB_OFFICIAL_SOURCE_MAP=<AIGA 계약/문서 internal 기록>
```

### Node API (`apps/server`)
```
KCB_ADAPTER_BASE_URL=https://<JVM 어댑터 호스트>      # 로컬: http://localhost:18999
KCB_INTERNAL_AUTH_TOKEN=<Java bridge와 동일>
KCB_STANDARD_RETURN_URL=https://<api-domain>/api/identity-verifications/kcb/popup-return
KCB_STANDARD_CALLBACK_URL=https://<api-domain>/api/identity-verifications/kcb/callback
KCB_CUSTOM_MODE_ENABLED=false
```

- secret(`KCB_INTERNAL_AUTH_TOKEN`, license, JAR)은 PB-INFRA-001 env 매핑/Vercel·JVM
  호스트 secret로 주입. 코드/리포에 평문 금지.
- network: JVM bridge host는 `https://safe.ok-name.co.kr` outbound 접속 필요.

---

## 8. 개인정보 최소 저장 정책

- **주민등록번호(RRN) 저장 금지.** 코드 verify 응답은 `ciHash`/`diHash`, `nameMasked`,
  `birthYear`/`birthDateMasked`, `phoneMasked` 등 **마스킹/해시 값만** 다룸
  (`kcbAdapterVerifyResponseSchema`).
- CI/DI는 **연계용 식별값**으로만 사용, 원문 개인정보 최소화 — 정책상 허용된 최소값만 persist.
- 사용자 화면에 provider raw error, 서버 stack trace, KCB 원문 reason **표시 금지** →
  stable code 기반 i18n 메시지만 노출 (프로젝트 CLAUDE.md §5 user-facing-error 규칙 일치).
- replay guard: `state`/`nonce`(각 ≥16) + 서버측 hash 저장으로 재생/IDOR 방지.
- 보존/삭제 정책: 본인확인 레코드 retention·archive(`/:id/archive`) 정책을 PB-IDV-KCB-DATA-001
  (BBR-572)에서 데이터 모델과 함께 확정 (본 문서는 "최소 저장 + 마스킹/해시 + RRN 금지"를 lock).

---

## 9. Findings / follow-ups

1. **PB-BASE-001 registry 누락**: identity-verification.kcb capability가 검증된 base에
   존재하나 PB-BASE-001 8-capability registry에 미열거. 본 문서가 source map을 보완.
   PB-BASE-001 재오픈은 불필요(이미 done) — registry 보완은 본 EXTEND scope로 흡수.
2. **PB-DECIDE-001 §KCB**: `NEW` → `EXTEND` 정정(operator 확인 대상, §1).
3. **고객 계약 handoff**: §5/§6의 AIGA KCB/Ok-name 계약·JAR·license·site code·callback
   allowlist·결과 코드표는 **operator/고객** 제공 필요. live 검증 및 본 issue "계약 확정"
   acceptance의 gating blocker. downstream live/deploy(BBR-571 배포, QA)에서 재확인.

---

## 10. Acceptance 매핑

| Acceptance 기준 | 상태 |
|-----------------|------|
| 계약 상태/테스트 계정/운영 전환/서비스·site code/callback·return URL 구현 전 확정 | ⛔ **BLOCKED on 고객** (§5 체크리스트로 확정 대기) |
| JAR 파일명/버전/checksum/배포 범위/JVM 요구사항 issue 기록 | 🟡 base 참고값 기록·AIGA값 §6 대기(고객) |
| 공개 서비스 소개 URL 기록 (ok-name.co.kr) | ✅ §0 |
| KCB 서비스 소개 URL 기록 (datastore.koreacb.com) | ✅ §0 |
| 암복호화/서명/hash/요청·응답 필드는 공식 문서·KCB 테스트 자료 확인값만 사용 | ✅ 정책 lock(§5/§8), 미확인은 blocker로 |
| Vercel Node에서 JAR 직접 실행 가정 금지 → JAR 경계는 PB-IDV-KCB-JAR-001 | ✅ §4 (별도 JVM 서비스 존재, 경계 BBR-571 위임) |
| 본인확인은 로그인 아님 — 보호 액션/결제/성인/권한에서 호출되는 reusable capability | ✅ §3 |
| 미선택 시 PB-IDV-KCB-* 삭제 금지, N/A 완료로 유지 | ✅ §3.1 (이 build은 선택됨) |

**결론**: 범위·재사용·env·개인정보·JAR 경계 위임은 **lock 가능**. "고객 계약 확정"
계열 acceptance는 AIGA KCB/Ok-name 계약 handoff(§5/§6) 수령 전까지 **외부 blocked**.
