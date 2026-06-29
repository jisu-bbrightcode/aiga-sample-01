import type { AnyRoute } from "@tanstack/react-router";
import { createRoute } from "@tanstack/react-router";
import { SignUpForm } from "../pages";

function SignUpPage() {
  return <SignUpForm />;
}

/**
 * Sign Up Route
 * @param rootRoute - App의 rootRoute를 전달받아 연결
 */
export const createSignUpRoute = (rootRoute: AnyRoute) =>
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/sign-up",
    component: SignUpPage,
  });
