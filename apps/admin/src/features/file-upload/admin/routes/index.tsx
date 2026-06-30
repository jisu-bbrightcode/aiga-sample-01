/**
 * 파일 관리자/감사 콘솔 Admin Feature Routes (PB-FILE-ADMIN-001 / BBR-555).
 */
import { createRoute } from "@tanstack/react-router";
import { FILES_ADMIN_PATH } from "../constants";
import { AdminFilesPage } from "./admin-files-page";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFileAdminRoutes(parentRoute: any) {
  const filesRoute = createRoute({
    getParentRoute: () => parentRoute,
    path: FILES_ADMIN_PATH,
    component: AdminFilesPage,
  });

  return [filesRoute];
}
