---
description: TanStack Router code-based routing patterns, route factory functions, lazy loading, auth/admin guards
globs: "apps/app/src/features/*/routes/**/*.tsx, apps/app/src/router.tsx"
alwaysApply: false
---

# Client Routing Rules

> TanStack Router를 사용한 Code-based Routing 규칙

---

## 핵심 원칙

| 원칙                     | 설명                                         |
| ------------------------ | -------------------------------------------- |
| **Feature가 Route 제공** | `createRoute`로 Route 객체 생성하여 export   |
| **App은 꽂기만**         | Feature routes를 spread하여 routeTree에 추가 |
| **간결한 연결**          | 한 줄로 Feature 전체 라우트 등록             |
| **Parent 주입**          | Feature는 parentRoute를 파라미터로 받음      |

```
Client Feature (apps/app/src/features/)    apps/app (호스트)
┌───────────────────────────────────┐     ┌─────────────────────────┐
│ auth/routes/                      │     │ router.tsx              │
│  createAuthRoutes()               │────>│  routeTree.addChildren([│
│  (라우트 생성 함수)               │     │    ...createAuthRoutes()│
└───────────────────────────────────┘     │  ])                     │
                                          └─────────────────────────┘
```

---

## Route 경로 규칙

| 유형       | 경로 패턴              | 예시                          |
| ---------- | ---------------------- | ----------------------------- |
| **Public** | `/{feature}/...`       | `/blog`, `/sign-in`           |
| **Auth**   | `/{feature}/...`       | `/blog/write` (로그인 필요)   |
| **Admin**  | `/admin/{feature}/...` | `/admin/blog`, `/admin/users` |

---

> 페이지 컴포넌트 패턴은 `page-layout.md`를 참조.

---

## Route 생성 함수 패턴

### 개별 Route 생성 함수

```typescript
// apps/app/src/features/auth/routes/sign-in.tsx
import { createRoute } from "@tanstack/react-router";
import type { AnyRoute } from "@tanstack/react-router";

function SignInPage() {
  return (
    <Feature>
      <FeatureHeader title="로그인" />
      <FeatureContents>
        <SignInForm />
      </FeatureContents>
    </Feature>
  );
}

export const createSignInRoute = <T extends AnyRoute>(parentRoute: T) =>
  createRoute({
    getParentRoute: () => parentRoute,
    path: "/sign-in",
    component: SignInPage,
  });
```

### Routes 묶음 함수

```typescript
// apps/app/src/features/auth/routes/index.ts
import type { AnyRoute } from "@tanstack/react-router";
import { createSignInRoute } from "./sign-in";
import { createSignUpRoute } from "./sign-up";
import { createAdminLoginRoute } from "./admin/login";

// 개별 export
export { createSignInRoute } from "./sign-in";
export { createSignUpRoute } from "./sign-up";
export { createAdminLoginRoute } from "./admin/login";

// 경로 상수
export const AUTH_SIGN_IN_PATH = "/sign-in";
export const AUTH_SIGN_UP_PATH = "/sign-up";
export const AUTH_ADMIN_LOGIN_PATH = "/admin/login";

/**
 * Auth Feature의 모든 Public Routes 생성
 */
export function createAuthRoutes<T extends AnyRoute>(parentRoute: T) {
  return [createSignInRoute(parentRoute), createSignUpRoute(parentRoute)];
}

/**
 * Auth Feature의 Admin Routes 생성
 */
export function createAuthAdminRoutes<T extends AnyRoute>(parentRoute: T) {
  return [createAdminLoginRoute(parentRoute)];
}
```

### Feature index.ts에서 export

```typescript
// apps/app/src/features/auth/index.ts
export {
  createAuthRoutes,
  createAuthAdminRoutes,
  createSignInRoute,
  AUTH_SIGN_IN_PATH,
  AUTH_SIGN_UP_PATH,
  AUTH_ADMIN_LOGIN_PATH,
} from "./routes";

export * from "./ui/public";
export * from "./ui/admin";
export * from "./hooks";
```

---

## App에서 Route 연결

> **Admin 라우트는 `apps/admin`에서 관리합니다.** `apps/app`에는 Public/Auth 라우트만 등록합니다.

### apps/app (일반 유저용)

