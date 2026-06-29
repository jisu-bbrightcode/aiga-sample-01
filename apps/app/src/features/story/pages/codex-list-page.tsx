/**
 * 공통 EntityListView 래퍼. 현재 목록 IA는 세계/캐릭터/장소/세력과 같은
 * table-first 패턴을 유지하고, 코덱스 route/hook/create mutation만 주입한다.
 */

import { useCodexEntries, useDomainCreate } from "@repo/data/hooks";
import { useParams } from "@tanstack/react-router";
import { EntitySplitListPage } from "./entity-split-list-page";

export function CodexListPage() {
  const { projectId } = useParams({ strict: false }) as { projectId: string };
  const { data, isLoading } = useCodexEntries(projectId);
  const createMutation = useDomainCreate("codex");

  return (
    <EntitySplitListPage
      entity="codex"
      projectId={projectId}
      data={(data ?? []) as unknown[]}
      isLoading={isLoading}
      onCreate={(input) =>
        createMutation.mutate({
          projectId,
          name: input.name,
          description: input.description,
        } as never)
      }
      isCreating={createMutation.isPending}
    />
  );
}
