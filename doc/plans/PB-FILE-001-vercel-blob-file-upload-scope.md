# PB-FILE-001 — Vercel Blob 파일 업로드 capability 범위

- Issue: `BBR-546` `[PB-FILE-001]`
- Product Builder build: `bp-0b891299-66b7-438f-a3a4-7a63fbf8632b`
- Blueprint: `온라인 서비스` (online-service-standard)
- Role: Solution Architect
- Decision: **EXTEND** (`file-upload.vercel-blob.scope`)
- Status 선행: PB-BASE-001(BBR-496) ✅ done · PB-INFRA-001(BBR-499) ✅ done · PB-DECIDE-001(BBR-488) ✅ done
- 작성일: 2026-06-29

> 이 문서는 파일 업로드를 **Product Builder 기본 제공 feature**로 고정하고, 그 base 구현 작업을
> `product-builder-base` capability EXTEND 작업으로 하위 issue 묶음(PB-FILE-DATA-001 ~ PB-FILE-QA-001)에
> 전달하기 위한 범위/정책 확정 문서다. 본 issue는 코드 구현이 아니라 **범위·환경·정책의 확정과 핸드오프**가 deliverable이다.

---

## 1. 결정 요약 (locked)

| 항목 | 결정값 | 근거 |
|---|---|---|
| 분류 | **Product Builder 기본 feature** (선택형 도메인 카드 아님) | 워크플로 룰: 파일 업로드 = 필수 재사용 capability |
| Provider | **Vercel Blob** (`@vercel/blob`) | 워크플로 룰 + base 의존성(`@vercel/blob` 1.1) |
| 판정 | **EXTEND** | base에 server helper + UI primitive 존재, feature 모듈/REST/스키마/관리자 UI는 없음 |
| Source of truth | `product-builder-base:packages/features/file-upload/vercel-blob@111d7721` | PB-BASE-001 검증 ref(`main@111d7721`, develop/tag 없음) |
| 기본 access | **private (서명 접근)** 기본, 자산별 public 화이트리스트 | base 헬퍼의 `access:"public"` 하드코딩은 EXTEND에서 정책화 필요(아래 §5) |
| 배포 환경 | Neon + Vercel | PB-INFRA-001 |

### 공식 문서 기준 (최초 구현 시 추론 금지)

최초 구현은 아래 공식 문서를 1차 기준으로 한다. 문서로 확인되지 않은 파라미터/콜백/토큰 정책은 follow-up/blocker로 남긴다.

- Overview: https://vercel.com/docs/vercel-blob
- Client upload: https://vercel.com/docs/vercel-blob/client-upload
- Server upload: https://vercel.com/docs/vercel-blob/server-upload

---

## 2. base 현황과 EXTEND delta

PB-BASE-001 검증 결과: `file-upload/vercel-blob`은 **헬퍼 + UI primitive만 존재하고 feature 모듈이 없다 → EXTEND delta 구현**.

### 2.1 base에 이미 있는 것 (REUSE 대상, 검증 ref `@111d7721`)

| 경로 | 내용 | 재사용 방식 |
|---|---|---|
| `packages/core/storage/blob.ts` | **server upload** 헬퍼: `uploadDataUrlToBlob`, `uploadBufferToBlob`, `deleteBlob`. `put(..., {access:"public", addRandomSuffix})` / `del(url)` | 서버 측 업로드/삭제 1차 재사용. `access` 정책화 필요 |
| `packages/core/storage/{storage.service.ts,types.ts,index.ts}` | S3/R2/local presigned URL 추상화(`StorageProvider`) — **Vercel Blob과 별개 레이어, 미연결** | Vercel Blob 경로에는 미사용. 혼선 방지 위해 feature는 `blob.ts`만 사용 |
| `packages/ui/src/components/file-uploader.tsx` | hook-free DnD 업로더(순수 컴포넌트, `onUpload` 주입) | 재사용 UI(BBR-554) base |
| `packages/ui/src/hooks/use-file-upload.ts` | 파일 상태/검증/미리보기 hook(`maxFiles/maxSize/accept`) | 재사용 UI(BBR-554) base |
| `apps/server/src/config/env.ts` | 서버 env 권위(현재 `DATABASE_URL`만 hard-required) | `BLOB_READ_WRITE_TOKEN` 추가 매핑 |

