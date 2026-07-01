import type { AnyRoute } from "@tanstack/react-router";
import { createRoute } from "@tanstack/react-router";
import { AdminSignInForm } from "../../pages";

function AdminLoginPage() {
  return <AdminSignInForm />;
}

/**
 * SCR-013 Admin Login Route — /admin/login (public)
 *
 * @param parentRoute - rootRoute를 전달받아 AdminGuard 밖 public 라우트로 연결
 * @remarks `?denied=1` 검색 파라미터로 권한 없는 계정 안내(permission) 상태를 표시한다.
 */
export const createAdminLoginRoute = (parentRoute: AnyRoute) =>
  createRoute({
    getParentRoute: () => parentRoute,
    path: "/admin/login",
    component: AdminLoginPage,
    validateSearch: (search: Record<string, unknown>): { denied?: number } => {
      const denied = search.denied;
      return denied == null ? {} : { denied: Number(denied) || 1 };
    },
  });
