import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { adminEmailTemplateQueryKeys, fetchTemplates } from "../templates-api";

/**
 * 이메일 템플릿 목록 조회 Hook.
 */
export function useEmailTemplates() {
  return useQuery({
    queryKey: adminEmailTemplateQueryKeys.list(),
    queryFn: ({ signal }) => fetchTemplates(signal),
    placeholderData: keepPreviousData,
  });
}