### 2.2 base에 없는 것 = EXTEND delta (구현 대상)

- ❌ **feature 모듈** (`packages/features/file-upload/`): 데이터·정책·REST를 묶는 경계가 없음.
- ❌ **client upload 토큰 플로우**: base `blob.ts`는 server upload(data URL/buffer) 전용. 대용량/직접 업로드용 `handleUpload`(`onBeforeGenerateToken` / `onUploadCompleted`) 미구현 → 공식 client-upload 문서 기준 신규.
- ❌ **metadata 스키마**: 소유자/대상 리소스/접근정책/크기/타입/상태(pending→completed)를 담는 DB 테이블 없음.
- ❌ **REST API**: 업로드 생성·완료·목록·상세·수정·삭제 엔드포인트 없음(OpenAPI 계약 = PB-API-001).
- ❌ **access 정책 레이어**: `access:"public"` 하드코딩 → private 기본 + 서명 URL + 소유자 검증으로 정책화.
- ❌ **관리자/감사 UI**, **QA 체크리스트**.

> EXTEND 원칙: 위 base 자산(§2.1)을 재사용하고, **누락된 delta(§2.2)만** 고객/Provider-specific 으로 구현한다. base를 통째로 재작성하지 않는다.

---

## 3. Vercel Blob store / env checklist

### 3.1 `BLOB_READ_WRITE_TOKEN` 주입 (AC: Dev/Preview/Production env 기록)

Vercel 프로젝트에 Blob store를 연결하면 `BLOB_READ_WRITE_TOKEN`이 자동 주입된다. 본 빌드는 4개 Vercel 프로젝트(site/app/admin/server, PB-INFRA-001)를 쓰므로, **파일 업로드 서버 경로를 소유하는 프로젝트에 토큰을 매핑**한다.

| 환경 | 주입 방법 | 적용 Vercel 프로젝트 | 비고 |
|---|---|---|---|
| **Production** | Vercel Storage → Blob store 연결 시 자동, 또는 Project Settings → Environment Variables 수동 | `aiga-server`(업로드 토큰/완료 API 소유), 필요 시 `aiga-app` SSR/route | Production scope only |
| **Preview** | 동일 store의 Preview 토큰 (Vercel가 환경별 분리) | `aiga-server`, `aiga-app` | PR/Preview 배포 검증용 |
| **Development** | `vercel env pull .env.local` 로 로컬 주입(서버에서만 사용) | 로컬 `apps/server` | 클라이언트 번들에 노출 금지 |

- 로컬 reference: `.env.example:165` `BLOB_READ_WRITE_TOKEN=vercel_blob_rw_your_token_here`, `.env.dummy.reference:44`, `.env.demo.reference:29`(optional/image upload).
- 서버 env 권위(`apps/server/src/config/env.ts`)에 `BLOB_READ_WRITE_TOKEN`을 **optional → 파일 feature 활성 시 required** 로 추가(PB-FILE-DATA-001/CREATE-001에서 반영).
- 토큰은 **서버 전용 secret**. `VITE_`/`NEXT_PUBLIC_` 등 클라이언트 노출 prefix로 절대 매핑하지 않는다. client upload는 서버가 발급하는 단기 토큰만 사용.
- 실제 store id/URL/토큰 주입 증거(스크린샷/`vercel env ls`)는 **PB-INFRA-001b(BBR-719, 운영 creds 대기)** 와 PB-FILE-QA-001(BBR-556)에서 채운다. 본 scope issue는 매핑 규칙만 확정.

---

## 4. 업로드 모델 (server vs client)

| 방식 | 사용처 | 기준 문서 | 비고 |
|---|---|---|---|
| **Server upload** | 소형 자산(이미지 등 ≤ 4.5MB 본문), 서버가 바이트를 이미 가진 경우 | server upload 문서 | base `blob.ts` 재사용 |
| **Client upload (token)** | 대용량/직접 업로드(Vercel 함수 본문 4.5MB 한계 회피) | client upload 문서 | 신규 delta. 서버가 `onBeforeGenerateToken`에서 소유자/타입/크기 검증, `onUploadCompleted`로 metadata 확정 |

