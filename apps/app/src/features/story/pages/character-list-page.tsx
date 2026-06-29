import { useCharacters, useDomainCreate } from "@repo/data/hooks";
import { useParams } from "@tanstack/react-router";
import { EntitySplitListPage } from "./entity-split-list-page";

export function CharacterListPage() {
  const { projectId } = useParams({ strict: false }) as { projectId: string };
  const { data, isLoading } = useCharacters(projectId);
  const createMutation = useDomainCreate("characters");

  return (
    <EntitySplitListPage
      entity="character"
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
