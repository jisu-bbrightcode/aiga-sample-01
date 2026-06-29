/**
 * Email Feature - Client Routes
 */

import type { AnyRoute } from "@tanstack/react-router";

export function createEmailRoutes<T extends AnyRoute>(_parentRoute: T) {
  // Email feature currently has no client-facing routes
  // All UI is accessed through admin routes
  return [];
}
