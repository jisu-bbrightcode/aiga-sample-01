import type { operations } from "@repo/api-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

type UpdateProfileInput =
  operations["UserProfileController_updateName"]["requestBody"]["content"]["application/json"] & {
    avatar?: string | null;
  };

const profileQueryKey = ["get", "/api/user-profile/me"] as const;

function unwrapProfileMutation<T>(result: { data?: T; error?: unknown }): T {
  if (result.error) throw result.error;
  if (result.data === undefined) throw new Error("profile_empty_response");
  return result.data;
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["patch", "/api/user-profile/name"],
    mutationFn: async (input: UpdateProfileInput) => {
      const nameResult = await apiClient.PATCH("/api/user-profile/name", {
        body: { name: input.name },
      });
      unwrapProfileMutation(nameResult);

      if (input.avatar) {
        unwrapProfileMutation(
          await apiClient.POST("/api/user-profile/avatar/confirm", {
            body: { publicUrl: input.avatar },
          }),
        );
      }

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileQueryKey });
    },
  });
}
