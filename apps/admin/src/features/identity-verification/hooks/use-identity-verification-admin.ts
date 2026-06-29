import { useQuery } from "@tanstack/react-query";
import { identityVerificationAdminApi, identityVerificationQueryKeys } from "../api";

export function useIdentityVerificationList() {
  return useQuery({
    queryKey: identityVerificationQueryKeys.list(),
    queryFn: identityVerificationAdminApi.list,
  });
}

export function useIdentityVerificationHealth() {
  return useQuery({
    queryKey: identityVerificationQueryKeys.health(),
    queryFn: identityVerificationAdminApi.health,
  });
}

export function useIdentityVerificationDetail(id: string) {
  return useQuery({
    queryKey: identityVerificationQueryKeys.detail(id),
    queryFn: () => identityVerificationAdminApi.detail(id),
    enabled: Boolean(id),
  });
}
