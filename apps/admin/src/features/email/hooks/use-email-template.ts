import { useQuery } from "@tanstack/react-query";
import { adminEmailTemplateQueryKeys, fetchTemplate } from "../templates-api";

/**
 * 이메일 템플릿 상세 조회 Hook (버전 목록 포함).
 */
export function useEmailTemplate(key: string | undefined) {
  return useQuery({
    queryKey: adminEmailTemplateQueryKeys.detail(key ?? ""),
    queryFn: ({ signal }) => fetchTemplate(key ?? "", signal),
    enabled: !!key,
  });
}
