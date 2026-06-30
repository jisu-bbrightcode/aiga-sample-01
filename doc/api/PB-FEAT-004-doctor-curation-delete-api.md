# PB-FEAT-004 — 명의 삭제/archive API (BBR-540)

- Capability: `domain.feature.fr-004.api.delete`
- Decision: **NEW** (Backend Engineer)
- Depends on: FEAT-FR-004-API-READ (#48), FEAT-FR-004-API-CREATE (#40), PB-FEAT-004-DATA (schema)
- Target: `packages/features/doctor-curation` (wired into `apps/server`)

## 결정값과 근거

도메인 기능 카드 **"명의"**의 **삭제/archive API**다. 기능 리소스(명의 컬렉션/기획전,
`service_doctor_collections`)를 **물리 삭제하지 않고** soft delete / archive 로 처리하여
노출을 차단하되 연결 데이터를 보존하고, 복구 가능하도록 REST/OpenAPI 계약에 맞춘다.

스키마는 PB-FEAT-004 데이터 모델에 이미 존재하는 컬럼만 사용한다 (`status` enum
`draft|published|archived`, soft-delete `is_deleted`/`deleted_at`, 감사용 `updated_by`/`updated_at`).
**새 마이그레이션은 없다.**

## 엔드포인트 (admin, `BetterAuthGuard` + `BetterAuthAdminGuard`)

베이스 경로: `service/curation/admin/collections`

| Method | Path           | 동작        | 상태 전이                                   |
| ------ | -------------- | ----------- | ------------------------------------------- |
| POST   | `/:id/archive` | 노출 차단   | `status → archived` (비삭제 컬렉션만)        |
| DELETE | `/:id`         | soft delete | `is_deleted → true`, `deleted_at → now()`    |
| POST   | `/:id/restore` | 복구        | `is_deleted → false`, `deleted_at → null`, `status → draft` |

모든 응답은 `AdminCollectionDetailDto` (전체 행 + 수록 의사 items + `viewerState`).
인증 없음 → 401, 관리자 아님 → 403, 잘못된 UUID → 400(`ParseUUIDPipe`), 없음 → 404.

### 멱등성

- `archive`: 이미 `archived` 면 추가 write 없이 200(현재 상태).
- `DELETE`: 이미 삭제됐어도 200(현재 상태). 존재한 적 없으면 404. (존재/삭제 구분을 위해
  `is_deleted` 필터 없이 조회)
- `restore`: 이미 활성(비삭제·비archive)이면 변경 없이 200 — 게시 상태를 함부로 내리지 않는다.

## 노출 정책 (AC: 삭제/archive 후 공개/앱/관리자 노출이 명확)

| 상태                          | 공개(site) / 앱 | 관리자 목록 | 관리자 상세 |
| ----------------------------- | --------------- | ----------- | ----------- |
| `published`, `is_deleted=f`   | ✅ 노출         | ✅          | ✅          |
| `draft`, `is_deleted=f`       | ❌              | ✅          | ✅          |
| `archived`, `is_deleted=f`    | ❌ (노출 차단)  | ✅          | ✅          |
| `is_deleted=t` (삭제)         | ❌              | ❌          | ❌(404)     |

- 공개/앱 read(`listPublicCollections`, `getPublicCollectionBySlug`)는
  `status='published' AND is_deleted=false` 만 노출 → archive·delete 모두 자동 숨김.
- 관리자 list(`listCollections`)는 `is_deleted=false` → **archive 는 보이고(관리 대상 유지),
  delete 는 숨김**. 삭제된 항목은 `restore` 로만 다시 보인다.
- 공개 상세는 없는 리소스와 비공개/삭제 리소스를 동일하게 404 처리(enumeration leak 방지).

## 연결 데이터 보존 (AC: 결제/이력/감사 보존)

- 물리 `DELETE` 를 절대 발생시키지 않으므로 수록 의사(`service_doctor_collection_items`),
  참조 의사(`service_doctors`), 그 외 하위/감사 참조가 모두 보존된다.
- 삭제/복구 응답에도 보존된 수록 의사 items 가 그대로 실린다(증빙).
- 상태 전이마다 `updated_by`(행위자) + `updated_at`(자동 `$onUpdate`) 가 갱신되고
  서버 로그에 감사 라인을 남긴다.

## 복구 (recoverability)

`restore` 는 삭제/archive 된 컬렉션을 **안전한 `draft`** 로 되살린다 — 자동 재게시는 하지 않으며,
관리자가 명시적으로 다시 게시(별도 update/publish API)해야 공개된다.

## 테스트

`doctor-curation/service/doctor-curation-lifecycle.spec.ts` — archive/delete/restore 각각의
상태 전이, 멱등성(이미 archived/deleted/active), 404, 수록 의사 보존, 감사 컬럼(`updatedBy`,
`deletedAt`)을 검증. 기존 4개 spec 포함 doctor-curation 30 tests green.
