import { type AnyRoute, createRoute } from "@tanstack/react-router";
import { ScheduledJobPage } from "./pages";

export const SCHEDULER_ADMIN_PATH = "/scheduler";

export function createScheduledJobAdminRoutes(parentRoute: AnyRoute) {
  const schedulerRoute = createRoute({
    getParentRoute: () => parentRoute,
    path: "/scheduler",
    component: ScheduledJobPage,
  });

  return [schedulerRoute];
}
