# PB-FILE-API-COMPLETE-001 — 파일 업로드 완료 확정 API

- Issue: `BBR-549` `[PB-FILE-API-COMPLETE-001]`
- Decision: **EXTEND** (`file-upload.api.complete`)
- Area: 서버/API — `packages/features/file-upload` (NestJS feature module), wired into `apps/server`
- Depends on: PB-FILE-API-CREATE-001 (`POST /files/uploads`, BBR-548 ✅ merged), PB-FILE-DATA-001 (`file_assets`)
- 공식 기준: https://vercel.com/docs/vercel-blob (`head`, `del`) — 추론 금지

## 무엇을 구현했나

`POST /files/uploads/complete` — client upload(`put()`)가 끝난 뒤 **서버가** 업로드된 blob 을
재검증하고 file metadata 를 `ready`(active)로 확정한다. 생성 단계(BBR-548)는 pending row +
client token 만 발급했고, 완료 확정·서버 재검증·orphan 롤백 경계가 없었다 → 이 delta 만 구현(EXTEND).

### 요청 / 응답

```
POST /files/uploads/complete    (Authorization: Bearer <session>)
{ fileAssetId }
→ 200 { fileAssetId, status:"ready", pathname, url, downloadUrl?, contentType, size, visibility, targetType?, targetId?, completedAt }
```

클라이언트는 생성 응답에서 받은 `fileAssetId` **만** 보낸다. Blob URL·pathname·size·contentType 은
받지 않는다 → 임의 Blob URL 주입 불가(AC①). 서버는 자신이 저장한 pending row 의 `pathname` 으로
`@vercel/blob` `head()` 를 호출해 **저장소 자신이 보고하는** url/size/contentType 을 진실로 삼는다.

## 흐름

1. `fileAssetId` 로 pending row 조회 → 없거나 **소유자 불일치면 404**(존재 노출 없이 권한 재확인, AC④).
2. status 분기:
   - `ready` → 그대로 반환(중복/재호출 idempotent 수렴, AC②).
   - `deleted` → 404(soft-deleted 자산은 재확정 불가).
   - `pending`/`failed` → 저장소 재검증 진행(`failed` 는 재시도 허용).
3. `head(row.pathname)` 로 서버 진실 metadata 읽기.
   - blob 없음(`BlobNotFoundError`→`null`) 또는 `head.pathname` 불일치 → **orphan**: row `failed` 표시 + `422 upload_not_found`(AC③).
   - 일시 오류(throw) → row 유지(pending) + 친절한 `503`(재시도 가능).
4. 서버 보고 metadata 를 정책으로 **재검증**(`validateCompletedBlob`): 허용 타입·확장자 일치·크기 ceiling.
   - 위반 → **롤백**: blob 바이트 삭제(`del`) + row `failed` + `422`(client 결과 불신, AC④).
5. 활성화: `status=ready`, `blob_url=head.url`, `download_url`, `content_type`, `size`, `completed_at=now`, `expires_at=null`.

## Acceptance Criteria 매핑

| AC | 구현 | 검증 |
|----|------|------|
| ① 완료 요청은 pending metadata 와 매칭, 임의 Blob URL 주입 불가 | 입력은 `fileAssetId` 뿐; 서버 저장 `pathname` 으로만 `head()` 조회 | service node:test(`head` 가 server pathname 으로 호출됨), DTO(fileAssetId only) |
| ② 중복 완료/callback 은 같은 file asset 으로 수렴 | `ready` 면 재검증 없이 그대로 반환; 활성화 update 는 `status≠deleted` 가드 | service node:test(idempotent: head 미호출·write 없음) |
| ③ 실패/취소 업로드 orphan 정리 정책 | blob 없음 → `failed` 표시(+pending TTL sweep 대상); 정책 위반 → `del` 로 바이트 삭제 + `failed` | service node:test(orphan→failed, 정책위반→del+failed) |
| ④ client 결과 불신 — 서버 상태·권한 재확인 | 소유자 재검증(404); `head()` 서버 진실 + `validateCompletedBlob` 재검증 | service node:test(owner mismatch, 정책 재검증, transient 503) |

## 신뢰 경계 (trust boundary)

- 클라이언트가 보내는 것은 `fileAssetId` 뿐. url/size/contentType 은 **읽지 않는다**.
- 활성화에 쓰는 값은 전부 저장소 `head()` 보고값(서버 진실). 권한/공개 결정은 이 검증 컬럼만 읽는다.
- `head()` 는 **server 가 발급했던 pathname** 으로만 조회하므로 다른 위치의 blob 을 가리킬 수 없다.

## Orphan 정리 정책 (PB-FILE-001 §5.4)

- 완료 시 검증 실패한 업로드는 즉시 롤백: `failed` 표시 + (바이트가 있으면) `del` 로 삭제.
- 끝내 완료되지 않은 `pending` row 는 `expires_at`(기본 24h) 경과 시 cleanup 잡 대상
  (데이터 모델의 `idx_file_assets_status_expires` 인덱스가 이 sweep 를 지원). cleanup 잡 자체는 별도 capability.

## 환경 변수

| 변수 | 용도 | 비고 |
|------|------|------|
| `BLOB_READ_WRITE_TOKEN` | `head`/`del` 호출(서버 전용 secret) | 미설정 시 reader 없음 → 친절한 503(상세 누설 X). 실제 주입 = PB-INFRA-001b(BBR-719) |

## 테스트

- `service/file-upload-complete.service.node-test.ts` — 활성화/idempotent/owner mismatch/unknown/deleted/orphan/pathname mismatch/정책위반 롤백/transient 503/미구성 503 (10 케이스).
- `policy/upload-policy.node-test.ts` — `validateCompletedBlob` 허용/타입/확장자/크기 (4 케이스 추가).
- `controller/file-upload.controller.spec.ts` — `completeUpload` user/body 전달 + `BetterAuthGuard` 가드 (jest 2 케이스 추가).

## 파일

- `service/file-upload.service.ts` — `completeUpload` + 헬퍼(load/verify/activate/rollback) 추가.
- `service/blob-store.ts` — `@vercel/blob` `head`/`del` 격리 어댑터(`createBlobHeadReader`/`createBlobDeleter`).
- `policy/upload-policy.ts` — `validateCompletedBlob`(서버 보고 metadata 재검증).
- `dto/file-upload.dto.ts` — `CompleteUploadDto` + `completedUploadOpenApiSchema`.
- `controller/file-upload.controller.ts` — `POST complete` 라우트.
- `file-upload.module.ts` — head/del 어댑터 주입.
