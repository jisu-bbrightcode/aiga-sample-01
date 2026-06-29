# PB-FEAT-004 — 명의 목록/검색 API (BBR-536)

- Capability: `domain.feature.fr-004.api.list`
- Decision: **NEW** (Backend Engineer)
- Depends on: FEAT-FR-004-DATA (PB-FEAT-004 doctor-curation schema, #13), PB-DOMAIN-001 (service REST API + auth guards, #22)
- Target: `packages/features/doctor-curation` (wired into `apps/server`)

## 결정값과 근거

도메인 기능 카드 **"명의"**(명의 찾기 검색·필터·정렬)의 **공개 목록/검색 API**다. PB-FEAT-004
데이터 모델의 **명의 컬렉션/기획전**(`service_doctor_collections` + items)을 비로그인 사용자가
탐색하는 read 엔드포인트를 NestJS Swagger(OpenAPI 단일 소스)에 맞춰 구현한다.

### 기존 모듈과의 통합 (BBR-538과 한 feature)

`@repo/features/doctor-curation` 모듈은 자매 이슈 **BBR-538**(`domain.feature.fr-004.api.create`)이
먼저 main에 머지하며 생성했다 — 그쪽은 **편집형 생성 + 관리자 read-back**(`POST` +
`service/curation/admin/collections` GET)을 담당한다. 본 BBR-536은 같은 모듈에 **공개 브라우즈
표면**(아래 라우트)을 **추가**한다. 두 이슈는 같은 데이터 모델 위의 상보적 표면이며, 중복 심볼
없이 한 모듈을 공유한다(공개 매퍼/Public DTO는 BBR-538이 만든 `toPublicCollection`/
`publicCollectionSchema`를 재사용).

### REUSE 경계 (원시 의사 검색)

원시 **의사 검색·필터·정렬**(진료과/지역/평점/featured)은 PB-DOMAIN-001 hub의
`GET /service/doctors`를 **REUSE**한다. 본 API는 그 위 편집형 컬렉션(기획전) 탐색만 추가한다.

## 라우트

공개(비로그인 탐색 가능, published만) — **본 이슈(BBR-536) 신규**:

| Method | Path | 설명 |
|--------|------|------|
| GET | `/doctor-collections?page&limit&kind&specialtyId&regionId&featured&q` | 명의 컬렉션 목록 |
| GET | `/doctor-collections/:slug` | 명의 컬렉션 상세 (수록 의사 rank 순, published doctor만) |

관리자(`BetterAuthGuard` + `BetterAuthAdminGuard`) — BBR-538이 제공:

| Method | Path | 설명 |
|--------|------|------|
| POST | `/service/curation/admin/collections` | 컬렉션 생성 |
| GET | `/service/curation/admin/collections?page&limit&kind&status` | 컬렉션 목록 (전체 필드/상태) |
| GET | `/service/curation/admin/collections/:id` | 컬렉션 상세 |

### 필터 / 정렬 / 페이지네이션 (공개)

- `kind` — facet: `editorial` / `specialty`(분야별) / `region`(지역별)
- `specialtyId` / `regionId` — 분야별·지역별 컬렉션 스코프
- `featured` — 명의 찾기 홈 레일(추천 컬렉션)만
- `q` — 컬렉션 제목(name) 부분일치 (`ilike`)
- `page` / `limit` (기본 1 / 20, limit ≤ 100) — offset 페이지네이션, 응답 `total/page/limit`
- 정렬: `sortOrder ASC, createdAt DESC` (편집 레일 순서)

## 핵심 설계 결정 (Acceptance Criteria)

- **공개/사용자/관리자 필드·필터 분리**
  - 공개·로그인 사용자: `toPublicCollection` allow-list projection만 노출 — 민감 컬럼
    (`status`, `internalNotes`, `sourceUrl`, `publishedAt`, editor id, soft-delete)은 공개
    응답에서 제외(fail-closed). 공개 query DTO(`PublicListCollectionsQueryDto`)에는
    `status`/`includeDeleted` 같은 비공개 필터 자체가 없어, 공개 표면으로 비공개 데이터를
    요청할 수 없다. 공개/사용자 tier는 동일 published-only projection(개인화는 FR-002).
  - 관리자: BBR-538의 가드 컨트롤러가 전체 필드 + `status`/`kind` 필터 노출.
- **published-only 노출**: 공개 조회는 `status='published' AND isDeleted=false`. 상세의 수록
  의사도 published·non-deleted doctor만 노출(draft 누출 차단)하고 `rank ASC` 정렬.
- **검색/필터/페이지네이션 독립 검증**: 각 분기를 `DoctorCurationService` 단위 테스트로 DB 없이 검증.

## 검증

- `jest doctor-curation` → 14/14 (BBR-538 10 + 공개 표면 4), 회귀 없음
- `tsc --noEmit` doctor-curation → 0 error · `biome check` → clean
- migration 없음 (테이블은 main에 존재); 모듈은 이미 `apps/server` app.module + `@repo/features`
  exports에 등록되어 있어 본 이슈는 feature 디렉터리 내 추가만 한다(공유 파일 무수정).

## 후속(merge/CI 단계)

OpenAPI generated client(`packages/api-client`)는 서버를 부팅해 OpenAPI를 덤프하는
`pnpm openapi:dump`로 재생성한다 — merge 후 main 또는 CI에서 실행.
