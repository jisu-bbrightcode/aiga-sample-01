---
description: Admin system sidebar integration, feature menu config, AdminGuard, admin route patterns
globs: "apps/admin/src/**/*.tsx, apps/admin/src/**/*.ts"
alwaysApply: false
---

# Admin System Rules

> Feature별 Admin UI 통합 및 관리 구조
> **Admin 앱은 `apps/admin`에 분리되어 있음** (port 3001)

---

## Admin 앱 구조

Admin UI는 `apps/admin`에 독립 앱으로 존재합니다. `apps/app`에는 Admin 라우트/레이아웃이 없습니다.

| 앱 | 용도 | 포트 |
|----|------|------|
| `apps/app` | 일반 유저용 (Public/Auth 라우트) | 3000 |
| `apps/admin` | 관리자 전용 (Admin 라우트) | 3001 |

---

## Admin 경로 규칙

| 유형              | 경로 패턴                  | 예시                             |
| ----------------- | -------------------------- | -------------------------------- |
| **Core Admin**    | `/admin/...`               | `/admin`, `/admin/settings`      |
| **Feature Admin** | `/admin/{feature}/...`     | `/admin/blog`, `/admin/blog/new` |
| **Admin API**     | `/api/admin/{feature}/...` | `/api/admin/blog/posts`          |

---

## Feature Admin 디렉토리 구조

**Client Feature** (`apps/admin/src/features/{feature}/`)
```
apps/admin/src/features/{feature}/
├── routes/
│   └── admin/                     # Admin 전용 라우트
├── pages/                         # Admin 페이지 컴포넌트
├── components/                    # (선택) 공유 컴포넌트
└── hooks/
```

**App 레벨**
```
apps/admin/src/
├── feature-config.ts              # Feature 메뉴 설정
├── layouts/
│   └── admin-layout.tsx           # Admin 레이아웃 (shadcn Sidebar)
└── router.tsx                     # 라우트 설정 (Admin + Public 라우트 모두 등록)
```

---

## 사이드바 메뉴 구조

```
┌─────────────────┐
│ Admin           │  ← Header
│    Dashboard    │
├─────────────────┤
│ Navigation      │  ← Core 메뉴
│ Dashboard       │
├─────────────────┤
│ Features        │  ← Feature 메뉴 (feature-config.ts)
│ Hello World     │
│ Blog            │
├─────────────────┤
│ Admin User      │  ← Footer (User 메뉴)
│    user@email   │
└─────────────────┘
```

---

## Feature 메뉴 설정 패턴

### 1. Feature에서 경로 상수 export

```typescript
// apps/admin/src/features/blog/routes.ts
export const BLOG_PATH = "/blog";
export const BLOG_ADMIN_PATH = "/admin/blog";
```

### 2. Feature index.ts에서 re-export

```typescript
// apps/admin/src/features/blog/index.ts
export { BLOG_PATH, BLOG_ADMIN_PATH } from "./routes";
```

### 3. feature-config.ts에 메뉴 추가

```typescript
// apps/admin/src/feature-config.ts
import { BLOG_ADMIN_PATH } from "./features/blog";
import { HELLO_WORLD_ADMIN_PATH } from "./features/hello-world";
import type { LucideIcon } from "lucide-react";
import { FileText, Sparkles } from "lucide-react";

export interface FeatureAdminMenu {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  order: number; // 낮을수록 위에 표시
}

export const featureAdminMenus: FeatureAdminMenu[] = [
  {
    id: "hello-world",
    label: "Hello World",
    path: HELLO_WORLD_ADMIN_PATH,
    icon: Sparkles,
    order: 100,
  },
  {
    id: "blog",
    label: "블로그",
    path: BLOG_ADMIN_PATH,
    icon: FileText,
    order: 10,
  },
];

export function getSortedFeatureMenus(): FeatureAdminMenu[] {
  return [...featureAdminMenus].sort((a, b) => a.order - b.order);
}
```

---

## AdminGuard 사용

Admin 페이지는 `AdminGuard` 컴포넌트로 보호합니다.

```typescript
// apps/admin/src/layouts/admin-layout.tsx
import { AdminGuard, authenticatedAtom, userRoleAtom } from "@repo/core/auth";

export function AdminLayout() {
  const authenticated = useAtomValue(authenticatedAtom);
  const userRole = useAtomValue(userRoleAtom);

  return (
    <AdminGuard
      authenticated={authenticated}
      userRole={userRole}
      onUnauthenticated={() => navigate({ to: "/admin/login" })}
      onUnauthorized={() => navigate({ to: "/" })}
    >
      <SidebarProvider>
        <AdminSidebar />
        <SidebarInset>
          <Outlet />
        </SidebarInset>
      </SidebarProvider>
    </AdminGuard>
  );
}
```

### 허용 역할

기본적으로 `owner`와 `admin` 역할만 Admin에 접근 가능:

```typescript
allowedRoles?: ("owner" | "admin")[]  // 기본값: ["owner", "admin"]
```

---

## Admin REST endpoint

```typescript
// packages/features/blog/controller/admin-blog.controller.ts
@Controller("admin/blog")
@UseGuards(BetterAuthGuard, NestAdminGuard)
export class AdminBlogController {
  constructor(private readonly blogService: BlogService) {}

  @Get("posts")
  @ApiResponse({ status: 200, type: BlogPostListResponseDto })
  adminList() {
    return this.blogService.adminList();
  }
}
```

---

## Feature Admin 추가 체크리스트

1. **admin에 Admin 컴포넌트 생성**
   - `apps/admin/src/features/{feature}/pages/{feature}-admin.tsx`

2. **경로 상수 추가**
   - `apps/admin/src/features/{feature}/routes.ts`에 `{FEATURE}_ADMIN_PATH` 추가
   - Feature `index.ts`에서 re-export

3. **Admin 라우트 함수 생성**
   - `create{Feature}AdminRoutes()` 함수 생성

4. **admin 라우트 연결**
   - `apps/admin/src/router.tsx`에서 Admin 라우트 추가

5. **feature-config.ts 업데이트**
   - `apps/admin/src/feature-config.ts`에서:
   - 경로 상수 import
   - 아이콘 import
   - `featureAdminMenus` 배열에 메뉴 항목 추가

> **주의**: `apps/app`에는 Admin 관련 코드를 추가하지 않습니다.
