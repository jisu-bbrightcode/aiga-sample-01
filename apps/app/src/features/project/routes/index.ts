/**
 * Project Feature Routes
 *
 * Project list is embedded in UserHome, so no standalone route is needed.
 * This file is here for future use (e.g., /projects/:id workspace).
 */
import type { AnyRoute } from "@tanstack/react-router";

export const PROJECT_PATH = "/projects";

export function createProjectRoutes<T extends AnyRoute>(_parentRoute: T) {
  // Project list is embedded in UserHome ("/").
  // Individual project routes will be added here when workspace is implemented.
  return [] as const;
}
