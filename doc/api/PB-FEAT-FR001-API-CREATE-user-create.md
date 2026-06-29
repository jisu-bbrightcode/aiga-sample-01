# PB-FEAT-FR001-API-CREATE — 사용자 생성 API (BBR-528)

- Capability: `domain.feature.fr-001.api.create`
- Decision: **NEW** (Backend Engineer)
- Depends on: FEAT-FR-001-DATA (PB-DATA-FR001-001, user-grade schema), PB-DOMAIN-001 (REST/Swagger 패턴)
- Target: `packages/features/user-grade` (wired into `apps/server`)

## 결정값과 근거 — REUSE / NEW 분리

기능 카드 "사용자"의 설명은 **소셜 로그인 및 사용자 등급 판정 / 등급별 일일 사용 한도**다.
이 두 축을 "사용자 생성" 관점에서 명시적으로 분리한다 (issue 규칙: "재사용 판정과 신규
구현은 issue에서 명시적으로 분리한다").

### REUSE (SKIP) — 정체성(아이덴티티) 생성 = 소셜 로그인

사용자(아이덴티티) 자체의 생성은 **core better-auth** 가 이미 담당한다:

- 소셜 로그인 `genericOAuth` (kakao/naver) — `packages/core/auth/server.ts`
- 신규 가입 시 `user.create.after` 훅이 `profiles` 행을 동기화하고 `SIGNUP_COMPLETED`
  이벤트를 남긴다 (감사). `account.create.after` 가 `profiles.authProvider` 를 기록한다.

따라서 "auth 사용자"를 만드는 **새 POST 엔드포인트는 만들지 않는다.** 별도 REST로
재구현하면 better-auth 의 OAuth/세션/JWKS 흐름과 중복·충돌한다.

- SKIP 사유: 핵심 정체성 생성은 better-auth 재사용 (NEW 아님).
- 참조: `packages/core/auth/server.ts`, FR-001 DATA 문서
  `doc/data/PB-DATA-FR001-001-user-data-model.md` (reuse map: login/profile/RBAC/
  본인확인은 REUSE, 등급 판정만 NEW).

### NEW (구현) — FR-001 feature 리소스 = 사용자 등급 배정

FR-001 이 **새로** 소유하는 리소스는 사용자 **등급(grade) 배정** (`user_grades`,
사용자당 1행) 과 그 근거다. "사용자 생성 API" 는 이 등급 배정 리소스의 생성/조회로
구현한다. 등급 정의(`user_grade_definitions`)·일일 한도(`user_daily_usage`)는 FR-001
DATA 에서 이미 시드/정의됨 (guest/basic/verified/premium).

## 엔드포인트 (admin-gated)

모두 `BetterAuthGuard` + `BetterAuthAdminGuard` (owner/admin 역할) 로 보호. 비인증=401,
비관리자=403 → 권한 없는 생성은 영속화되지 않는다 (AC#1).

| Method | Path | 설명 |
|--------|------|------|
| POST | `/admin/users/:userId/grade` | 사용자 등급 부여(생성). validation + 감사(provenance) + 초기 상태. |
| GET  | `/admin/users/:userId/grade` | 사용자 등급 상세. |
| GET  | `/admin/user-grades`         | 등급 배정 목록 (페이지네이션, gradeSlug 필터). |

생성 결과는 즉시 상세/목록 조회에 반영된다 (AC#2).

### 입력 validation (zod-first, `createZodDto`)

- `gradeSlug` **또는** `gradeId` 중 하나 필수 (`refine`). 미충족 시 422/400.
- `source` (signup|identity_verified|manual|system) 선택 — admin 배정 기본값 `manual`.
- `note` ≤ 1000자 (감사 메모), `expiresAt` (임시 등급 만료, 선택).

### 초기 상태 / 감사

- 등급 배정 시 `determinedAt = now`, `determinedBy = admin profile id`,
  `source` (기본 `manual`) 로 **provenance(감사 근거)** 를 남긴다.
- 사용자 **생성 시 초기 등급**: `UserGradeService.ensureSignupGrade(userId)` —
  기본 `basic` 등급을 멱등(`onConflictDoNothing`)으로 부여한다. 가입(better-auth
  `user.create.after`) 와이어링은 app 레이어 몫이며, 본 서비스는 재사용 가능한
  멱등 메서드를 `service-registry` 로 노출한다.
- 사용자당 1등급 불변식(`uq_user_grades_user`) — 중복 배정은 409.

## 산출물

```
user-grade/
  dto/            # zod 요청 DTO + Swagger 응답 DTO (AssignUserGrade / AdminUserGrade[List])
  mappers.ts      # user_grades(+grade def) → admin view (pure projection)
  service/        # UserGradeService (assign/get/list/ensureSignupGrade) + .spec (11 tests)
  controller/     # UserGradeAdminController (admin-gated POST/GET)
  user-grade.module.ts / service-registry.ts / index.ts
```

## OpenAPI 동기화

NestJS Swagger(`/api-docs/json`)가 단일 소스. 컨트롤러의 `@ApiTags/@ApiOperation/
@ApiResponse` 데코레이터가 계약을 생성한다. 사람이 읽는 미러:
`doc/contract/PB-FEAT-FR001-API-CREATE-user-grade.openapi.yaml` (AC#3).

## 검증

- `UserGradeService` 단위 테스트 11개 통과 (assign 기본/명시 source/NotFound/비활성/
  409/404, get NotFound/상세, list 페이지네이션/미지의 slug, ensureSignupGrade 멱등).
- `tsc --noEmit` clean (user-grade scope), biome clean.
- 마이그레이션 없음 (FR-001 DATA 가 이미 머지 — 0047_user_grade). → 0047 충돌 없음.
