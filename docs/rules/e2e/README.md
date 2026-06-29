# E2E (Playwright) 작성 룰 인덱스

E2E spec 을 만들거나 수정할 때 이 디렉터리의 룰을 먼저 읽는다.
`.pi/extensions/rules/e2e-spec-conventions.ts` 가 write-time 으로 동시에 차단하므로 룰 위반은 코드 작성 자체가 막힌다.

## 진실 공급원

- `docs/runbooks/e2e-management.md` — 운영/CI 매트릭스/Owner 책임까지 포함하는 상세 runbook.
- 이 디렉터리는 **spec 을 한 파일 만들기 직전에 필요한 결정 + DRY 룰**만 추려서 빠르게 훑게 한다.

## 먼저 — layer 결정 (E2E 가 정답인가?)

E2E 는 가장 비싼 검증 layer 다. 아래 표로 **다른 layer 가 더 강력한 케이스** 먼저 걸러낸다.

| 검증 대상 | 1순위 layer | 이유 |
|---|---|---|
| Repository / drizzle query / raw SQL 회귀 | package/service test + real Postgres gate | FK/unique/check constraint는 서버 DB 경로에서 검증 |
| Service 함수 (transaction / FK cascade / advisory lock) | `packages/features/.../*.spec.ts` + 필요 시 `DATABASE_URL` | 실 SQL path 거침 |
| Sequence / trigger / Postgres-only 동작 | `all-tests-postgres.yml` (real PG service container) | Postgres 전용 동작을 production 전 차단 |
| Web UI flow + REST 응답 형상 | **E2E `page.route` mock** | backend 띄우지 않고 빠름 |
| Web UI + 진짜 backend 통합 (sign-in, org switch, payment) | **E2E `@db`** (Postgres service container / real Postgres `DATABASE_URL` + NestJS) | mock 으로 안 되는 경계 |
| Component 렌더/props/state | `vitest` (`*.test.tsx`) | 시나리오 아닌거 다 하위 layer |

### 핵심
spec layer 결정 시:

- **schema / SQL / repository 가 목적** 이면 → E2E 만들지 말고 package/service test와 real Postgres 게이트로 검증한다.
- **UI flow 가 목적** 이면 → E2E. mock-first 로 시작하고, 세션/org/transaction 가 엽히면 `@db`.

상세: `docs/runbooks/test-gates.md`, `docs/reference/product-builder-data-runtime-policy.md` (Product Builder 서버 권위 데이터 정책).

## 룰 파일 (이 순서대로 읽는다)

| # | 파일 | 주제 |
|---|---|---|
| 1 | `location.md` | 어디에 만들지 / 파일 이름 / `_lib`·`_harness` 위치 규약 |
| 2 | `helpers.md` | 공유 helper 인벤토리 (signIn / fulfillJson / createAuthFixture / harness) + 재선언 금지 룰 |
| 3 | `tags.md` | `@critical / @smoke / @regression / @db` + 도메인 tag 규칙 |
| 4 | `mock-first.md` | `page.route` mock 우선, `@db` 가 정말 필요한 경우만 |
| 5 | `selectors.md` | `data-el` i18n-agnostic 강제, CJK 셀렉터 금지 |
| 6 | `stability.md` | state-based 대기, `waitForTimeout` / `setTimeout` 금지, flake budget |

## 자동 차단 룰 (참고)

`.pi/extensions/rules/e2e-spec-conventions.ts` 가 write-time 으로 막는 항목:

| 위반 | 룰 kind |
|---|---|
| spec 위치 / 파일 이름 위반 | `misplaced-e2e` / `bad-filename` / `generic-filename` |
| level/domain tag 누락 또는 중복 | `missing-level-tag` / `multiple-level-tags` / `missing-domain-tag` |
| CJK 텍스트 셀렉터 | `cjk-selector` |
| `page.waitForTimeout(...)`, `setTimeout(...)`, `new Promise(r => setTimeout(r, ...))` | `wait-for-timeout` / `setTimeout-hack` |
| `@db` 없이 `page.goto('/...')` + `page.route(...)` 0 회 | `mock-required` |
| `test.describe.configure({ retries: > 1 })` | `retry-hack` |
| `test.skip(string-literal, ...)` / `test.fail(...)` | `skip-or-fail` |

룰 우회는 불가. 차단 메시지가 어디로 가서 import 해야 하는지 알려준다.
