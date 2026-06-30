// Feature Admin Routes
import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
// [ATLAS:IMPORTS]
import { createSignUpRoute } from "./features/auth";
import { createCommunityAdminRoutes, createCommunityRoutes } from "./features/community";
import { createDomainAdminRoutes } from "./features/domain";
import { createEmailAdminRoutes } from "./features/email";
import { createIdentityVerificationAdminRoutes } from "./features/identity-verification";
import { createPaymentAdminRoutes } from "./features/payment";
import { createProfileAuthRoutes } from "./features/profile";
import { createScheduledJobAdminRoutes } from "./features/scheduled-job";
import { createVideoLectureAdminRoutes } from "./features/video-lecture";
// [/ATLAS:IMPORTS]
import { AdminLayout } from "./layouts";
import { AdminAuditLogsPage, AdminDashboard, AdminSignInPage, AdminUsersPage } from "./pages";

// ============================================================================
// Root Route
// ============================================================================

interface RouterContext {
  queryClient: QueryClient;
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <>
      <Outlet />
      {import.meta.env.DEV && <TanStackRouterDevtools position="bottom-right" />}
    </>
  ),
});

// ============================================================================
// Admin Routes
// ============================================================================

// Admin Layout (AdminGuard 포함)
const adminLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "admin-layout",
  component: AdminLayout,
});

// "/dashboard" - Admin Dashboard
const dashboardRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "/dashboard",
  component: AdminDashboard,
});

// "/users" - 사용자 관리
const usersRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "/users",
  component: AdminUsersPage,
});

// "/audit-logs" - 감사 로그
const auditLogsRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "/audit-logs",
  component: AdminAuditLogsPage,
});

// ============================================================================
// Route Tree 구성
// ============================================================================

// "/sign-in" - Admin Sign In (AdminGuard 밖)
const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sign-in",
  component: AdminSignInPage,
});

const routeTree = rootRoute.addChildren([
  // Sign In (AdminGuard 밖)
  signInRoute,
  createSignUpRoute(rootRoute),
  ...createCommunityRoutes(rootRoute),

  // Admin Layout + Protected Routes (AdminGuard 적용)
  adminLayoutRoute.addChildren([
    dashboardRoute,
    usersRoute,
    auditLogsRoute,
    ...createProfileAuthRoutes(adminLayoutRoute),
    // [ATLAS:ADMIN_ROUTES]
    ...createCommunityAdminRoutes(adminLayoutRoute),
    ...createDomainAdminRoutes(adminLayoutRoute),
    ...createEmailAdminRoutes(adminLayoutRoute),
    ...createIdentityVerificationAdminRoutes(adminLayoutRoute),
    ...createPaymentAdminRoutes(adminLayoutRoute),
    ...createScheduledJobAdminRoutes(adminLayoutRoute),
    ...createVideoLectureAdminRoutes(adminLayoutRoute),
    // [/ATLAS:ADMIN_ROUTES]
  ]),
]);

// ============================================================================
// Router Export
// ============================================================================

export function createAppRouter(queryClient: QueryClient) {
  return createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: "intent",
  });
}

export type AppRouter = ReturnType<typeof createAppRouter>;

declare module "@tanstack/react-router" {
  interface Register {
    router: AppRouter;
  }
}
