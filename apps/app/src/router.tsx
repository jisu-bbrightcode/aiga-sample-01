// Feature Routes
import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  useSearch,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
// [ATLAS:IMPORTS]
import { createCommunityRoutes } from "@/features/community";
import { createEmailRoutes } from "@/features/email";
import { createIdentityVerificationRoutes } from "@/features/identity-verification";
import { createNotificationRoutes } from "@/features/notification";
import { createOnboardingRoutes } from "@/features/onboarding";
import { createPaymentAuthRoutes, createPaymentPublicRoutes } from "@/features/payment";
import { createStoryRoutes } from "@/features/story/routes/index";
// [/ATLAS:IMPORTS]
import { AppLayout } from "./layouts";
import { DashboardLayout } from "./layouts/dashboard-layout";
// App Pages & Layouts
import { UserHome } from "./pages";
import { AcceptInvitationPage } from "./pages/accept-invitation";
import { CreateWorkspacePage } from "./pages/create-workspace";
import { DesignSystemPage } from "./pages/designsystem";
import { ForgotPasswordPage } from "./pages/forgot-password";
import { ComponentGallery } from "./pages/gallery/component-gallery";
import { MagicLinkPage } from "./pages/magic-link";
import { ResetPasswordPage } from "./pages/reset-password";
import { ApiKeysPage } from "./pages/settings/api-keys/api-keys-page";
import { BillingPage } from "./pages/settings/billing/billing-page";
import { CouponsPage } from "./pages/settings/coupons/coupons-page";
import { NotificationsPage } from "./pages/settings/notifications/notifications-page";
import { MembersPage } from "./pages/settings/organization/members/members-page";
import { OrganizationPage } from "./pages/settings/organization/organization-page";
import { ProfilePage } from "./pages/settings/profile/profile-page";
import { ProjectDetailPage } from "./pages/settings/projects/project-detail-page";
import { SecurityPage } from "./pages/settings/security/security-page";
import { SettingsLayout } from "./pages/settings/settings-layout";
import { SsoPage } from "./pages/settings/sso/sso-page";
import { SignInPage } from "./pages/sign-in";
import { SignUpPage } from "./pages/sign-up";
import { WorkspaceSelectPage } from "./pages/workspace-select";

// ============================================================================
// Root Route
// ============================================================================

interface RouterContext {
  queryClient: QueryClient;
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: () => {
    return (
      <div className="flex h-screen flex-col">
        <div className="flex min-h-0 flex-1 flex-col">
          <Outlet />
        </div>
        {import.meta.env.DEV && <TanStackRouterDevtools position="bottom-right" />}
      </div>
    );
  },
});

// ============================================================================
// App Routes
// ============================================================================

// App Layout (AuthGuard 포함 - 인증된 유저용 Shell)
const appLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "app-layout",
  component: AppLayout,
});

// Dashboard Layout (사이드바 없는 대시보드 전용)
const dashboardLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "dashboard-layout",
  component: DashboardLayout,
});

// "/" - 인증된 유저 대시보드
const indexRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: "/",
  component: UserHome,
});

// "/sign-in" - 로그인
const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sign-in",
  component: SignInPage,
});

// "/sign-up" - 회원가입
const signUpRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sign-up",
  component: SignUpPage,
});

// "/forgot-password" - 비밀번호 찾기
const forgotPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/forgot-password",
  component: ForgotPasswordPage,
});

// "/reset-password" - 비밀번호 재설정
const resetPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/reset-password",
  component: ResetPasswordPage,
});

// "/magic-link" - Magic Link 전송 완료
const magicLinkRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/magic-link",
  component: MagicLinkPage,
});

// "/accept-invitation" - 워크스페이스 초대 수락
const acceptInvitationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/accept-invitation",
  component: AcceptInvitationPage,
});

// "/workspace-select" - 워크스페이스 선택
const workspaceSelectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/workspace-select",
  component: WorkspaceSelectPage,
});

