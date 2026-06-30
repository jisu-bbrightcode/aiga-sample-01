/**
 * Service-flow routes (PB-WEB-002 / BBR-580).
 *
 * Mounted on the root route (NOT the workspace AppLayout) because the AIGA
 * service is consumer-facing and must not force workspace selection:
 *  - `/explore` — public, browsable logged-out (gated CTAs handle protected actions)
 *  - `/me`      — private 내 페이지, wrapped in {@link RequireAuth}
 */

import { createRoute } from "@tanstack/react-router";
import { RequireAuth } from "../components/require-auth";
import { ExplorePage } from "../pages/explore-page";
import { MyPage } from "../pages/my-page";

function GuardedMyPage() {
  return (
    <RequireAuth>
      <MyPage />
    </RequireAuth>
  );
}

// biome-ignore lint/suspicious/noExplicitAny: route factory mirrors sibling features (createCommunityRoutes).
export function createServiceFlowRoutes(rootRoute: any) {
  const exploreRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/explore",
    component: ExplorePage,
  });

  const myPageRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/me",
    component: GuardedMyPage,
  });

  return [exploreRoute, myPageRoute];
}
