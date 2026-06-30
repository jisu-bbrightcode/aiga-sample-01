/**
 * Personalization write hooks for the logged-in service flow (FR-002 / BBR-729).
 *
 * 저장/관심 추가 (POST) and 해제 (DELETE). Each mutation invalidates the matching
 * list query on success so the My Page reflects the change without a manual
 * refetch. Errors propagate as {@link ServiceFlowError} (stable code, never raw
 * server text) so callers map them through `getAppErrorMessage` for a
 * user-facing toast.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createInterest,
  createSavedItem,
  removeInterest,
  removeSavedItem,
} from "../api/service-flow-api";
import type { CreateInterestInput, CreateSavedItemInput } from "../api/types";
import { serviceFlowKeys } from "./queries";

export function useCreateSavedItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSavedItemInput) => createSavedItem(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: serviceFlowKeys.savedItems });
    },
  });
}

export function useCreateInterest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateInterestInput) => createInterest(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: serviceFlowKeys.interests });
    },
  });
}

export function useRemoveSavedItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => removeSavedItem(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: serviceFlowKeys.savedItems });
    },
  });
}

export function useRemoveInterest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => removeInterest(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: serviceFlowKeys.interests });
    },
  });
}
