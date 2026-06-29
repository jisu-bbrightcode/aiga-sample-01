import { type AnyRoute, createRoute } from "@tanstack/react-router";
import { IdentityVerificationAdminPage, IdentityVerificationDetailPage } from "./pages";

export const IDENTITY_VERIFICATION_ADMIN_PATH = "/identity-verification";

export function createIdentityVerificationAdminRoutes(parentRoute: AnyRoute) {
  return [
    createRoute({
      getParentRoute: () => parentRoute,
      path: IDENTITY_VERIFICATION_ADMIN_PATH,
      component: IdentityVerificationAdminPage,
    }),
    createRoute({
      getParentRoute: () => parentRoute,
      path: "/identity-verification/$sessionId",
      component: IdentityVerificationDetailPage,
    }),
  ];
}
