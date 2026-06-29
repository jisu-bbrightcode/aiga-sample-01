import type { ServiceDomainService } from "./service";

/**
 * Module-level handle to the singleton ServiceDomainService, mirroring the
 * repo's existing feature pattern (see blog/service-registry). Lets non-DI
 * call sites (scripts, server-side helpers) reuse the wired instance.
 */
export let serviceDomainService: ServiceDomainService;

export const setServiceDomainService = (service: ServiceDomainService) => {
  serviceDomainService = service;
};
