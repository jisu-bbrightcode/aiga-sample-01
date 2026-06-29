import { $api, apiClient } from "@/lib/api";

export const USER_PROFILE_ME_QUERY_KEY = ["get", "/api/user-profile/me"] as const;
export const SETTINGS_PROJECTS_LIST_QUERY_KEY = ["get", "/api/settings-projects"] as const;

export function requireApiData<T>(data: T | undefined): T {
  if (data === undefined) {
    throw new Error("REST response body missing");
  }
  return data;
}

export function getUserPreferenceQueryKey(key: string) {
  return ["get", "/api/user-preferences/{key}", { params: { path: { key } } }] as const;
}

export function getOrganizationMetadataQueryKey(organizationId: string) {
  return [
    "get",
    "/api/organization-settings/{organizationId}/metadata",
    { params: { path: { organizationId } } },
  ] as const;
}

export function getOrganizationMembershipQueryKey(organizationId: string) {
  return [
    "get",
    "/api/organization-settings/{organizationId}/membership",
    { params: { path: { organizationId } } },
  ] as const;
}

export function getOrganizationMembersQueryKey(organizationId: string) {
  return [
    "get",
    "/api/organization-settings/{organizationId}/members",
    { params: { path: { organizationId } } },
  ] as const;
}

export function getSettingsProjectByIdQueryKey(projectId: string) {
  return [
    "get",
    "/api/settings-projects/{projectId}",
    { params: { path: { projectId } } },
  ] as const;
}

export function useUserPreference(key: string) {
  return $api.useQuery("get", "/api/user-preferences/{key}", {
    params: { path: { key } },
  });
}

export async function setUserPreference(input: { key: string; value: string }) {
  const { data, error } = await apiClient.PUT("/api/user-preferences/{key}", {
    params: { path: { key: input.key } },
    body: { value: input.value },
  });
  if (error) throw error;
  return requireApiData(data);
}

export { $api, apiClient };