- 기본 권장 경로 = **client upload**(BBR-548 token 발급 → BBR-549 완료 확정). server upload는 소형 내부 자산 fallback.

---

## 5. 접근 / 보존 / 삭제 정책 (구현 전 확정)

> AC: 파일 타입·최대 크기·소유자/대상 리소스·공개 URL 허용 여부·삭제/retention 정책이 **구현 전 확정**되어 있어야 한다.

### 5.1 접근(access) 정책

- **기본값: private**. 소유자/권한 검증을 통과한 요청에만 단기 서명 접근 URL을 발급(BBR-551 read API).
- **public 허용 = 화이트리스트**: 명시적으로 공개로 표시된 자산 유형(예: 공개 프로필 이미지, 공개 게시물 첨부)만 `access:"public"`.
  - base `blob.ts`의 `access:"public"` 하드코딩은 EXTEND에서 **metadata의 `visibility(public|private)` 플래그로 분기**하도록 수정(BBR-547/548).
- 공개 페이지 탐색은 비로그인 허용(워크플로 룰). **업로드/삭제/수정 등 보호 액션**은 로그인 모달(PB-AUTH-003=BBR-518, done) 패턴으로 게이트.

### 5.2 파일 타입 / 크기 (locked 기본값)

| 항목 | 기본 정책 | 비고 |
|---|---|---|
| 허용 MIME | image: `image/png,image/jpeg,image/webp,image/gif` · document: `application/pdf` · 그 외는 feature별 화이트리스트 확장 | server에서 `contentType` 검증, 확장자 추론 금지 신뢰 |
| 차단 | 실행/스크립트(`.exe,.sh,.js,.html`), `image/svg+xml`(XSS 위험)은 기본 차단 | 필요 시 sanitize 후 허용 |
| 최대 크기 | 기본 **10MB**(UI hook 기본과 일치) · 영상은 **대상 아님**(Cloudflare Stream=PB-VIDEO) | client upload 토큰 발급 시 서버가 enforce |
| 최대 개수 | 기본 5(멀티) | UI hook 기본 |

> 위 수치는 locked 기본값이며, 개별 도메인 feature가 필요 시 상향/하향을 **자기 feature 범위 내에서** 조정한다. PB-FILE은 정책 enforcement 지점만 제공.

### 5.3 소유자 / 대상 리소스

- 모든 파일 row는 `ownerUserId`(업로더)와 `targetType`/`targetId`(연결 리소스, 예: `post:{id}`, `profile:{userId}`) 를 가진다.
- 권한 모델: 소유자 또는 대상 리소스 권한 보유자만 read(서명)/update/delete. admin은 감사 목적 전체 조회(BBR-555).

### 5.4 보존(retention) / 삭제 / orphan 정리

- **삭제**: row soft-delete 후 `deleteBlob(url)`로 Blob 물리 삭제(base 헬퍼, idempotent — 404 무시). (BBR-553)
- **orphan**: client upload 토큰만 발급되고 `onUploadCompleted` 미도달한 **pending row**는 TTL(기본 24h) 경과 시 정리 잡 대상. 대상 리소스 삭제 시 연결 파일 cascade 삭제/정리.
- **교체**: 기존 자산 교체 시 새 Blob 업로드 → row URL 갱신 → 구 Blob `deleteBlob` (누적 방지).
- 개인정보/민감 자산은 private 기본 + 접근 로그(감사 UI BBR-555)로 추적.

---

## 6. base 구현 전달 issue 목록 (handoff bundle)

파일 업로드는 **단일 거대 issue로 두지 않고** provider/env(본 scope) · 데이터 모델 · 생성/완료/목록/상세/수정/삭제 REST · 재사용 UI · 관리자 UI · QA 로 분리되어 이미 board에 고정 생성되어 있다. 본 PB-FILE-001은 이 묶음의 **scope/정책 게이트**이며, done 시 하위 묶음이 순차 unblock 된다.

