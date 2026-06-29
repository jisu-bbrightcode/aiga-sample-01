# E2E 공유 helper (DRY)

> **Iron Rule**: spec 내부에서 동일 패턴을 재선언하지 않는다. 이미 helper 가 있으면 import 한다.

spec 3+ 개에서 같은 패턴이 반복되면 `_lib/` (또는 electron 의 `_harness/`) 로 올린다. helper 추가 PR 은 항상 기존 spec import 전환을 같은 PR 에 묶는다.

## 1. `apps/app/tests/e2e/_lib/` 인벤토리

새 spec 작성 전 **반드시 아래를 먼저 확인한다**.

### `env.ts`

```ts
export const APP_URL: string; // process.env.E2E_APP_URL ?? "http://localhost:3000"
export function appUrl(path: string): string;
```

모든 spec 의 `process.env.E2E_APP_URL` / `appUrl(...)` 단일 진실.

### `auth.ts`

```ts
export interface SignInOptions {
  email: string;
  password: string;
  /** sign-in submit 이후 추가 settle 대기 (ms). 기본 0. */
  extraSettleMs?: number;
}
export async function signIn(page: Page, options: SignInOptions): Promise<void>;
```

`data-el="login.email-input" / "login.password-input" / "login.submit-btn" / "login.form-card"` 기반. i18n-agnostic.

### `workspace.ts`

```ts
export interface CreateWorkspaceOptions {
  prefix: string;        // workspace/project 이름 prefix (예: "Quest", "Canvas")
  suffix: string;        // 충돌 회피용 (보통 Date.now().toString(36))
}
export async function createWorkspaceAndProject(
  page: Page,
  options: CreateWorkspaceOptions,
): Promise<void>;
```

신규 organization 첫 진입 시 강제로 등장하는 3-step 마법사 (`Name your workspace` → `Bring your team` skip → `Create your first project`) 통과.

### `network.ts`

```ts
export function fulfillJson(route: Route, body: unknown): Promise<void>;

export interface WaitForApiOptions {
  exactPath?: boolean;   // true면 API path 정확 매칭
  timeout?: number;      // 기본 20_000
}
export function waitForApi(
  page: Page,
  path: string,
  options?: WaitForApiOptions,
): Promise<Response>;
```

`page.route` 핸들러 안에서 200 + JSON 응답 단축, REST 응답 대기.

### `auth-mock.ts`

```ts
export interface AuthRequest {
  method: string;
  url: string;
  postData: unknown;
}
export function parsePostData(route: Route): unknown;
```

`auth-{signin,signup,forgot-password,reset-password}.spec.ts` 의 `/api/auth/**` mock 캡처용.

### `auth-fixture.ts`

```ts
export interface AuthFixtureInput {
  slug: string;              // id suffix — user-/session-/member- prefix 뒤에 붙음
  email: string;
  name: string;
  organizationName: string;
  organizationId: string;
  organizationSlug?: string; // organization.slug. 생략 시 slug 재사용
  sessionToken?: string;     // 기본 `session-token-${slug}`
  embedMemberInOrganization?: boolean; // member 가 organization.members 에 포함될지. 기본 false.
}
export function createAuthFixture(input: AuthFixtureInput): {
  user; session; organization; member;
};
```

better-auth `user / session / organization / member` 4 객체를 한 곳에서 일관성 보장. mock 4 개를 손으로 다시 짜지 않는다.

## 2. 좋은 spec 골조

```ts
import { expect, test, type Page } from "@playwright/test";

import { signIn } from "./_lib/auth";
import { waitForTrpc } from "./_lib/network";
import { createWorkspaceAndProject } from "./_lib/workspace";

const QA_EMAIL = process.env.E2E_EMAIL ?? "qa+my-feature@product-builder.local";
const QA_PASSWORD = process.env.E2E_PASSWORD ?? "QaTest1234!";
const RUN_SUFFIX = Date.now().toString(36);

test.describe("My feature @regression @my-feature @db", () => {
  test("happy path", async ({ page }) => {
    await signIn(page, { email: QA_EMAIL, password: QA_PASSWORD });

    if (page.url().includes("/workspace-select")) {
      await createWorkspaceAndProject(page, { prefix: "MyFeat", suffix: RUN_SUFFIX });
    }

    const saved = waitForTrpc(page, "myFeature.save");
    await page.locator('[data-el="my-feature.save-btn"]').click();
    await saved;

    await expect(page.locator('[data-el="my-feature.saved-badge"]')).toBeVisible();
  });
});
```

## 4. 차단되는 안티패턴

spec 내부에서 아래 패턴 발견되면 PR review 차단:

- `async function signIn(...)` 재선언 → `import { signIn } from "./_lib/auth"`
- `function appUrl(path) { return APP_URL + path; }` 재선언 → `import { appUrl } from "./_lib/env"`
- `function fulfillJson(route, body) { ... }` 재선언 → `import { fulfillJson } from "./_lib/network"`
- `async function createWorkspaceAndProject(page) { ... }` 재선언 → `import { createWorkspaceAndProject } from "./_lib/workspace"`
- better-auth `user`/`session`/`organization`/`member` 4 개 객체 수동 선언 → `createAuthFixture(...)`
- electron `function startAppDevServer()` 재선언 → `import { startAppDevServer } from "./_harness/dev-server"`

## 5. 새 helper 추가 기준

- spec 3+ 개에서 반복되는 패턴 → `_lib/` 로 올린다.
- 새 helper 의 export 시그니처는 **명시적 옵션 객체** (`signIn(page, { email, password })` 형태). 위치 인자 늘리지 않는다.
- helper PR = (1) helper 추가 + (2) 기존 spec import 전환을 같은 PR 에.
