import { useDomainCreate } from "@repo/data/hooks";
import { useLocations } from "@repo/data/hooks";
import { useParams } from "@tanstack/react-router";
import { EntitySplitListPage } from "./entity-split-list-page";

export function LocationListPage() {
  const { projectId } = useParams({ strict: false }) as { projectId: string };
  const { data, isLoading } = useLocations(projectId);
  const createMutation = useDomainCreate("locations");

  return (
    <EntitySplitListPage
      entity="location"
      projectId={projectId}
      data={(data ?? []) as unknown[]}
      isLoading={isLoading}
      onCreate={(input) =>
        createMutation.mutate(
          { projectId, name: input.name, description: input.description } as never,
        )
      }
      isCreating={createMutation.isPending}
    />
  );
}
