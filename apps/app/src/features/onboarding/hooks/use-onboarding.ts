/**
 * Onboarding REST hooks — migrated from tRPC
 */
import { ANALYTICS_EVENTS, captureEvent } from "@repo/core/analytics/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { $api, apiClient } from "@/lib/api";
import type { components } from "@repo/api-client";

export const ONBOARDING_STATUS_QUERY_KEY = ["get", "/api/onboarding/status"] as const;

export function useOnboardingStatus() {
  return $api.useQuery("get", "/api/onboarding/status", {});
}

export function useUpdateOnboardingStep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["put", "/api/onboarding/step"],
    mutationFn: async (input: components["schemas"]["UpdateStepDto"]) => {
      const { data, error } = await apiClient.PUT("/api/onboarding/step", {
        body: input,
      });
      if (error) throw error;
      return data!;
    },
    onSuccess: (_data, variables) => {
      captureEvent(ANALYTICS_EVENTS.ONBOARDING_STEP_COMPLETED, {
        step_number: variables.currentStep,
      });
      queryClient.invalidateQueries({ queryKey: ONBOARDING_STATUS_QUERY_KEY });
    },
  });
}

export function useCompleteOnboarding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["post", "/api/onboarding/complete"],
    mutationFn: async () => {
      const { data, error } = await apiClient.POST("/api/onboarding/complete", {});
      if (error) throw error;
      return data!;
    },
    onSuccess: () => {
      captureEvent(ANALYTICS_EVENTS.ONBOARDING_COMPLETED);
      queryClient.invalidateQueries({ queryKey: ONBOARDING_STATUS_QUERY_KEY });
    },
  });
}