| Issue | PB id | Stage | Decision | Assignee | 의존(blockedBy) |
|---|---|---|---|---|---|
| **BBR-546** | `PB-FILE-001` | Scope/Provider·Env | EXTEND | SA (this) | 496,488,499 ✅ |
| BBR-547 | `PB-FILE-DATA-001` | metadata/권한 데이터 모델 | EXTEND | Backend | 546 |
| BBR-548 | `PB-FILE-API-CREATE-001` | 업로드 생성/token API | EXTEND | Backend | 547 |
| BBR-549 | `PB-FILE-API-COMPLETE-001` | 업로드 완료 확정 API | EXTEND | Backend | 548 |
| BBR-550 | `PB-FILE-API-LIST-001` | 파일 목록 조회 API | EXTEND | Backend | 549 |
| BBR-551 | `PB-FILE-API-READ-001` | 상세/접근(서명) URL API | EXTEND | Backend | 550 |
| BBR-552 | `PB-FILE-API-UPDATE-001` | metadata 수정 API | EXTEND | Backend | 551 |
| BBR-553 | `PB-FILE-API-DELETE-001` | 삭제/Blob 정리 API | EXTEND | Backend | 550 |
| BBR-554 | `PB-FILE-UI-001` | 재사용 파일 업로드 UI | EXTEND | Frontend | 548,549,518,501 |
| BBR-555 | `PB-FILE-ADMIN-001` | 관리자/감사 UI | EXTEND | Frontend | 550,551,553 |
| BBR-556 | `PB-FILE-QA-001` | E2E/보안/운영 검증 | EXTEND | QA | 553,554,555 |

### 의존 그래프 (feature 내부)

```text
546(scope) → 547(data) → 548(create/token) → 549(complete) → 550(list) ┐
                              └→ 554(UI) ←┘                              ├→ 551(read) → 552(update)
                                                                        ├→ 553(delete)
                                                                        └→ 555(admin)
548,549,(518,501) → 554(UI) ─┐
550,551,553 → 555(admin) ────┼→ 556(QA)
553 ─────────────────────────┘
```

### 각 하위 issue가 본 문서에서 받는 입력

- **DATA(547)**: §5.3 소유자/대상 스키마, §5.1 `visibility` 플래그, §5.4 pending/TTL 상태 컬럼.
- **CREATE(548)**: §4 client upload 토큰 플로우, §5.2 타입/크기 enforcement(`onBeforeGenerateToken`), §3 env.
- **COMPLETE(549)**: §4 `onUploadCompleted` → metadata 확정.
- **LIST/READ/UPDATE/DELETE(550–553)**: §5.1 권한·서명 URL, §5.4 삭제/orphan/교체.
- **UI(554)**: §2.1 base `file-uploader.tsx`/`use-file-upload.ts` 재사용 + §5.1 보호액션 로그인 모달.
- **ADMIN(555)**: §5.3 감사 조회 + §5.4 보존/접근 로그.
- **QA(556)**: §3 env 증거, §5 정책 전체, public/private 접근 경계, orphan 정리.

---

## 7. Acceptance Criteria 매핑

| AC | 충족 위치 |
|---|---|
| 파일 업로드 = 기본 feature(선택 카드 아님) | §1 분류 = 기본 feature |
| Vercel Blob overview URL 기록 | §1 공식 문서 기준 |
| client upload URL 기록 | §1, §4 |
| server upload URL 기록 | §1, §4 |
| `BLOB_READ_WRITE_TOKEN` Dev/Preview/Prod 주입 방법 기록 | §3.1 |
| 타입·크기·소유자/대상·공개 URL 허용·삭제/retention 확정 | §5.1–§5.4 |
| PB-FILE-* 묶음 그대로 전달 가능 | §6 (board 12-issue + 의존 그래프 + 입력 매핑) |

---

## 8. 미해결/후속 (구현 게이트)

- **운영 env 증거**: 실제 Blob store id, 토큰 주입 스크린샷/`vercel env ls`는 운영 creds 대기(**PB-INFRA-001b / BBR-719**, owner=operator) → QA(556)에서 캡처. 본 scope는 매핑 규칙만 확정.
- **base `access:"public"` 정책화**: DATA(547)/CREATE(548)에서 `visibility` 분기로 수정 — base 헬퍼 시그니처 보강이 필요하면 product-builder-base 측 PR로 환류.
- 크기/타입 수치(§5.2)는 locked 기본값. 개별 도메인 feature 요구가 다르면 해당 feature issue에서 조정.
