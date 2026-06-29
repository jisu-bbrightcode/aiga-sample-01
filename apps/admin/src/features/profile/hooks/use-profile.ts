import { $api } from "@/lib/api";

export function useProfile() {
  return $api.useQuery("get", "/api/user-profile/me", {});
}
