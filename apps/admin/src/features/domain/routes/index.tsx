/**
 * Domain (의사/병원) Admin Feature Routes
 */
import { createRoute } from "@tanstack/react-router";
import { DOMAIN_ADMIN_PATH } from "../constants";
import { AdminDomainDetailPage } from "./admin-domain-detail-page";
import { AdminDomainListPage } from "./admin-domain-list-page";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createDomainAdminRoutes(parentRoute: any) {
  const domainListRoute = createRoute({
    getParentRoute: () => parentRoute,
    path: DOMAIN_ADMIN_PATH,
    component: AdminDomainListPage,
  });

  const domainDetailRoute = createRoute({
    getParentRoute: () => parentRoute,
    path: `${DOMAIN_ADMIN_PATH}/$type/$id`,
    component: AdminDomainDetailPage,
  });

  return [domainListRoute, domainDetailRoute];
}
