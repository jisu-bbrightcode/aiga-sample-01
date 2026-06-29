import type { AnyRoute } from "@tanstack/react-router";
import { createAdminLoginRoute } from "./admin/login";
import { createSignInRoute } from "./sign-in";
import { createSignUpRoute } from "./sign-up";

export { createAdminLoginRoute } from "./admin/login";
export { createSignInRoute } from "./sign-in";
export { createSignUpRoute } from "./sign-up";

/**
 * Auth Feature의 모든 Public Routes 생성
 *
 * @example
 * ```tsx
 * // apps/app/src/router.tsx
 * import { createAuthRoutes } from "./features/auth";
 *
 * const routeTree = rootRoute.addChildren([
 *   indexRoute,
 *   ...createAuthRoutes(rootRoute),
 * ]);
 * ```
 */
export function createAuthRoutes(rootRoute: AnyRoute) {
  return [createSignInRoute(rootRoute), createSignUpRoute(rootRoute)];
}

/**
 * Auth Feature의 Admin Routes 생성
 *
 * @example
 * ```tsx
 * const routeTree = rootRoute.addChildren([
 *   ...createAuthAdminRoutes(rootRoute),
 * ]);
 * ```
 */
export function createAuthAdminRoutes(parentRoute: AnyRoute) {
  return [createAdminLoginRoute(parentRoute)];
}
