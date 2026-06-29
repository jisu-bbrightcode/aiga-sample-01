import type { OnboardingService } from "./service";

export let onboardingService: OnboardingService;

export const setOnboardingService = (service: OnboardingService) => {
  onboardingService = service;
};
