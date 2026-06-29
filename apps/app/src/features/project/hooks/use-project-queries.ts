/**
 * Project Query Hooks
 */
import { $api } from "@/lib/api";

/** REST queryKey base for project list: ["get", "/api/projects"] */
export const PROJECT_LIST_QUERY_KEY = ["get", "/api/projects"] as const;

export function getWorkspaceProjectListQueryKey(
  baseQueryKey: readonly unknown[],
  activeWorkspaceId?: string | null,
): readonly unknown[] {
  if (!activeWorkspaceId) return baseQueryKey;
  return [...baseQueryKey, { activeWorkspaceId }];
}

export function useProjects(
  activeWorkspaceId?: string | null,
  options: { enabled?: boolean } = {},
) {
  return $api.useQuery(
    "get",
    "/api/projects",
    {},
    {
      // activeWorkspaceId 없으면 server 가 PRECONDITION_FAILED 반환 — 사용자 layout 의
      // `useRequireActiveWorkspace` 가 `/workspace-select` 로 navigate 하기 전 race 로
      // 401 이 떨어지지 않도록 guard.
      enabled: (options.enabled ?? true) && Boolean(activeWorkspaceId),
      // openapi-react-query types queryKey narrowly to the generated shape;
      // cast required for the workspace-scoped key extension ({ activeWorkspaceId }).
      queryKey: getWorkspaceProjectListQueryKey(PROJECT_LIST_QUERY_KEY, activeWorkspaceId) as any,
    },
  );
}

export function useProject(id: string) {
  return $api.useQuery(
    "get",
    "/api/projects/{id}",
    { params: { path: { id } } },
    { enabled: !!id },
  );
}
