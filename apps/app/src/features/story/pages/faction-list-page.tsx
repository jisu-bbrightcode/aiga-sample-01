import { useDomainCreate, useFactions } from "@repo/data/hooks";
import { useParams } from "@tanstack/react-router";
import { EntitySplitListPage } from "./entity-split-list-page";

export function FactionListPage() {
  const { projectId } = useParams({ strict: false }) as { projectId: string };
  const { data, isLoading } = useFactions(projectId);
  const createMutation = useDomainCreate("factions");

  return (
    <EntitySplitListPage
      entity="faction"
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
