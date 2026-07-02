/**
 * Non-lifecycle template actions: preview render + operator test-send.
 *
 * These do not mutate the template, but a successful test-send produces a new
 * email log, so it invalidates the logs list + the template's send summary.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminEmailQueryKeys } from "../api";
import { adminEmailTemplateQueryKeys, previewTemplate, testSendTemplate } from "../templates-api";
import type { TestSendInput } from "../templates-types";

export function usePreviewEmailTemplate(key: string) {
  return useMutation({
    mutationFn: (variables: Record<string, unknown>) => previewTemplate(key, variables),
  });
}

export function useTestSendEmailTemplate(key: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TestSendInput) => testSendTemplate(key, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminEmailQueryKeys.logsPrefix() });
      queryClient.invalidateQueries({ queryKey: adminEmailTemplateQueryKeys.detail(key) });
      queryClient.invalidateQueries({ queryKey: adminEmailTemplateQueryKeys.list() });
    },
  });
}
