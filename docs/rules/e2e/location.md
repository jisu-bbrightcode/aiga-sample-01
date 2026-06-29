# E2E spec 위치 / 파일 이름

## 1. 위치

```
apps/<app>/tests/e2e/<feature>-<scenario>.spec.ts
```

| 앱 | 디렉토리 | baseURL |
|---|---|---|
| `apps/app` | `apps/app/tests/e2e/` | http://localhost:3000 |
| `apps/admin` | `apps/admin/tests/e2e/` | http://localhost:3001 |

`@playwright/test` 를 e2e/ 디렉토리 밖에서 import 하면 `misplaced-e2e` 로 자동 차단된다.

## 2. 파일 이름

```
<feature>-<scenario>.spec.ts
```

- `<feature>` = 도메인 tag 와 일치: `auth`, `payment`, `document`, `quest`, `project`, ...
- `<scenario>` = 사용자 의도 1개. `sign-in`, `plan-change`, `crud-restore` 등.
- kebab-case, 2 단어 이상 hyphen 필수.
- **한 시나리오 = 한 파일**. 800 줄 넘으면 쪼갠다.

✅ 좋음:
- `auth-signin.spec.ts`
- `payment-plan-change.spec.ts`
- `quest-crud-restore.spec.ts`

❌ 차단됨 (`generic-filename` / `bad-filename`):
- `tests.spec.ts`, `e2e.spec.ts`, `feature.spec.ts`, `spec.spec.ts`, `index.spec.ts`, `sample.spec.ts`
- `auth.spec.ts` (단어 1 개)
- `AuthSignIn.spec.ts` (kebab-case 아님)

## 3. helper / fixture / mock 데이터 위치

| 종류 | 위치 |
|---|---|
| spec 간 공유 page helper | `apps/<app>/tests/e2e/_lib/<name>.ts` |
| 도메인별 페이지 객체 (POM) | `apps/<app>/tests/e2e/_pages/<page>.ts` |
| mock fixture (`page.route` payload) | `apps/<app>/tests/e2e/_mocks/<feature>.ts` |
| visual snapshot | `<spec>.spec.ts-snapshots/` (Playwright 자동) |

`_lib` / `_harness` / `_pages` / `_mocks` 같은 **언더스코어 prefix** 디렉터리는 Playwright spec 자동 검색에서 제외된다 (`.pi/extensions/rules/e2e-spec-conventions.ts` 의 `EXEMPT_PATH` 정규식이 이 경로를 통과시킴).

## 4. 새 앱을 만들 때

`docs/runbooks/e2e-management.md` §1.2 step 참조. 요약:

1. `apps/<new>/playwright.config.ts` 를 `apps/app` config 에서 복사 (grep/grepInvert env, locale ko-KR 등).
2. `.github/workflows/e2e.yml` 매트릭스에 entry 추가 (smoke+critical 1 줄, regression 1 줄).
3. preview/build script (`pnpm <pkg> build`, `pnpm <pkg> preview --port`) 표준 vite 면 자동.
