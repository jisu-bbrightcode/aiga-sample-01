/**
 * Onboarding Feature Routes
 */

import type { AnyRoute } from "@tanstack/react-router";
import { createRoute } from "@tanstack/react-router";
import { OnboardingPage } from "../pages/onboarding-page";

export const ONBOARDING_PATH = "/onboarding";

export function createOnboardingRoutes<T extends AnyRoute>(parentRoute: T) {
  return [
    createRoute({
      getParentRoute: () => parentRoute,
      path: "/onboarding",
      component: OnboardingPage,
    }),
  ];
}
