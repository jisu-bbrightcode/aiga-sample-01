import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminDomainQueryKeys, createDomainDoctor, createDomainHospital } from "../api";
import type { DoctorCreateInput, HospitalCreateInput } from "../forms/create-schemas";
import type { DomainResourceType } from "../types";

type CreateVariables =
  | { type: "doctor"; input: DoctorCreateInput }
  | { type: "hospital"; input: HospitalCreateInput };

export interface CreatedDomainResource {
  type: DomainResourceType;
  id: string;
}

/**
 * 도메인 리소스(의사/병원) 생성 Mutation.
 *
 * Delegates to the type-specific create endpoint, invalidates the list so the
 * new (draft) record shows up, and returns `{ type, id }` so the caller can
 * navigate to the new detail page. PB-ADMIN-DOMAIN-CREATE-001 / BBR-680.
 */
export function useCreateDomainResource() {
  const queryClient = useQueryClient();

  return useMutation<CreatedDomainResource, Error, CreateVariables>({
    mutationFn: async (variables) => {
      const { id } =
        variables.type === "doctor"
          ? await createDomainDoctor(variables.input)
          : await createDomainHospital(variables.input);
      return { type: variables.type, id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminDomainQueryKeys.resourcesPrefix() });
    },
  });
}
