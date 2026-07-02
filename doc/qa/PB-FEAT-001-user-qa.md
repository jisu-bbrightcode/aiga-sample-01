# QA — 사용자 (FR-001 / BBR-491)

- **Feature card:** 사용자 (MVP, 영역: 어플리케이션) — 소셜 로그인 및 사용자 등급 판정 / 사용자 등급별 일일 사용 한도 적용
- **Build:** `bp-0b891299-66b7-438f-a3a4-7a63fbf8632b` (블루프린트 `온라인 서비스` / online-service-standard)
- **Verified against:** `origin/main` @ `cb5f95e` — 의존 task(DATA/API-LIST/READ/CREATE/UPDATE/DELETE) 전부 merge 완료. APP(BBR-581)은 PR #90 in_review 상태로 main 미반영(아래 surface 표 참조).
- **Verdict:** ⚠️ **PASS (with risks)** — 구현·머지된 surface(등급 부여/조회, 사용자 디렉터리 3-tier, 관리자 CRUD, 권한 게이트)의 acceptance path는 검증됨(46 테스트 green). **단, 기능 카드의 핵심 acceptance path 2건이 "인프라만 존재, 최종 연결 미완"** 상태로 잔여 리스크 §5에 차단/비차단 구분해 기록.

## 1. 검증 범위 (surface mapping)

| 영역 | 결정 | 근거 |
|------|------|------|
| 앱(application) | **검증** | 본 카드의 선택 surface. self `GET /users/me`(등급 배지), 공개 디렉터리 `GET /users`·`/users/{handle}`. 서버 계약으로 검증. APP UI(membership 섹션)는 BBR-581/PR #90 in_review라 main 미반영 → UI 자체는 별도 머지 후 검증 대상. |
| 공개(public) | **검증** | `GET /users`, `GET /users/{handle}`은 비인증 탐색 가능(online-service 규칙). 등급 배지(id/slug/name)만 공개, 이메일/인증수단/활성여부 비노출. |
| 관리자(admin) | **검증** | 등급 부여/조회/목록(`/admin/users/:id/grade`, `/admin/user-grades`) + 사용자 CRUD/소프트삭제/이력(`/admin/users*`). 전부 `BetterAuthGuard + BetterAuthAdminGuard` 이중 게이트. |
| AI | **N/A** | 본 기능 카드에 AI 흐름 없음. |
| 소셜 로그인 | **REUSE** | 신규 구현 아님 — core better-auth(`packages/core/auth/server.ts`)의 Google/LinkedIn(내장) + Kakao/Naver(generic-oauth) + email/magic-link. 등급 feature는 identity 위에 등급 데이터만 NEW로 얹음. |

## 2. Acceptance path

기능 카드의 두 축:

### (A) 소셜 로그인 및 사용자 등급 판정

설계 의도 흐름: **소셜 로그인 가입 → `user.create.after` 훅 → 기본 등급(`basic`) 자동 부여 → `/users/me`에 등급 배지 노출.**

- 로그인(REUSE): better-auth가 OAuth/이메일 가입을 처리하고 `user.create.after`에서 `profiles` 동기화 + 가입 분석 이벤트 기록. ✅ 동작.
- 등급 판정 인프라(NEW): `UserGradeService.ensureSignupGrade(userId)`가 기본 `basic` 등급을 멱등(`onConflictDoNothing`)으로 부여하도록 구현·단위검증됨. `service-registry.ts`는 비-DI 호출부(가입 훅)가 wired 인스턴스를 재사용하도록 노출.
- **⚠️ GAP:** `user.create.after` 훅이 `ensureSignupGrade`를 **호출하지 않는다**(§5-1). 따라서 현재 신규 가입자는 등급 row가 없는 상태로 남고, 등급 판정은 관리자 수동 부여(`POST /admin/users/:id/grade`) 또는 KCB 인증 bump 경로에서만 발생.

### (B) 사용자 등급별 일일 사용 한도 적용

설계 의도: 보호 액션마다 `user_daily_usage` 카운터를 사용자 등급의 `dailyUsageLimit`과 대조해 한도 초과 시 차단.

- 데이터 모델(NEW): `user_grade_definitions.daily_usage_limit`(NULL=무제한) + `user_daily_usage`(user/day/action 단위 집계, 멱등 unique idx) 마이그레이션 `0047_user_grade.sql`로 존재. 시드 등급: guest(5)/basic(20)/verified(100)/premium(무제한).
- **⚠️ GAP:** `user_daily_usage` / `dailyUsageLimit`을 **소비(증가/검사)하는 서비스가 전무**(§5-2). 한도는 설정·관리자 표시 전용이며 실제 enforcement는 미구현.

## 3. 테스트 결과

| 스위트 | 결과 |
|--------|------|
| `packages/features` jest — `user-grade` | **service 12** (assign 409/404/400, get, list paginated/unknown-slug, ensureSignupGrade 멱등·source=signup) |
| `packages/features` jest — `user-directory` | **mappers 11 + service 23** (3-tier 누출 차단, viewer-aware, soft-delete 404/403, 관리자 CRUD/archive/restore 멱등+audit, update before/after, history) |
| 합계 | **46 passed / 3 suites** |
| 신규 QA 가드 | `user-directory/ungraded-user.qa.spec.ts` **+3** (아래) |

### 신규 QA 커버리지 (close된 gap)

§5-1의 미연결 가입 훅 때문에 **현재 모든 신규 가입자는 "등급 미부여" 상태**다. 기존 `mappers.spec`은 `toPublicUser`의 grade=null만 단언하고, **self/admin tier가 동일 상태에서 안전하게 degrade하는지는 무검증**이었다. `ungraded-user.qa.spec.ts` 추가로 고정:

