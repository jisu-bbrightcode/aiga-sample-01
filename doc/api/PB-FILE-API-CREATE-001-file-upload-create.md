# PB-FILE-API-CREATE-001 — 파일 업로드 생성/token API

- Issue: `BBR-548` `[PB-FILE-API-CREATE-001]`
- Decision: **EXTEND** (`file-upload.api.create`)
- Area: 서버/API — `packages/features/file-upload` (NestJS feature module), wired into `apps/server`
- Depends on: PB-FILE-DATA-001 (`file_assets`, BBR-547 ✅ merged), PB-AUTH-002 (BetterAuthGuard)
- 공식 기준: https://vercel.com/docs/vercel-blob/client-upload (추론 금지)

## 무엇을 구현했나

`POST /files/uploads` — 인증된 사용자가 Vercel Blob **client upload** 를 시작할 때
필요한 서버 endpoint/token/metadata draft 를 발급한다. base file-upload capability 에는
서버측 `put()` 헬퍼(`packages/core/storage/blob.ts`)만 있었고 client-upload 토큰 플로우·정책·
REST 경계가 없었다 → 이 delta 만 구현(EXTEND).

### 요청 / 응답

```
POST /files/uploads        (Authorization: Bearer <session>)
{ filename, contentType, size, visibility?, targetType?, targetId? }
→ 201 { fileAssetId, pathname, clientToken, contentType, maximumSizeInBytes, visibility, expiresAt }
```

클라이언트는 받은 `clientToken` 으로 `@vercel/blob/client` 의
`put(pathname, file, { access: "public", token: clientToken, contentType })` 를 호출해
Blob 에 직접 업로드한다. 업로드 완료 시 Blob 이 완료 콜백(`POST /files/uploads/callback`)을
호출하며, 완료 확정(서버 검증 metadata → `ready`)은 **BBR-549(PB-FILE-API-COMPLETE-001)** 가 담당한다.

## Acceptance Criteria 매핑

| AC | 구현 | 검증 |
|----|------|------|
| ① 인증/권한 없는 사용자는 토큰/시작 정보를 못 받는다 | `@UseGuards(BetterAuthGuard)` + `@CurrentUser()`; 서비스는 non-null `ownerUserId` 필수 | controller jest spec(guard 메타데이터 + user.id 전달) |
| ② 허용되지 않은 MIME/확장자/크기는 422/정책 오류 | `upload-policy.ts` allowlist(image png/jpeg/webp/gif + pdf), svg/exe/script 차단, 10MB ceiling, 확장자-타입 일치 검사 → `UploadPolicyError` → `422 UnprocessableEntity` | policy node:test(허용/차단/확장자/크기) + service node:test(422·미발급) |
| ③ Blob pathname 은 충돌/추측이 어려운 서버 정책 | `buildBlobPathname` = `uploads/{visibility}/{YYYY}/{MM}/{ULID}.{ext}`; 토큰은 `addRandomSuffix:false` 로 이 경로에 고정 → 클라이언트가 경로를 못 정함 | policy node:test(경로 형태·고유성) + service node:test(row.pathname) |
| ④ client upload 파라미터·callback 흐름은 공식 문서 기준 | `generateClientTokenFromReadWriteToken({ pathname, allowedContentTypes, maximumSizeInBytes, validUntil, onUploadCompleted:{ callbackUrl, tokenPayload } })` | service node:test(token 파라미터 바인딩) + OpenAPI 계약 |

## 정책 (PB-FILE-001 §5 locked)

- 허용 타입: `image/png`, `image/jpeg`, `image/webp`, `image/gif`, `application/pdf`.
- 차단: `image/svg+xml`(XSS), 실행/스크립트, 확장자-타입 불일치, path separator/제어문자/숨김 파일명.
- 최대 크기: 10MB. 토큰의 `maximumSizeInBytes` 는 **선언 크기**로 cap(과대 업로드 방지).
- visibility 기본 **private**. Blob 저장 access 는 `public`(SDK 제약)이나, private 자산은 API 가
  URL 을 노출하지 않고 ULID 경로로 추측을 차단한다 → 노출/서명 접근은 read API(BBR-551).
- pending row TTL 기본 24h → orphan 정리 잡 대상(PB-FILE-001 §5.4).

## 신뢰 경계 (trust boundary)

- 요청의 `contentType`/`size` 는 **선언값(untrusted)** → `declared_content_type`/`declared_size` 에 저장,
  토큰 발급 게이트로만 사용.
- 서버 검증 `content_type`/`size`/`checksum` 는 완료(BBR-549) 시 `onUploadCompleted` 에서 확정.
- pending row 의 `blob_url` 은 잠정값(pathname)이며 완료 시 canonical Blob URL 로 덮어쓴다.
  pending 자산은 공개 제공되지 않으므로 잠정값이 노출되지 않는다.

## 환경 변수

| 변수 | 용도 | 비고 |
|------|------|------|
| `BLOB_READ_WRITE_TOKEN` | client 토큰 발급(서버 전용 secret) | 미설정 시 친절한 503 반환(상세 누설 X). 실제 주입 증거 = PB-INFRA-001b(BBR-719) |
| `FILE_UPLOAD_PUBLIC_BASE_URL` | 이 서버의 공개 절대 URL → 완료 콜백 `/files/uploads/callback` 구성 | 선택. 미설정 시 토큰에 콜백 미부착(토큰 자체는 동작) |

## 파일

- `packages/features/file-upload/policy/upload-policy.ts` — 순수 정책/경로 (framework-free)
- `packages/features/file-upload/dto/file-upload.dto.ts` — zod 입력 + OpenAPI 응답 스키마
- `packages/features/file-upload/service/file-upload.service.ts` — 검증→pending row→토큰 발급
- `packages/features/file-upload/service/blob-client-token.ts` — `@vercel/blob/client` 어댑터(주입)
- `packages/features/file-upload/controller/file-upload.controller.ts` — `POST /files/uploads`
- `packages/features/file-upload/file-upload.module.ts` — wiring (app.module 에 등록)
- 테스트: `policy/upload-policy.node-test.ts`, `service/file-upload.service.node-test.ts`(node:test),
  `controller/file-upload.controller.spec.ts`(jest)
- 계약: `doc/contract/PB-FILE-API-CREATE-001-file-upload-create.openapi.yaml`

## 다음 단계 / 핸드오프

- **BBR-549 (COMPLETE)**: `POST /files/uploads/callback` 구현 — `onUploadCompleted` 검증, pending→ready,
  서버 검증 metadata(`content_type`/`size`/`checksum`) 확정, `blob_url` canonical 갱신.
- 실제 Blob store 토큰 주입/스크린샷: PB-INFRA-001b(BBR-719) · QA: PB-FILE-QA-001(BBR-556).
