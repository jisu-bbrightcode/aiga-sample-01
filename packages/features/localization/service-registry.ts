import type { LocalizationService } from "./service";

export let localizationService: LocalizationService;

export const setLocalizationService = (service: LocalizationService) => {
  localizationService = service;
};
