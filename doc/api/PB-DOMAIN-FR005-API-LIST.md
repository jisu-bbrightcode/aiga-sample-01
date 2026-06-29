# FR-005 프로필 목록/검색 API (BBR-541)

Capability: `domain.feature.fr-005.api.list` · Feature 카드: **프로필** (의사 프로필 / 병원 상세)
Decision: `NEW` (실제로는 PB-DOMAIN-001 공개 목록 위에 **관리자 tier EXTEND**) · Area: 서버/API · Role: Backend Engineer
Depends on: FEAT-FR-005-DATA, PB-DOMAIN-001 · Code: `packages/features/service-domain/`

## 무엇이 이미 있었고(REUSE) 무엇을 추가했나(NEW)

`프로필` 카드의 목록/검색/필터/정렬/페이지네이션/공개·비공개 필드 분리 요구는 두 PR로 나뉘어 충족된다.

| Tier | 상태 | 엔드포인트 | 필드 | 필터 |
|------|------|-----------|------|------|
| 공개(비로그인) | **REUSE** — PB-DOMAIN-001(#22)에서 완료 | `GET /service/doctors`, `GET /service/hospitals` | 공개 projection (민감 컬럼 제외) | published·non-deleted 고정 + `q`/`specialtyId`/`regionId`/`featured`/`page`/`limit` |
| 사용자(로그인·비관리자) | **REUSE** — 공개 tier와 동일 | (동일) | 공개 projection | 공개와 동일 |
| 관리자(owner/admin) | **NEW** — 본 이슈(#BBR-541) | `GET /service/admin/doctors`, `GET /service/admin/hospitals` | 관리자 projection (license/business no, internalNotes, status, audit, soft-delete 포함) | 전체 상태 + `status`/`includeDeleted`/`sort` + 공개 필터 |

### 사용자 tier가 공개와 동일한 이유 (SKIP 근거)

프로필 **탐색**은 비로그인/로그인 사용자에게 동일한 공개 카탈로그를 보여준다. 로그인 사용자에게만 달라지는 부분(저장/관심/개인화 정렬)은 별도 feature **FR-002 개인화**(`packages/.../personalization`)의 책임이므로 여기서 사용자 전용 목록 변형은 만들지 않는다. AC#1의 "사용자 권한 분리"는 *공개와 동일 = 추가 노출 없음*으로 충족된다.

## 관리자 목록 계약 (NEW)

두 엔드포인트 모두 `@UseGuards(BetterAuthGuard, BetterAuthAdminGuard)`로 인증 + owner/admin 역할을 강제한다. 비관리자/비로그인은 이 컨트롤러에 도달하지 못한다.

### Query

| 파라미터 | 타입 | 기본 | 설명 |
|----------|------|------|------|
| `page` | int ≥ 1 | 1 | 페이지 |
| `limit` | int 1–100 | 20 | 페이지 크기 |
| `status` | `draft`\|`published`\|`archived` | (없음=전체) | 편집 상태 필터 |
| `includeDeleted` | boolean | false | soft-deleted 행 포함 여부 (기본 숨김) |
| `sort` | `recent`\|`updated`\|`rating`\|`name` | `updated` | 정렬 키 |
| `featured` | boolean | — | 추천만 |
| `q` | string 1–120 | — | 이름/slug 부분일치 (`ilike`) |
| `specialtyId` | uuid | — | (의사) 주 진료과 |
| `regionId` | uuid | — | 지역 |

`sort` 매핑: `recent`→`createdAt desc`, `updated`→`updatedAt desc`(기본), `rating`→`ratingAvg desc, createdAt desc`, `name`→`name asc`.

### Response (`{ items, total, page, limit }`)

`items[]`는 `AdminDoctorDto` / `AdminHospitalDto` — 공개 projection + `status`, `licenseNumber`/`businessRegistrationNo`, `internalNotes`, `sourceUrl`, `publishedAt`, `createdBy`/`updatedBy`, `deletedAt`, `isDeleted`.

## 공개/관리자 필드 분리 보증

- 분리는 **mapper**(`mappers.ts`)에서 강제 — 공개 mapper는 allow-list로 컬럼을 하나씩 복사해 새 컬럼이 추가돼도 공개에 새지 않는다(fail-closed). 관리자 mapper만 전체 행을 노출한다.
- 분리는 **filter** 수준에서도 강제 — 공개 목록은 `status=published`·`isDeleted=false`를 코드로 고정하고, 관리자만 `status`/`includeDeleted`로 전체를 조회한다.
- 테스트(`service-domain.service.spec.ts`): 공개 목록은 `licenseNumber`/`status`가 **없음**을 단언하고, 관리자 목록은 `draft`/`archived` + 민감 컬럼이 **있음**을 단언한다.

## OpenAPI 동기화

NestJS Swagger 데코레이터가 단일 진실원본이다. 신규 라우트에 `@ApiResponse({ type: AdminDoctorListDto | AdminHospitalListDto })`와 `createZodDto` 기반 query DTO를 붙여 스키마가 자동 반영된다. (`apps/server` Swagger 문서; `apps/api/openapi.yaml`은 본 빌드에서 사용하지 않는 stale 산출물.)

## QA 독립 검증 (AC#2)

- 페이지네이션: `page`/`limit`로 `total` 대비 슬라이스 확인.
- 필터: `status=draft`만, `includeDeleted=true`로 삭제행 노출, `q`로 이름/slug 검색, `featured=true`.
- 정렬: `sort` 4종 각각 첫 행 비교.
- 권한 분리: 비인증 → 401, 비관리자 → 403, 공개 목록 응답에 민감 필드 부재.

## 테스트

`packages/features` → `pnpm test:jest service-domain` (29 passed; admin 목록 4 케이스 추가).
