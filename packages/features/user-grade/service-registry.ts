import type { UserGradeService } from "./service";

/**
 * Module-level handle to the singleton UserGradeService, mirroring the repo's
 * existing feature pattern (see service-domain/service-registry). Lets non-DI
 * call sites (the better-auth signup hook, scripts) reuse the wired instance —
 * e.g. `userGradeService.ensureSignupGrade(userId)` on user creation.
 */
export let userGradeService: UserGradeService;

export const setUserGradeService = (service: UserGradeService) => {
  userGradeService = service;
};
