import type { AnyRoute } from "@tanstack/react-router";
import { createRoute } from "@tanstack/react-router";
import { SignInForm } from "../pages";

function SignInPage() {
  return <SignInForm />;
}

/**
 * Sign In Route
 * @param rootRoute - App의 rootRoute를 전달받아 연결
 */
export const createSignInRoute = (rootRoute: AnyRoute) =>
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/sign-in",
    component: SignInPage,
  });
