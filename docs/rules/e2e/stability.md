# E2E 안정성 / flake budget

> **Iron Rule**: state-based 대기만 쓴다. `waitForTimeout` / `setTimeout` 으로 timing 우회하지 않는다.

## 1. 좋은 대기 패턴

```ts
// URL 전환 대기
await page.waitForURL("**/home");
await page.waitForURL(/\/p\/[0-9a-f-]{36}\//i, { timeout: 15_000 });

// DOM 가시성 대기
await expect(page.locator('[data-el="my-feature.saved-badge"]')).toBeVisible({ timeout: 15_000 });

// 응답 대기
import { waitForApi } from "./_lib/network";
const saved = waitForApi(page, "/api/my-feature/save");
await page.locator('[data-el="my-feature.save-btn"]').click();
await saved;

// 네트워크 idle
await page.waitForLoadState("networkidle");

// 특정 응답 조건
await page.waitForResponse((res) => res.url().includes("/api/my-feature") && res.ok());
```

## 2. 차단되는 패턴

`.pi/extensions/rules/e2e-spec-conventions.ts` 의 `wait-for-timeout` / `setTimeout-hack` 룰:

| 패턴 | 차단 사유 |
|---|---|
| `await page.waitForTimeout(2_000)` | timing race 의존 → flake |
| `setTimeout(fn, 1000)` (spec 안에서 단독 호출) | 위와 동일 |
| `await new Promise((r) => setTimeout(r, 2_000))` | promise 로 위장한 sleep |

차단 메시지: *"page.waitForTimeout"* / *"setTimeout(...) 직접 호출 N회 — state-based 대기 사용"*.

### 예외 — `extraSettleMs` 옵션

특정 spec (예: `zion-quest-sidebar-measure.spec.ts`) 에서 sidebar mount 측정용으로 추가 settle 이 필요한 경우, **그 spec 안에서 직접 `waitForTimeout` 호출하지 말고** `signIn(page, { ..., extraSettleMs: 2500 })` 처럼 `_lib/auth.ts` 가 받은 옵션으로 대기시킨다. 이 경우도 룰을 자극할 수 있으니 spec 의 시나리오 정당성을 PR review 에서 확인한다.

## 3. mock 등록 시점

- `page.route(...)` 등록은 **`page.goto(...)` 이전**. 등록 누락 시 race.
- 시나리오 도중 응답을 변경해야 하면 `page.unroute(...)` 후 새 `page.route(...)`.

## 4. 고유 데이터로 spec 격리

```ts
const RUN_SUFFIX = Date.now().toString(36);

await page.locator("#workspace-name").fill(`Quest E2E ${RUN_SUFFIX}`);
await page.locator("#project-name").fill(`Quest E2E Project ${RUN_SUFFIX}`);
```

→ spec 간 / retry 간 데이터 충돌 회피. `@db` spec 에서 특히 중요.

## 5. serial 사용

`test.describe.serial(...)` 는 state 가 누적되는 시나리오에서만 (예: payment upgrade → downgrade). 기본은 isolation (`fullyParallel: false`, `workers: 1` 로도 보장됨).

```ts
test.describe.serial("payment plan change @critical @payment @db", () => {
  test("PC1: Pro → Pro Plus 업그레이드", async ({ page }) => { … });
  test("PC2: Pro Plus → Pro pending downgrade", async ({ page }) => { … });
});
```

## 6. flake budget

- spec 이 **3 회 retry 에도 통과 안 되면 무조건 fix**. retries 키우기로 회피 금지.
- 1 회 flake (CI 첫 시도 실패 + retry 통과) 허용. 30 일 내 같은 spec 이 3 회 flake → owner 진단.
- `test.skip(string-literal, ...)` / `test.fail(...)` 로 실패 영구 은닉 금지. 운영 룰이 `skip-or-fail` 로 차단.
- `test.describe.configure({ retries: > 1 })` 도 차단 (`retry-hack`). retries 는 playwright.config.ts 에서 `CI ? 1 : 0` 으로 통일.

### runtime conditional skip 은 허용

`test.skip(!SANDBOX_READY, "Polar sandbox 미설정")` 처럼 **env-gated** skip 은 첫 인자가 boolean 이라 차단되지 않는다 (룰은 첫 인자가 string literal 일 때만 잡음).

## 7. 진단 자료

CI 실패 시 활용:

- `test-results/<run>/trace.zip` — `pnpm --filter app exec playwright show-trace <path>` 로 재생
- `test-results/<run>/video.webm` — 시나리오 녹화
- `test-results/<run>/screenshot.png` — 마지막 fail 시점 스크린샷
- `playwright-report/index.html` — `pnpm --filter app exec playwright show-report`

→ `playwright.config.ts` 의 `trace: "retain-on-failure"`, `screenshot: "only-on-failure"`, `video: "retain-on-failure"` 가 기본.
