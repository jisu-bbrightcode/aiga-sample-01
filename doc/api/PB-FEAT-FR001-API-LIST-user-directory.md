# PB-FEAT-FR001-API-LIST — 사용자 목록/검색 API (BBR-526)

- Capability: `domain.feature.fr-001.api.list`
- Decision: **NEW** (Backend Engineer)
- Depends on: PB-DATA-FR001-001 (user-grade schema), PB-DOMAIN-001 (REST/가드 패턴)
- Target: `packages/features/user-directory` (wired into `apps/server`)

## 결정값과 근거

FR-001 "사용자" 기능 카드는 **소셜 로그인 + 사용자 등급 판정 + 등급별 일일 한도**다.
신원(소셜 로그인/계정/세션)과 프로필(`profiles`)은 core에서 **REUSE**하며, 등급은
PB-DATA-FR001-001의 `user_grades`/`user_grade_definitions`에서 가져온다. 이 task는 그
사용자 레코드를 **목록/검색/필터/정렬/페이지네이션** + **공개/사용자/관리자 필드 분리**로
노출하는 읽기 API다. tRPC는 표준 워크플로우에서 제외되므로 REST 컨트롤러 + NestJS
Swagger(OpenAPI 계약 단일 소스) + zod DTO 패턴(`service-domain`과 동일)을 따른다.

생성/등급 배정(write) 경로는 별도 task(BBR-528, `@repo/features/user-grade`)가 담당하며,
auth 사용자 생성 자체는 better-auth 소셜 로그인 + profiles hook으로 **REUSE/SKIP**이다.

## 실행 산출물

새 feature 모듈 `@repo/features/user-directory`:

```
user-directory/
  mappers.ts           # public/self/admin 3-tier projection (pure, fail-closed)
  dto/                 # zod 요청 DTO(목록 쿼리) + Swagger 응답 DTO
  service/             # UserDirectoryService (profiles ⟕ user_grades ⟕ definitions)
  controller/          # 공개+본인 컨트롤러 / 관리자(가드) 컨트롤러
  user-directory.module.ts
  *.spec.ts            # 15 tests (mappers 필드분리 / service 목록·상세·권한)
```

### 라우트

공개(비로그인 탐색 가능 — 핸들을 등록한 활성 회원만 노출):

| Method | Path | 설명 |
|--------|------|------|
| GET | `/users?page&limit&q&grade&sort` | 사용자 목록/검색(공개 필드) |
| GET | `/users/:handle` | 사용자 상세(공개, 핸들 기준) |

본인(`BetterAuthGuard`):

| Method | Path | 설명 |
|--------|------|------|
| GET | `/users/me` | 내 정보(공개 필드 + email/인증수단/활성/동의시점) |

관리자(`BetterAuthGuard` + `BetterAuthAdminGuard` = owner/admin role):

| Method | Path | 설명 |
|--------|------|------|
| GET | `/admin/users?page&limit&q&grade&authProvider&isActive&includeDeleted&sort` | 사용자 목록/검색(전체 필드) |
| GET | `/admin/users/:id` | 사용자 상세(관리자, profile id 기준) |

### 공개/사용자/관리자 필드 분리 (AC #1)

| 필드 | 공개(public) | 본인(self) | 관리자(admin) |
|------|:---:|:---:|:---:|
| id, handle, name, bio, avatar | ✓ | ✓ | ✓ |
| grade(배지: id/slug/name), joinedAt | ✓ | ✓ | ✓ |
| email, authProvider, isActive, marketingConsentAt, updatedAt | ✗ | ✓ | ✓ |
| grade 출처/일일한도/만료(source/dailyUsageLimit/expiresAt) | ✗ | ✗ | ✓ |
| deletedAt(소프트삭제 부기) | ✗ | ✗ | ✓ |

매퍼는 row에서 키를 지우는 대신 **필드별로 새 객체를 구성**하므로, `profiles`에 컬럼이
추가돼도 공개/본인 응답에는 기본 제외(fail-closed)된다. 공개 목록은 추가로
`is_active = true AND deleted_at IS NULL AND handle IS NOT NULL`로 필터링하여 핸들을
등록하지 않은 회원은 열거 자체가 불가능하다(프라이버시).

### 검색/필터/정렬/페이지네이션 (AC #2, QA 독립 검증)

- `q`: 공개=이름/핸들 `ilike`, 관리자=이름/이메일/핸들 `ilike`.
- `grade`: 등급 slug(`verified` 등)로 필터(grade 정의 join).
- 관리자 전용: `authProvider`, `isActive`, `includeDeleted`(기본 false).
- `sort`: 공개=`recent|name`, 관리자=`recent|name|email` (recent=가입 최신순).
- `page`(>=1, 기본 1) / `limit`(1–100, 기본 20). 응답 = `{ items, total, page, limit }`.

zod DTO가 쿼리 문자열을 coerce/검증하므로 잘못된 입력은 400으로 거부된다.

## OpenAPI 동기화 (AC #3)

라우트/쿼리/응답 스키마는 모두 `@nestjs/swagger` 데코레이터 + `createZodDto`로
선언되어 런타임 구현과 동일한 소스에서 OpenAPI 문서가 생성된다(별도 수기 스펙 없음).

## REUSE/SKIP (AC #4)

- 신원/계정/세션/소셜 로그인 = core better-auth **REUSE** (이 task 범위 밖).
- 사용자 생성·등급 배정 write = BBR-528 `@repo/features/user-grade` **분리**.
