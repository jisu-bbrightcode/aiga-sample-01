/**
 * 공통 EntityListView 래퍼. 도메인별 hook 주입만 담당.
 */

import { useDomainCreate, useWorlds } from "@repo/data/hooks";
import { useParams } from "@tanstack/react-router";
import { EntitySplitListPage } from "./entity-split-list-page";

export function WorldListPage() {
  const { projectId } = useParams({ strict: false }) as { projectId: string };
  const { data, isLoading } = useWorlds(projectId);
  const createMutation = useDomainCreate("worlds");

  return (
    <EntitySplitListPage
      entity="world"
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
