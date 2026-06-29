import type { ServiceSearchService } from "./service";

/**
 * Module-level handle to the singleton ServiceSearchService, mirroring the
 * service-domain feature pattern. Lets non-DI call sites (e.g. a reindex script
 * or scheduled job) reuse the wired instance.
 */
export let serviceSearchService: ServiceSearchService;

export const setServiceSearchService = (service: ServiceSearchService) => {
  serviceSearchService = service;
};
