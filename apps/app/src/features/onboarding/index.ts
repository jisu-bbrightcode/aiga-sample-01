/**
 * Onboarding Feature - Client Entry Point
 */

export {
  useCompleteOnboarding,
  useOnboardingStatus,
  useUpdateOnboardingStep,
} from "./hooks/use-onboarding";
export { OnboardingPage } from "./pages/onboarding-page";
export { createOnboardingRoutes, ONBOARDING_PATH } from "./routes";