// "/create-workspace" - 새 워크스페이스 생성
const createWorkspaceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/create-workspace",
  component: CreateWorkspacePage,
});

// "/gallery" - Component Gallery
const galleryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/gallery",
  component: ComponentGallery,
});

// "/designsystem" - packages/ui inventory for app developers
const designSystemRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/designsystem",
  component: DesignSystemPage,
});

// ============================================================================
// Settings Routes — own layout (no app sidebar), mounted under root.
// ============================================================================

const settingsLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: SettingsLayout,
});

const settingsIndexRoute = createRoute({
  getParentRoute: () => settingsLayoutRoute,
  path: "/",
  component: SettingsIndexPage,
});

function SettingsIndexPage() {
  const search = useSearch({ strict: false }) as { projectId?: string };
  return search.projectId ? (
    <ProjectDetailPage projectIdOverride={search.projectId} />
  ) : (
    <ProfilePage />
  );
}

const settingsProfileRoute = createRoute({
  getParentRoute: () => settingsLayoutRoute,
  path: "/profile",
  component: ProfilePage,
});

const settingsSecurityRoute = createRoute({
  getParentRoute: () => settingsLayoutRoute,
  path: "/security",
  component: SecurityPage,
});

const settingsNotificationsRoute = createRoute({
  getParentRoute: () => settingsLayoutRoute,
  path: "/notifications",
  component: NotificationsPage,
});

const settingsOrganizationRoute = createRoute({
  getParentRoute: () => settingsLayoutRoute,
  path: "/organization",
  component: OrganizationPage,
});

const settingsOrganizationMembersRoute = createRoute({
  getParentRoute: () => settingsLayoutRoute,
  path: "/organization/members",
  component: MembersPage,
});

const settingsSsoRoute = createRoute({
  getParentRoute: () => settingsLayoutRoute,
  path: "/sso",
  component: SsoPage,
});

const settingsApiKeysRoute = createRoute({
  getParentRoute: () => settingsLayoutRoute,
  path: "/api-keys",
  component: ApiKeysPage,
});

const settingsBillingRoute = createRoute({
  getParentRoute: () => settingsLayoutRoute,
  path: "/billing",
  component: BillingPage,
});

const settingsCouponsRoute = createRoute({
  getParentRoute: () => settingsLayoutRoute,
  path: "/coupons",
  component: CouponsPage,
});

// ============================================================================
// Route Tree 구성
// ============================================================================

const routeTree = rootRoute.addChildren([
  // Dashboard Layout (사이드바 없는 대시보드)
  dashboardLayoutRoute.addChildren([indexRoute]),

  // App Layout + Protected Routes (AuthGuard 적용)
  appLayoutRoute.addChildren([
    // [ATLAS:ROUTES]
    ...createCommunityRoutes(appLayoutRoute),
    ...createEmailRoutes(appLayoutRoute),
    ...createNotificationRoutes(appLayoutRoute),
    ...createPaymentAuthRoutes(appLayoutRoute),
    // [/ATLAS:ROUTES]
  ]),

  settingsLayoutRoute.addChildren([
    settingsIndexRoute,
    settingsProfileRoute,
    settingsSecurityRoute,
    settingsNotificationsRoute,
    settingsOrganizationRoute,
    settingsOrganizationMembersRoute,
    settingsSsoRoute,
    settingsApiKeysRoute,
    settingsBillingRoute,
    settingsCouponsRoute,
  ]),

  // Story (own AuthGuard inside WorkspacePage)
  ...createStoryRoutes(rootRoute),

  // Public Routes
  signInRoute,
  signUpRoute,
  forgotPasswordRoute,
  resetPasswordRoute,
  magicLinkRoute,
  acceptInvitationRoute,
  workspaceSelectRoute,
  createWorkspaceRoute,
  galleryRoute,
  designSystemRoute,
  ...createIdentityVerificationRoutes(rootRoute),
  ...createOnboardingRoutes(rootRoute),
  ...createPaymentPublicRoutes(rootRoute),
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
