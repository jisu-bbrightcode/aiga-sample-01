/**
 * Template lifecycle mutations: create / update / publish / archive(toggle).
 *
 * Each mutation refreshes the list and (where relevant) the affected detail so
 * the UI reflects server-authoritative state immediately after the write.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  adminEmailTemplateQueryKeys,
  createTemplate,
  publishTemplate,
  updateTemplate,
} from "../templates-api";
import type { CreateTemplateInput, UpdateTemplateInput } from "../templates-types";

export function useCreateEmailTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTemplateInput) => createTemplate(input),
    onSuccess: (detail) => {
      queryClient.invalidateQueries({ queryKey: adminEmailTemplateQueryKeys.list() });
      queryClient.setQueryData(adminEmailTemplateQueryKeys.detail(detail.key), detail);
    },
  });
}

export function useUpdateEmailTemplate(key: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateTemplateInput) => updateTemplate(key, input),
    onSuccess: (detail) => {
      queryClient.invalidateQueries({ queryKey: adminEmailTemplateQueryKeys.list() });
      queryClient.setQueryData(adminEmailTemplateQueryKeys.detail(key), detail);
    },
  });
}

export function usePublishEmailTemplate(key: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (previewVariables?: Record<string, unknown>) =>
      publishTemplate(key, previewVariables),
    onSuccess: (detail) => {
      queryClient.invalidateQueries({ queryKey: adminEmailTemplateQueryKeys.list() });
      queryClient.setQueryData(adminEmailTemplateQueryKeys.detail(key), detail);
    },
  });
}

/**
 * Archive == deactivate (`isActive: false`); reactivate flips it back. The
 * server has no hard delete — a deactivated template is hidden from active use
 * but its versions/history are preserved.
 */
export function useSetEmailTemplateActive(key: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (isActive: boolean) => updateTemplate(key, { isActive }),
    onSuccess: (detail) => {
      queryClient.invalidateQueries({ queryKey: adminEmailTemplateQueryKeys.list() });
      queryClient.setQueryData(adminEmailTemplateQueryKeys.detail(key), detail);
    },
  });
}
