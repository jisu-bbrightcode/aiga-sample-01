# PB-FEAT-FR003-API-DELETE — 통합검색 삭제/archive API (BBR-535)

Capability: `domain.feature.fr-003.api.delete`
Depends on: FEAT-FR-003-API-READ (BBR-532)
Feature package: `@repo/features/service-search`

## Decision: NEW (소프트 삭제/archive on the search projection)

통합검색의 운영자-제어 노출 단위는 **검색 문서**(`service_search_documents`,
`(entityType, entityId)` 유일키)다. READ 엔드포인트가 이 키로 1건을 조회하므로,
DELETE/archive도 동일 키 위에 대칭으로 올린다.

원칙: **하드 삭제가 아니라 soft delete/archive**.

- `is_deleted`/`deleted_at` 컬럼을 `service_search_documents`에 추가(마이그레이션 0057).
- archive = `is_deleted=true, deleted_at=now()`. 행은 보존된다.
- `is_published`(원본 게시상태 미러, reindex가 덮어씀)와 **독립**한 admin 소유 플래그.
  reindex의 `set` 블록은 이 두 컬럼을 절대 쓰지 않으므로 archive가 재인덱싱을 견딘다.

## 노출 정책 (AC: 공개/앱/관리자 노출이 명확)

| Surface | 게시 필터 | archive 필터 |
|---------|-----------|--------------|
| 공개 `GET /service/search`, `GET /service/search/:type/:id` | `is_published=true` 강제 | `is_deleted=false` 강제 |
| 앱(공개와 동일 경로) | 동일 | 동일 |
| 관리자 `GET /service/search/admin` | `published` 옵션 | 기본 `is_deleted=false`, `includeDeleted=true`로만 포함 |
| 관리자 상세 `GET /service/search/admin/:type/:id` | 무관 | archive 포함(복구 확인용) |

archive된 문서는 공개/앱/관리자 목록에서 사라진다(노출 차단). 관리자만 `includeDeleted`
또는 상세 조회로 archive 상태를 확인하고 복구할 수 있다. 없는 문서와 archive된 문서는
공개 surface에서 동일하게 404(존재 누출 없음).

## 연결 데이터 보존 정책 (AC: 결제/이력/감사 보존)

검색 문서는 원본 카탈로그(의사/병원/진료과/지역)의 **재생성 가능한 projection**이며
`entityId`는 FK 없는 polymorphic 참조다. archive는 이 projection 행의 플래그만 바꾼다:

- 원본 카탈로그 행 — 미변경.
- 원본 `entityId`로 연결된 결제/이력/감사 레코드 — 미변경.
- 검색 로그(`service_search_queries`, append-only) — 미변경.

즉 archive로 인해 깨지는 보존 데이터가 없다. 복구 시 동일 행이 그대로 다시 노출된다.

## 엔드포인트

모두 `BetterAuthGuard` + `BetterAuthAdminGuard` 뒤(미인증 401, 비관리자 403).

### `DELETE /service/search/admin/:entityType/:entityId` — archive

- 200 `ArchiveResult { entityType, entityId, isDeleted, deletedAt, updatedAt }`
- 이미 archive면 멱등 성공(재기록 없음).
- 없는 문서 404. 잘못된 `entityType` 404(존재 누출 방지). `entityId` 비-UUID 400.
- 서버 감사 로그(non-user-facing): `[audit] search document archived id=… actor=…`.

### `POST /service/search/admin/:entityType/:entityId/restore` — 복구

- 200 `ArchiveResult`(`isDeleted=false, deletedAt=null`).
- 이미 복구(미archive) 상태면 멱등 성공.
- 없는 문서 404. 감사 로그 동일 패턴.

## OpenAPI 동기화 (AC)

`ArchiveResultDto`(`archiveResultSchema`)와 admin hit의 `isDeleted/deletedAt` 추가는
NestJS Swagger 데코레이터로 노출되어 계약과 구현이 일치한다. `AdminSearchQueryDto`에
`includeDeleted`(coerce boolean) 추가.

## 데이터 모델

마이그레이션 `0057_service_search_archive.sql` (idempotent, hand-authored):
`ADD COLUMN IF NOT EXISTS is_deleted/deleted_at` + 부분 인덱스
`idx_service_search_documents_active (is_published, entity_type) WHERE is_deleted=false`
(소프트 삭제 후 공개 hot path). PG16에서 0000–0057 from-scratch + 0057 재적용 멱등 검증.

## 테스트

- 서비스 단위(jest, DB-free): archive/restore happy path, 멱등(이미 archive/복구),
  404(없는 문서/미지 entityType), 공개/관리자 read의 archive 제외.
- 컨트롤러 wiring: DELETE/restore가 acting admin id로 위임.
- 전체 service-search 스위트 51 tests green.
