/**
 * Email Feature Routes
 */
import { type AnyRoute, createRoute } from "@tanstack/react-router";
import { EmailTemplateDetailPage } from "./routes/admin/email-template-detail-page";
import { EmailTemplatesPage } from "./routes/admin/email-templates-page";
import { EmailLogsPage } from "./routes/admin/email-logs-page";

export const EMAIL_ADMIN_PATH = "/email-logs";
export const EMAIL_TEMPLATES_ADMIN_PATH = "/email-templates";

/**
 * Create admin routes for email templates + logs management.
 */
export function createEmailAdminRoutes<T extends AnyRoute>(parentRoute: T) {
  return [
    createRoute({
      getParentRoute: () => parentRoute,
      path: "/email-templates",
      component: EmailTemplatesPage,
    }),
    createRoute({
      getParentRoute: () => parentRoute,
      path: "/email-templates/$key",
      component: EmailTemplateDetailPage,
    }),
    createRoute({
      getParentRoute: () => parentRoute,
      path: "/email-logs",
      component: EmailLogsPage,
    }),
  ];
}
