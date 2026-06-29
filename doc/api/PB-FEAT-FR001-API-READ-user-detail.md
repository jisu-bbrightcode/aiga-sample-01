# PB-FEAT-FR001-API-READ — 사용자 상세 조회 API (BBR-527)

- Capability: `domain.feature.fr-001.api.read`
- Decision: **NEW / EXTEND** (Backend Engineer)
- Depends on: PB-FEAT-FR001-API-LIST (BBR-526, `@repo/features/user-directory`, main)
- Target: `packages/features/user-directory` (wired into `apps/server`)

## 결정값과 근거

FR-001 "사용자" 상세 조회는 BBR-526(목록/검색)이 만든 `@repo/features/user-directory`를
**EXTEND**한다. BBR-526에서 이미 핸들/본인/관리자 단건 조회의 기본 골격(`GET /users/:handle`,
`GET /users/me`, `GET /admin/users/:id`)이 들어왔으므로, 이 task는 산출물 명세에서 빠져 있던
**viewer state**와 **공개/사용자/관리자 권한별 접근 결과 + 없는/권한 없는 리소스 오류 contract**를
완성한다. 신원(소셜 로그인)·프로필(`profiles`)·등급(`user_grades`)은 그대로 REUSE한다.

마이그레이션은 없다(테이블은 모두 main에 존재) → 번호 경합 없음.

## 실행 산출물

`@repo/features/user-directory`에 추가/변경:

```
controller/optional-user.decorator.ts   # NEW: 가드 없는 선택적 인증(JWT best-effort) viewer 추출
mappers.ts                               # + ViewerState / PublicUserDetail / toPublicUserDetail
dto/responses.dto.ts                     # + viewerStateSchema / PublicUserDetailDto
service/user-directory.service.ts        # getByHandle → viewer-aware + 404/403 가시성 contract
controller/user-directory.controller.ts  # GET /users/:handle → @OptionalUser, 403/404 ApiResponse
controller/user-directory-admin.controller.ts  # 401/403 ApiResponse (OpenAPI 동기화)
*.spec.ts                                # +8 tests (viewer state / 404 / 403 / self)
```

## Viewer state (AC#1 — 공개/사용자/관리자 접근 결과)

공개 상세 `GET /users/:handle`는 비로그인 탐색을 막지 않으면서도 로그인 사용자에게
**누가 보고 있는지**를 돌려준다. 가드 대신 Authorization 헤더의 Better Auth JWT를
best-effort로 파싱(`OptionalUser`)하고, 토큰이 없거나 무효면 익명 viewer(`null`)로 처리한다.

응답은 항상 공개 projection + `viewer` 블록이며, **필드 노출 범위는 viewer와 무관하게 공개 그대로**다
(민감 필드는 절대 이 라우트로 새지 않는다):

```jsonc
{
  "id": "u1", "handle": "hong", "name": "홍길동", "bio": null, "avatar": null,
  "grade": { "id": "g1", "slug": "verified", "name": "인증 회원" },
  "joinedAt": "2026-01-02T00:00:00.000Z",
  "viewer": { "authenticated": true, "isSelf": false }
}
```

- `authenticated` — 유효한 bearer 토큰이 있으면 true.
- `isSelf` — viewer가 이 프로필의 주인이면 true (프론트의 "내 프로필 수정" 노출 신호).

관리자 티어는 별도 라우트(`GET /admin/users/:id`, 가드)로 전체 레코드를 조회한다. JWT에 role
클레임이 없어 공개 라우트에서 `isAdmin`을 추론하지 않는다(공개 projection 유지).

3-tier 접근 결과 요약:

| 티어 | 라우트 | 인증 | 노출 |
|------|--------|------|------|
| 공개 | `GET /users/:handle` | 없음(선택적) | 공개 카드 + viewer state |
| 사용자(본인) | `GET /users/me` | BetterAuthGuard | 공개 + 본인 필드(email/인증수단/동의) |
| 관리자 | `GET /admin/users/:id` | BetterAuthGuard + AdminGuard | 전체 + 등급 출처/한도/소프트삭제 |

## 오류 contract (AC#2 — 없는 리소스 vs 권한 없는 리소스)

`GET /users/:handle` 가시성 판정:

| 상황 | 비로그인 | 인증된 타인 | 본인 |
|------|----------|-------------|------|
| 핸들에 해당 프로필 없음 | **404** | **404** | **404** |
| 탈퇴/삭제(`deletedAt`) | **404** | **404** | 200 |
| 비활성(`isActive=false`) | **404** | **403** | 200 |
| 활성 공개 회원 | 200 | 200 | 200 |

- **404 (없는 리소스)** — 존재하지 않거나, 탈퇴/삭제되었거나, 익명 호출자가 비활성 프로필을 조회한 경우.
  익명 열거를 막기 위해 "존재하지만 비공개"를 익명에게는 404로 가린다.
- **403 (권한 없는 리소스)** — 존재하지만 공개되지 않은(비활성) 프로필을 **인증된 타인**이 조회.
  책임 추적이 가능한 호출자에게만 "권한 없음"을 명확히 알린다.
- 관리자 라우트는 미인증 **401**, 비관리자 **403**(가드), 없는 id **404**.

본인은 비활성/탈퇴 상태여도 자기 프로필을 항상 조회할 수 있다.

## OpenAPI 동기화 (AC#3)

NestJS Swagger 데코레이터가 단일 소스다. `GET /users/:handle`에 `200`(`PublicUserDetailDto`)/`403`/`404`,
관리자 라우트에 `200`/`401`/`403`/`404`를 명시해 구현과 계약을 일치시켰다.

## 검증

- jest 23 tests (mappers viewer state 3 + service getByHandle viewer/404/403/self 7 포함) — green
- `tsc --noEmit`(user-directory scope) — 0 errors
- biome check — clean
- 마이그레이션 없음 → 스키마 변경/경합 없음
