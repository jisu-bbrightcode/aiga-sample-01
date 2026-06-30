# PB-FEAT-FR003-API-READ — 통합 상세 조회 API (BBR-532)

- Capability: `domain.feature.fr-003.api.read`
- Decision: **NEW (EXTEND of the FR-003 feature module)** — Backend Engineer
- Depends on: PB-FEAT-FR003-API-LIST (BBR-531, 통합 목록/검색 API), PB-DATA-FR003 (BBR-521, 통합검색 data model)
- Target: `packages/features/service-search` (wired into `apps/server`)
  - Issue가 명시한 `apps/api`는 비어있는 stale 스캐폴드라 실 서버 `apps/server`에 얹은
    FR-003 LIST feature(BBR-531)와 동일한 위치를 따른다.

## 결정값과 근거

도메인 기능 카드 **"통합"(통합 검색)**의 상세 조회 산출물. LIST(BBR-531)가
`service_search_documents` 통합검색 projection 위에 목록/검색 API를 얹었다면, 본 task는
같은 projection에서 **결과 1건을 (entityType, entityId)로 조회하는 상세 API**와 **viewer
state / 권한·404·403 오류 contract**를 추가한다.

LIST와 같은 feature 모듈(`@repo/features/service-search`)을 EXTEND한다 — 새 모듈/배선 없이
기존 공개/관리자 컨트롤러에 상세 핸들러를 더한다. tRPC는 표준 워크플로우에서 제외되므로
REST 컨트롤러 + NestJS Swagger(OpenAPI 단일 소스) + zod DTO 패턴을 그대로 따른다.

## 조회 키

`service_search_documents`의 유니크 키는 `(entityType, entityId)` (`uq_service_search_documents_entity`).
`slug`은 type 간 중복 가능성이 있어 유니크가 아니므로, 모든 list hit이 이미 들고 있는
`entityId`(UUID)를 상세 키로 쓴다.

## 라우트

공개(비로그인 탐색 가능, `is_published = true`만):

| Method | Path | 설명 |
|--------|------|------|
| GET | `/service/search/:entityType/:entityId` | 통합 상세 조회 — 게시된 리소스 + viewer state |

관리자(`BetterAuthGuard` + `BetterAuthAdminGuard` = owner/admin role):

| Method | Path | 설명 |
|--------|------|------|
| GET | `/service/search/admin/:entityType/:entityId` | 통합 상세 조회 — 인덱스 내부필드 + 미게시 포함 |

라우팅: 공개 상세는 2-세그먼트 파라메트릭 라우트라 단일 세그먼트 리터럴
(`/popular`·`/recent`·`/admin`)을 가리지 않는다. 컨트롤러 내 선언 순서상 마지막에 둔다.

## viewer state

상세 응답에는 요청자의 리소스 접근 상태를 담는 `viewer` 블록이 포함된다. 프런트가 별도
왕복 없이 gated action(저장/이용 시작은 로그인 필요)과 에디터 배너를 렌더링할 수 있게 한다.

```jsonc
"viewer": {
  "authenticated": boolean,        // 로그인 여부
  "isAdmin": boolean,              // 관리자(owner/admin) 여부
  "canViewUnpublished": boolean    // 미게시 문서 열람 가능 여부
}
```

- 공개 엔드포인트: `{ authenticated: <JWT 존재 여부>, isAdmin: false, canViewUnpublished: false }`
  — 관리자가 호출해도 공개 surface에서는 비특권 view로 보고한다(**fail-closed**). 특권 view는
  가드된 admin 엔드포인트에서만 노출된다.
- 관리자 엔드포인트: `{ authenticated: true, isAdmin: true, canViewUnpublished: true }`.

## 권한별 접근 결과 (AC: 공개/사용자/관리자)

| 호출자 | 공개 `/service/search/:type/:id` | 관리자 `/service/search/admin/:type/:id` |
|--------|----------------------------------|------------------------------------------|
| 비로그인 | 게시문서 200 (공개필드, viewer.authenticated=false) / 미게시·없음 404 | **401** (인증 필요) |
| 로그인 사용자 | 게시문서 200 (viewer.authenticated=true) / 미게시·없음 404 | **403** (관리자 권한 필요) |
| 관리자 | 게시문서 200 (공개 surface는 비특권 view) | 게시·미게시 무관 200 (내부필드 + viewer 특권) / 없음 404 |

## 오류 contract (AC: 없는 리소스 / 권한 없는 리소스)

`GlobalExceptionFilter`가 모든 오류를 `{ error: { code, message, statusCode, timestamp, path, requestId } }`로
직렬화한다. 본 API의 코드:

| 상황 | Status | `error.code` |
|------|--------|--------------|
| 없는 리소스 (또는 공개 surface의 미게시 리소스) | 404 | `NOT_FOUND` |
| 알 수 없는 entityType | 404 | `NOT_FOUND` |
| 잘못된 형식의 entityId(UUID 아님) | 400 | `BAD_REQUEST` |
| 관리자 엔드포인트 — 비인증 | 401 | `UNAUTHORIZED` |
| 관리자 엔드포인트 — 비관리자 | 403 | `FORBIDDEN` |

**설계 결정 — 비공개 리소스 노출 정책**: 공개 엔드포인트는 `is_published = true`를 강제한다.
없는 리소스와 미게시 리소스를 **둘 다 404로 동일하게** 응답해 미게시 리소스의 존재 여부가
새지 않게 한다(공개 카탈로그에서 403은 존재를 노출하므로 사용하지 않음). "권한 없는 리소스"의
403 contract는 가드된 admin 엔드포인트(비관리자=403)에서 명시적으로 제공한다 —
즉 공개 surface는 정보 노출 0, 권한 contract는 admin surface에서 일급으로 정의.

## OpenAPI 동기화 (AC)

- 응답: `PublicSearchDetailDto` / `AdminSearchDetailDto` = (public/admin hit) + `viewer`(`ViewerStateDto`).
  zod schema가 단일 소스이며 `@ApiResponse({ type })`로 Swagger에 연결된다.
- 경로 파라미터: `@ApiParam`으로 `entityType`(enum) + `entityId`(uuid) 문서화.
- 오류: 각 핸들러에 `@ApiResponse({ status })`로 404/401/403을 명시.

## 테스트

`@repo/features` jest (`pnpm --filter @repo/features test:jest`):

- `service/service-search.service.spec.ts` — 상세 6 케이스 추가:
  공개 상세(공개컬럼만/미게시·없음 404/unknown type 404), 관리자 상세(내부필드 포함/없음 404/unknown type 404)
- `controller/service-search-detail.controller.spec.ts` — viewer state 배선:
  공개=비특권(로그인 여부만), 관리자=특권. 서비스 위임 인자 검증.
- `mappers.spec.ts` — `publicViewerState`(fail-closed) / `ADMIN_VIEWER_STATE` 순수 검증.

service-search 4개 suite 27 tests green, `tsc --noEmit` 0 errors, biome clean.

## SKIP/REUSE 메모

- 별도 personalization(저장됨/관심 표시)은 FR-002 영역이라 viewer state에 포함하지 않는다
  (feature 결합 회피). viewer는 권한/인증 상태만 담는다.
- 마이그레이션 없음 — projection 테이블은 PB-DATA-FR003(0048, main)에 이미 존재. 채번 경합 없음.
