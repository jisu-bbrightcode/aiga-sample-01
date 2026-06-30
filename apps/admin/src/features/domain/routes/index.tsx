/**
 * Domain (의사/병원) Admin Feature Routes
 */
import { createRoute } from "@tanstack/react-router";
import { DOMAIN_ADMIN_CREATE_PATH, DOMAIN_ADMIN_EDIT_PATH, DOMAIN_ADMIN_PATH } from "../constants";
import { AdminDomainCreatePage } from "./admin-domain-create-page";
import { AdminDomainDetailPage } from "./admin-domain-detail-page";
import { AdminDomainEditPage } from "./admin-domain-edit-page";
import { AdminDomainListPage } from "./admin-domain-list-page";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createDomainAdminRoutes(parentRoute: any) {
  const domainListRoute = createRoute({
    getParentRoute: () => parentRoute,
    path: DOMAIN_ADMIN_PATH,
    component: AdminDomainListPage,
  });

  // Static `/domain/new` is registered before the `$type/$id` detail route so
  // it is never shadowed by the dynamic param matcher.
  const domainCreateRoute = createRoute({
    getParentRoute: () => parentRoute,
    path: DOMAIN_ADMIN_CREATE_PATH,
    component: AdminDomainCreatePage,
  });

  // `/domain/$type/$id/edit` is registered before the `$type/$id` detail route
  // so the longer, more specific path wins the match.
  const domainEditRoute = createRoute({
    getParentRoute: () => parentRoute,
    path: DOMAIN_ADMIN_EDIT_PATH,
    component: AdminDomainEditPage,
  });

  const domainDetailRoute = createRoute({
    getParentRoute: () => parentRoute,
    path: `${DOMAIN_ADMIN_PATH}/$type/$id`,
    component: AdminDomainDetailPage,
  });

  return [domainListRoute, domainCreateRoute, domainEditRoute, domainDetailRoute];
}
