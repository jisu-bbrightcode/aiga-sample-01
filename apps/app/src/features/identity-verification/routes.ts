import type { AnyRoute } from "@tanstack/react-router";
import { createRoute } from "@tanstack/react-router";
import { IdentityVerificationDemoPage, IdentityVerificationFormPage } from "./pages";

export const IDENTITY_VERIFICATION_PATH = "/identity-verification";
export const IDENTITY_VERIFICATION_FORM_PATH = "/identity-verification-form";

export function createIdentityVerificationRoutes<T extends AnyRoute>(parentRoute: T) {
  return [
    createRoute({
      getParentRoute: () => parentRoute,
      path: IDENTITY_VERIFICATION_PATH,
      component: IdentityVerificationDemoPage,
    }),
    createRoute({
      getParentRoute: () => parentRoute,
      path: IDENTITY_VERIFICATION_FORM_PATH,
      component: IdentityVerificationFormPage,
    }),
  ];
}