1. 등급 row 없는 사용자가 public/self/admin 3-tier 매퍼 전부에서 `grade: null`로 안전 degrade(throw 없음).
2. self tier는 grade=null이어도 email/authProvider 등 본인 필드는 정상 노출.
3. admin tier는 grade=null이어도 소프트삭제/이메일 등 운영 필드 정상.

→ 미연결 가입 훅이 **치명적 실패가 아니라 graceful degradation**임을 회귀 가드로 고정. 훅이 연결되면 이 케이스는 "가입 직후 일시적 상태"로만 남는다.

## 4. 권한 / 상태 검증

- **공개 탐색(비인증):** `GET /users`, `GET /users/{handle}`은 가드 없음 → 로그인 없이 브라우징(online-service 규칙 충족). 공개 매퍼는 필드를 row에서 삭제하는 게 아니라 **새 객체를 필드별로 구성**(fail-closed) → 미래 컬럼 자동 비노출. `mappers.spec`이 email/authProvider/isActive/marketingConsentAt/deletedAt 누출 부재를 단언.
- **3-tier 경계:**
  - public: handle/name/bio/avatar + 등급 배지(id/slug/name).
  - self(`/users/me`, BetterAuthGuard): + email/authProvider/isActive/marketingConsentAt. **`dailyUsageLimit`은 self에 비노출**(등급 배지만) — 의도된 계약.
  - admin: 전체 + 등급 provenance(source/dailyUsageLimit/determinedAt/expiresAt) + 소프트삭제 부기.
- **viewer-aware 상세:** `/users/{handle}`은 bearer를 best-effort 파싱해 `viewer{authenticated,isSelf}`만 부착, 필드 확장 없음. 소프트삭제 사용자는 인증 여부 무관 404. 비활성 사용자는 익명 404 / 인증된 타인 403 / 본인은 열람 가능 — `service.spec`이 전 분기 단언.
- **관리자 게이트:** 등급 부여/사용자 CRUD 전 엔드포인트가 `BetterAuthGuard → BetterAuthAdminGuard`. 비인증/비관리자는 서비스 도달 불가. 등급 부여는 1인 1등급(unique `user_id`) → 중복 부여 409, 미존재 사용자 FK 위반 404, 비활성 등급 400.
- **감사:** 관리자 수정/archive/restore는 `admin_audit_log`에 before/after 기록. no-op(이미 archived 등)은 write·audit 미발생(멱등).

## 5. 잔여 리스크

### 차단성 (기능 카드 acceptance path 미완)

1. **🔴 소셜 로그인 → 기본 등급 자동 부여 미연결.** `packages/core/auth/server.ts`의 `databaseHooks.user.create.after`는 `profiles` 동기화 + 분석 이벤트만 수행하고 `userGradeService.ensureSignupGrade(user.id)`를 호출하지 않는다(런타임 호출부 0건 — git grep 확인). 결과: 신규 가입자는 등급 row 없음 → "등급 판정" acceptance path가 자동으로 성립하지 않음(관리자 수동 부여로만 등급 발생). 인프라(서비스·service-registry·시드 `basic`)는 완비 → **연결 1줄**이 누락. graceful degradation은 신규 QA 가드로 확인(치명적 아님)이나, **기능 카드 본문("사용자 등급 판정")을 충족하려면 연결 필요.** 후속 이슈 권장.
2. **🔴 등급별 일일 사용 한도 미적용(enforcement 부재).** `user_daily_usage`/`dailyUsageLimit`을 소비하는 코드 전무(git grep 확인 — 스키마/시드/드리즐 config 외 참조 없음). 한도는 설정+표시 전용. **기능 카드 본문("등급별 일일 사용 한도 적용")이 end-to-end 미구현.** 보호 액션(예: AI 질의, 명의 검색)에서 카운터 증가·한도 검사 guard/interceptor가 필요. 후속 이슈 권장.

### 비차단

3. **APP UI 미머지.** membership 섹션(등급/한도 표시)은 BBR-581/PR #90 in_review. 본 QA는 서버 계약 + 매퍼로 검증했고, UI 자체의 로딩/빈/에러 상태는 PR #90 머지 후 별도 확인 필요. (PR #90의 self 계약 가정 — grade 배지 optional, dailyUsageLimit self 미노출 — 은 본 검증과 일치.)
4. **등급 만료 다운그레이드 미자동화.** `user_grades.expires_at`(시한부 등급)은 저장되나 만료 시 자동 다운그레이드 sweep은 미구현(스키마 주석도 "app layer 소관"으로 명시). 만료된 등급이 계속 유효로 노출될 수 있음.
5. **소셜 로그인 자체의 E2E 부재.** OAuth(Google/Kakao/Naver/LinkedIn) 콜백·계정 링크는 REUSE라 본 카드 범위 밖이며 provider env/실콜백이 필요한 통합 검증은 미수행. 본 QA는 등급 레이어 계약에 한정.

## 6. 검증 방법 재현

```bash
# 서버 계약 (jest) — 기존 + 신규 QA 가드
cd packages/features
NODE_OPTIONS=--experimental-vm-modules node node_modules/jest/bin/jest.js \
  --testPathPatterns "user-grade|user-directory"

# 미연결 경로 확인 (런타임 호출부 0건이어야 함)
git grep -nE "ensureSignupGrade|userGradeService\." -- 'apps/**/*.ts' 'packages/**/*.ts' \
  | grep -vE "service-registry|\.spec\.|user-grade\.(service|module)\.ts"
git grep -lE "userDailyUsage|user_daily_usage|usedCount" -- 'apps/**/*.ts' 'packages/**/*.ts'
```
