/**
 * Notification Feature - Client
 *
 * TODO: Widget re-exports will be added when notification widget package is available.
 */

// Types
export type * from "../common/types";
// Admin-only components (local)
export { NotificationBroadcastForm } from "./pages/notification-broadcast-form";
export { NotificationStats } from "./pages/notification-stats";
// Routes
export { createNotificationRoutes } from "./routes";
