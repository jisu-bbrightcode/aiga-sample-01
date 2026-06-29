import { type AnyRoute, createRoute } from "@tanstack/react-router";
import { VideoLectureAdminPage } from "./pages/video-lecture-admin-page";

export function createVideoLectureAdminRoutes<T extends AnyRoute>(parentRoute: T) {
  return [
    createRoute({
      getParentRoute: () => parentRoute,
      path: "/video-lectures",
      component: VideoLectureAdminPage,
    }),
  ];
}
