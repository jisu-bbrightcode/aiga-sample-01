# E2E mock-first 원칙

> **이 룰은 web E2E (`apps/app/tests/e2e/`) 한정**이다.
> real backend / DB 안 쓰면 `page.route` 로 mock. Postgres service container / real DB 비용과 시간을 아낀다.
>
> ⚠️ **mock 은 최상위 검증 이 아니다.** schema / SQL / repository 회귀처럼 mock 이 잡아주지 못하는 곳은 package/service test와 real Postgres 게이트에서 검증한다. mock-first 는 "UI flow 시나리오용 편의 fixture"로서만 의미가 있다.

## 1. mock 가능 vs `@db` 필수

| 케이스 | mock 가능? | 이유 |
|---|---|---|
| auth flow (sign-in, signup form 검증) | ✅ `/api/auth/**` mock | 메일 발송/세션 store 불필요 |
| REST API 응답의 UI 렌더 | ✅ `/api/<feature>` mock | 응답 schema 만 같으면 됨 |
| payment Polar checkout redirect | ✅ Polar URL 만 검증 | 외부 sandbox 호출 없이 redirect 만 확인 |
| 셀렉터 보존 / 디자인 시스템 회귀 | ✅ mock 없이도 가능 (`@design`) | 정적 페이지 측정 |
| **진짜 DB transaction** (FK cascade, advisory lock) UI 렌더 | ❌ `@db` 필수 | mock 으로 재현 불가 |
| **multi-tenant org switching** (better-auth session 갱신) | ❌ `@db` 필수 | better-auth state machine 전체 필요 |
| 진짜 NestJS controller (file upload 등) | ❌ `@db` 필수 | controller 통합 검증 |

## 2. 자동 차단

`.pi/extensions/rules/e2e-spec-conventions.ts` 의 `mock-required` 룰:

- spec title 에 `@db` 가 **없는데** `page.goto('/...')` 호출이 있고 `page.route(...)` 가 **0 회** → 차단.
- 면제 조건:
  - title 에 `@db` 또는 `@design` 포함

차단 메시지: *"page.goto('/...') 호출이 있는데 page.route(...) mock 0개 — backend 의존 의심. mock 추가하거나 title 에 @db 추가하세요."*

## 3. mock 작성 패턴

### 3.1 단순 200 + JSON 응답

```ts
import { fulfillJson } from "./_lib/network";

await page.route("**/api/my-feature", (route) =>
  fulfillJson(route, [{ id: "1", name: "foo" }]),
);
```

### 3.2 better-auth 4-객체 mock (`/api/auth/**`)

```ts
import { createAuthFixture } from "./_lib/auth-fixture";
import { fulfillJson } from "./_lib/network";

const { user, session, organization, member } = createAuthFixture({
  slug: "my-spec",
  email: "qa@product-builder.local",
  name: "QA",
  organizationName: "QA Workspace",
  organizationId: "org-my-spec",
});

await page.route("**/api/auth/**", async (route) => {
  const path = new URL(route.request().url()).pathname.replace(/^\/api\/auth/, "");
  if (path === "/get-session") return fulfillJson(route, session);
  if (path === "/organization/list") return fulfillJson(route, [organization]);
  if (path === "/organization/get-full-organization") return fulfillJson(route, organization);
  if (path === "/organization/get-active-member") return fulfillJson(route, member);
  if (path === "/organization/get-active-member-role") return fulfillJson(route, { role: "owner" });
  if (path === "/organization/set-active") return fulfillJson(route, organization);
  return fulfillJson(route, null);
});
```

### 3.3 mock 응답 캡처

```ts
import { type AuthRequest, parsePostData } from "./_lib/auth-mock";

const requests: AuthRequest[] = [];

await page.route("**/auth/**", async (route) => {
  const request = route.request();
  requests.push({
    method: request.method(),
    url: request.url(),
    postData: parsePostData(route),
  });
  // ... fulfillJson(route, ...)
});

// 검증
expect(requests.some((r) => r.url.includes("sign-in/email"))).toBe(true);
```

## 4. mock 등록 시점

- **`page.goto(...)` 이전에 등록**한다. 등록 누락 시 race.
- 시나리오 중간에 응답을 바꿔야 하면 `page.unroute(...)` + 새 `page.route(...)`.

## 5. mock 이 너무 커지면

- `_mocks/<feature>.ts` 로 분리 (예: `_mocks/payment.ts` 가 `installPaymentMocks(page, scenario)` 를 export).
- spec 3+ 개에서 같은 mock 골조 반복되면 `_lib/` 또는 `_mocks/` 로 올린다.

## 6. layer 선택 — mock 보다 서버 DB 검증이 강력한 경우

mock 을 수십 줄 짜려는 자신을 발견하면 **layer 를 잘못 고른 것**이다. 아래는 mock 보다 package/service test 또는 real Postgres 게이트가 훨씬 강력함:

| mock 의 한계 | 서버 DB 검증이 잡는 것 | 올바른 위치 |
|---|---|---|
| 응답 fixture 를 손으로 작성 → drizzle schema 와 drift | drizzle schema와 실제 DB 제약 확인 | package/service spec + real Postgres gate |
| FK / unique / check constraint 검증 안 됨 | 실 Postgres constraint 강제 | 같은 곳 |
| transaction / advisory lock / `FOR UPDATE` 거쳐야 하는 service | mock 으로 재현 불가 | `packages/features/.../*.spec.ts` + 필요 시 real Postgres `DATABASE_URL` |
| 여러 procedure 의 상태 누적 (create → list → update) | 자연스럽게 누적 | 같은 곳 |
| Postgres-only 동작 (sequence, trigger, replication) | real Postgres에서만 정확히 확인 | `all-tests-postgres.yml` (main 게이트의 real PG service container) |

즉 **"mock 만들기 어렵다"** 는 신호가 뜨면 먼저:

1. 이게 정말 **UI flow 검증** 이인지 다시 판단.
2. 아니면 (schema/SQL/repository 검증) → E2E 그만두고 package/service spec 또는 real Postgres 게이트로 이동.
3. UI 검증은 맞는데 세션/org/transaction 까지 엽힌면 → `@db` (Postgres service container / real Postgres `DATABASE_URL`) 추가. mock 을 무리하게 늘리지 않는다.