```typescript
// apps/app/src/router.tsx
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
} from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { createAuthRoutes } from "@features/auth";
import { createBlogRoutes } from "@features/blog";

interface RouterContext {
  queryClient: QueryClient;
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: () => <Outlet />,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
});

// Route Tree - Public/Auth Feature Routes만 등록
const routeTree = rootRoute.addChildren([
  indexRoute,
  ...createAuthRoutes(rootRoute),
  ...createBlogRoutes(rootRoute),
]);

export function createAppRouter(queryClient: QueryClient) {
  return createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: "intent",
  });
}

export type AppRouter = ReturnType<typeof createAppRouter>;
```

### apps/admin (관리자 전용)

```typescript
// apps/admin/src/router.tsx
import { createAuthAdminRoutes, createAuthRoutes } from "./features/auth";
import { createBlogAdminRoutes, createBlogRoutes } from "./features/blog";

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: () => <Outlet />,
});

const adminLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "admin-layout",
  component: AdminLayout,
});

const adminIndexRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "/admin",
  component: AdminDashboard,
});

const routeTree = rootRoute.addChildren([
  // Admin Login (AdminGuard 밖)
  ...createAuthAdminRoutes(rootRoute),

  // Admin Layout with nested Feature Routes
  adminLayoutRoute.addChildren([
    adminIndexRoute,
    ...createBlogAdminRoutes(adminLayoutRoute),
  ]),

  // Public/Auth Routes (TanStack Router 타입 안전성을 위해 등록)
  ...createAuthRoutes(rootRoute),
  ...createBlogRoutes(rootRoute),
]);
```

> **참고**: admin에서 Public/Auth 라우트도 등록하는 이유는 TanStack Router의 strict typing 때문입니다. Feature 코드 내부에서 `<Link to="/blog">` 등 public 경로를 참조하면, 해당 경로가 route tree에 등록되어 있어야 타입 에러가 발생하지 않습니다.

---

## Route vs UI Component

| 방식             | 사용 시점          | 예시                |
| ---------------- | ------------------ | ------------------- |
| **Route 함수**   | 전체 페이지 라우트 | `createSignInRoute` |
| **UI Component** | 페이지 내 일부 UI  | `SignInForm`        |

```typescript
// Route 함수: App이 Feature 페이지를 그대로 사용
...createAuthRoutes(rootRoute)

// UI Component: App이 자체 페이지에서 Feature UI만 사용
import { SignInForm } from "@features/auth";

function CustomLoginPage() {
  return (
    <div className="custom-layout">
      <SignInForm />
    </div>
  );
}
```

---

## Admin Route Guard

```typescript
// apps/app/src/features/blog/routes/admin/list.tsx
import { profileAtom } from "@repo/core/auth";
import { createRoute, redirect } from "@tanstack/react-router";

export const createBlogAdminRoute = <T extends AnyRoute>(parentRoute: T) =>
  createRoute({
    getParentRoute: () => parentRoute,
    path: "/admin/blog",
    beforeLoad: async ({ context }) => {
      const profile = context.profile;
      if (!profile || profile.role !== "admin") {
        throw redirect({ to: "/sign-in" });
      }
    },
    component: BlogAdminList,
  });
```

---

## Lazy Loading

큰 컴포넌트의 경우 Lazy Loading 적용:

```typescript
import { createRoute, lazyRouteComponent } from "@tanstack/react-router";

export const createBlogEditorRoute = <T extends AnyRoute>(parentRoute: T) =>
  createRoute({
    getParentRoute: () => parentRoute,
    path: "/blog/write",
    component: lazyRouteComponent(() => import("../ui/auth/BlogEditor")),
  });
```

---

## 파일 구조

```
apps/app/src/features/auth/
├── index.ts                 # createAuthRoutes + UI export
├── routes/
│   ├── index.ts             # createAuthRoutes, createAuthAdminRoutes, 경로 상수
│   ├── sign-in.tsx          # createSignInRoute
│   ├── sign-up.tsx          # createSignUpRoute
│   └── admin/
│       └── login.tsx        # createAdminLoginRoute
├── ui/
│   ├── public/              # SignInForm, SignUpForm
│   ├── admin/               # AdminLoginForm
│   └── shared/              # 공유 컴포넌트
├── hooks/
└── store/
```

