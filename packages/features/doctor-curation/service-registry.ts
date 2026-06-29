import type { DoctorCurationService } from "./service";

/**
 * Module-level handle to the singleton DoctorCurationService, mirroring the
 * repo's existing feature pattern (see service-domain/service-registry). Lets
 * non-DI call sites (scripts, server-side helpers) reuse the wired instance.
 */
export let doctorCurationService: DoctorCurationService;

export const setDoctorCurationService = (service: DoctorCurationService) => {
  doctorCurationService = service;
};
