# PB-FEAT-FR003-API-LIST — 통합 목록/검색 API (BBR-531)

- Capability: `domain.feature.fr-003.api.list`
- Decision: **NEW** (Backend Engineer)
- Depends on: PB-DATA-FR003 (BBR-521, 통합검색 data model), PB-DOMAIN-001 (BBR-525, 서비스 도메인 API)
- Target: `packages/features/service-search` (wired into `apps/server`)

## 결정값과 근거

도메인 기능 카드 **"통합"(통합 검색)**의 실행 산출물. PB-DATA-FR003가 만든
`service_search_documents` 통합검색 projection(의사/병원/진료과/지역을 하나의 검색 가능한
shape로 비정규화) 위에 REST 목록/검색 API를 얹는다. PB-DOMAIN-001의 `/service/doctors`·
`/service/hospitals`가 리소스별 목록이라면, 본 task는 **모든 리소스 타입을 한 쿼리로 랭킹하는
통합검색**이다 — 이것이 카드명 "통합"의 핵심이다.

tRPC는 표준 워크플로우에서 제외되므로 REST 컨트롤러 + NestJS Swagger(OpenAPI 계약의 단일
소스) + zod DTO 패턴(service-domain feature와 동일)을 따른다.

## 실행 산출물

새 feature 모듈 `@repo/features/service-search`:

```
service-search/
  normalize.ts          # query 정규화 + sort 결정 (pure) — 11 tests
  mappers.ts            # public/admin 필드 분리 projection (pure, fail-closed) — 5 tests
  dto/                  # zod 요청 DTO + Swagger 응답 DTO
  service/              # ServiceSearchService (Drizzle FTS + trigram) — 8 tests
  controller/           # 공개 컨트롤러 + 관리자(가드) 컨트롤러
  optional-user.decorator.ts  # 비가드 라우트용 best-effort 사용자 추출
  service-search.module.ts
```

### 라우트

공개(비로그인 탐색 가능, `is_published = true`만):

| Method | Path | 설명 |
|--------|------|------|
| GET | `/service/search?q&type&regionId&specialtyId&sort&page&limit` | 통합 검색/목록 (의사/병원/진료과/지역) |
| GET | `/service/search/popular?limit&days` | 인기 검색어 (집계 카운트만) |

사용자(로그인, `BetterAuthGuard`):

| Method | Path | 설명 |
|--------|------|------|
| GET | `/service/search/recent?limit` | 최근 검색어 (본인 기록만) |

관리자(`BetterAuthGuard` + `BetterAuthAdminGuard` = owner/admin role):

| Method | Path | 설명 |
|--------|------|------|
| GET | `/service/search/admin?q&type&regionId&specialtyId&published&sort&page&limit` | 통합 검색 (인덱스 내부필드 + 미게시 포함) |

### 검색/필터/정렬/페이지네이션

- **검색(q)**: 가중 tsvector(`search_vector`, GIN) 전문검색 `@@ websearch_to_tsquery('simple', q)`
  **OR** 제목 트라이그램 유사도(`title % q`, pg_trgm) — 한국어는 번들 FTS 사전이 없어
  `simple` 토큰화 + 트라이그램으로 오타/부분일치 recall을 보강한다.
- **필터**: `type`(doctor|hospital|specialty|region), `regionId`, `specialtyId`. 관리자는
  추가로 `published`(true/false; 생략 시 게시+미게시 모두).
- **정렬(sort)**: `relevance`(q가 있을 때 기본; ts_rank + similarity + weight/100),
  `rating`(평점), `featured`(편집 weight). q 없는 relevance 요청은 featured로 폴백.
- **페이지네이션**: `page`(≥1, 기본 1), `limit`(1–50, 기본 20). 응답 `{ items, total, page, limit }`.

## 핵심 설계 결정 (Acceptance Criteria 대응)

- **공개/사용자/관리자 필드 분리**: 공개 검색은 SQL select 자체를 public 컬럼 allow-list로
  제한하고(`PUBLIC_COLUMNS`), 매퍼도 새 객체를 field-by-field 구성한다(fail-closed). 인덱스
  내부필드(`body`, `keywords`, `weight`, `isPublished`, `sourceUpdatedAt`)와 raw `search_vector`는
  공개 응답에 절대 포함되지 않으며, 관리자 응답에만 노출된다(`mappers.spec.ts`가 강제).
- **공개/사용자/관리자 필터 분리**: 공개 검색은 `is_published = true`를 강제하고 `published`
  필터를 노출하지 않는다. 관리자만 `published`로 미게시 문서를 조회할 수 있다.
- **3-tier 권한 surface**: 공개=통합검색 + 인기 검색어(집계만, 개별 로그 비노출), 사용자=본인
  최근 검색어, 관리자=인덱스 내부 + 미게시. 각 tier가 별도 라우트라 QA에서 독립 검증 가능하다.
- **검색 로그**: 공개 검색은 `q`가 있을 때만(순수 browse 제외) `service_search_queries`에
  append-log한다(정규화 query + resultCount + 로그인 시 userId). best-effort — 로깅 실패가
  검색을 실패시키지 않는다. 이 로그가 인기/최근 검색어의 소스다.
- **OpenAPI 동기화**: 모든 라우트가 `@ApiOperation`/`@ApiResponse` + zod `createZodDto`
  응답 DTO로 기술되어 NestJS Swagger 런타임 계약(단일 소스)과 자동 동기화된다.

## 검증

- `jest service-search` → 16/16 통과 (normalize/mappers pure + service 흐름; 공개 select 컬럼
  제한 + 인덱스 내부필드 누출 차단 + 로그 best-effort 검증). `service-domain` 6 suites 동반 green.
- `tsc --noEmit` (paths가 worktree drizzle src로 해석되는 검증 tsconfig) → service-search 0 error.
- `biome check service-search` → clean.

## SKIP / 참조

- 리소스별 목록(`/service/doctors`, `/service/hospitals`)은 PB-DOMAIN-001(#22)에서 이미 제공 →
  본 task는 그 위의 **통합** 검색만 NEW로 추가(중복 아님).
- 검색 동의어(synonyms) 관리 CRUD는 별도 capability(FR-003 통합 생성 API, BBR-533)에서 다룬다.
  본 task는 synonyms를 reindex 시점의 `keywords` 확장으로만 간접 활용한다.

## 후속(merge/CI 단계)

OpenAPI generated client(`packages/api-client`)는 실제 서버 부팅 후 `pnpm api:codegen`으로
재생성한다 — 격리 worktree의 심링크 node_modules는 `@repo/*`를 베이스로 해석하므로 신규
라우트가 반영되지 않는다. **머지 후 `pnpm api:codegen` + `pnpm api:verify` 필요.**
