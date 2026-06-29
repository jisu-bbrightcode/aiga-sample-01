import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CharacterListPage } from "./character-list-page";

const hooks = vi.hoisted(() => ({
  useAllDomainCreates: vi.fn(),
  useAllDomainDeletes: vi.fn(),
  useAllDomainUpdates: vi.fn(),
  useCharacter: vi.fn(),
  useCharacters: vi.fn(),
  useCodexEntry: vi.fn(),
  useCreateRelation: vi.fn(),
  useDeleteRelation: vi.fn(),
  useDomainCreate: vi.fn(),
  useEntityProperties: vi.fn(),
  useEntityTags: vi.fn(),
  useFaction: vi.fn(),
  useFactions: vi.fn(),
  useLocation: vi.fn(),
  useLocations: vi.fn(),
  useRelations: vi.fn(),
  useRemoveEntityTag: vi.fn(),
  useUploadEntityImageSmall: vi.fn(),
  useWorld: vi.fn(),
  useWorlds: vi.fn(),
}));

const router = vi.hoisted(() => ({
  navigate: vi.fn(),
  params: { projectId: "project-1" } as { projectId: string; entityId?: string },
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => router.navigate,
  useParams: () => router.params,
}));

vi.mock("@repo/data/hooks", () => hooks);
vi.mock("@repo/data/provider", () => ({
  useDataBackend: () => ({
    worlds: { list: vi.fn(), getById: vi.fn() },
    characters: { list: vi.fn(), getById: vi.fn() },
    locations: { list: vi.fn(), getById: vi.fn() },
    factions: { list: vi.fn(), getById: vi.fn() },
    codex: { list: vi.fn(), getById: vi.fn() },
  }),
}));
vi.mock("@/features/project/hooks/use-project-queries", () => ({
  useProject: () => ({ data: { id: "project-1", name: "테스트 프로젝트" } }),
}));
vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => ({ data: { user: { id: "owner-1" } } }) },
}));
vi.mock("@repo/ui/shadcn/sidebar", () => ({
  useSidebar: () => ({ setOpen: vi.fn() }),
}));
vi.mock("@/features/document", () => ({
  deriveDocumentStats: () => ({ mentionCounts: new Map(), bodyCharCount: 0 }),
  DocumentEditor: () => <div data-testid="document-editor" />,
  stringifyDocumentContent: () => JSON.stringify({ type: "doc", content: [] }),
  parseStoredDocument: () => null,
}));
vi.mock("@/features/story/components/actor-manage-button", () => ({
  ActorManageButton: () => <button type="button">actor</button>,
}));
vi.mock("../components/relation-picker", () => ({
  RelationPicker: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("../components/tag-picker", () => ({
  TagPicker: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const characters = [
  {
    id: "character-1",
    name: "Aethon",
    description: "달빛 해안에서 온 침착한 외교관.",
    body: "",
    roles: ["playable", "npc"],
    status: "draft",
    createdAt: "2026-05-11T00:00:00.000Z",
    updatedAt: "2026-05-11T00:00:00.000Z",
  },
  {
    id: "character-2",
    name: "Bryn",
    description: "",
    body: "",
    roles: [],
    status: "progress",
    createdAt: "2026-05-12T00:00:00.000Z",
    updatedAt: "2026-05-12T00:00:00.000Z",
  },
];

describe("CharacterListPage", () => {
  beforeEach(() => {
    router.navigate.mockReset();
    router.params = { projectId: "project-1" };
    hooks.useCharacters.mockReturnValue(queryResult(characters));
    hooks.useCharacter.mockImplementation((id: string) =>
      queryResult(characters.find((character) => character.id === id)),
    );
    hooks.useDomainCreate.mockReturnValue(mutation());
    hooks.useWorld.mockReturnValue(queryResult(undefined));
    hooks.useLocation.mockReturnValue(queryResult(undefined));
    hooks.useFaction.mockReturnValue(queryResult(undefined));
    hooks.useCodexEntry.mockReturnValue(queryResult(undefined));
    hooks.useWorlds.mockReturnValue(queryResult([]));
    hooks.useLocations.mockReturnValue(queryResult([]));
    hooks.useFactions.mockReturnValue(queryResult([]));
    hooks.useEntityTags.mockReturnValue(queryResult([]));
    hooks.useEntityProperties.mockReturnValue(queryResult({ properties: [] }));
    hooks.useRelations.mockReturnValue(queryResult([]));
    hooks.useRemoveEntityTag.mockReturnValue({ mutate: vi.fn() });
    hooks.useDeleteRelation.mockReturnValue({ mutate: vi.fn() });
    hooks.useCreateRelation.mockReturnValue({ mutate: vi.fn() });
    hooks.useUploadEntityImageSmall.mockReturnValue(mutation());
    hooks.useAllDomainCreates.mockReturnValue({
      worlds: mutation(),
      characters: mutation(),
      locations: mutation(),
      factions: mutation(),
      codex: mutation(),
    });
    hooks.useAllDomainUpdates.mockReturnValue({
      worlds: mutation(),
      characters: mutation(),
      locations: mutation(),
      factions: mutation(),
      codex: mutation(),
    });
    hooks.useAllDomainDeletes.mockReturnValue({
      worlds: mutation(),
      characters: mutation(),
      locations: mutation(),
      factions: mutation(),
      codex: mutation(),
    });
  });

  it("does not render the legacy top toolbar on the split list", () => {
    render(<CharacterListPage />);

    expect(screen.queryByRole("button", { name: "전체" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "작성중" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "목록" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "보드" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "캔버스" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "타임라인" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "캘린더" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "검색" })).not.toBeInTheDocument();
  });

  it("shows the split rail and first character detail on initial render", async () => {
    const { container } = render(<CharacterListPage />);
    const rail = container.querySelector('[data-el="story-split.rail"]');
    expect(rail).not.toBeNull();

    expect(rail).toBeInTheDocument();
    expect(container.querySelector('[data-el="story-split.detail"]')).toBeInTheDocument();
    const entityTable = (rail as HTMLElement).querySelector('[data-el="entity-table"]');
    expect(entityTable).not.toBeNull();
    expect(entityTable).toHaveClass("px-2");
    expect(entityTable).not.toHaveClass("px-7");
    expect(screen.getByRole("searchbox", { name: "shell.detail.searchAria" })).toBeInTheDocument();
    expect(screen.queryByText("이름")).not.toBeInTheDocument();
    expect(within(rail as HTMLElement).queryByText(/#\d+/)).not.toBeInTheDocument();
    expect(await screen.findByDisplayValue("Aethon")).toBeInTheDocument();
  });

  it("shows character roles under the detail name", async () => {
    render(<CharacterListPage />);

    expect(await screen.findByDisplayValue("Aethon")).toBeInTheDocument();
    const roleList = screen.getByLabelText("entity.detail.character.rolesAria");
    expect(within(roleList).getByText("entity.detail.character.role.playable")).toBeInTheDocument();
    expect(within(roleList).getByText("entity.detail.character.role.npc")).toBeInTheDocument();
  });

  it("shows the character role edit menu trigger", async () => {
    render(<CharacterListPage />);

    expect(await screen.findByDisplayValue("Aethon")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "entity.detail.character.addRoleAria" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "entity.detail.character.removeRoleAria" }),
    ).toHaveLength(2);
  });

  it("shows the character bio from description under role controls", async () => {
    render(<CharacterListPage />);

    expect(await screen.findByDisplayValue("Aethon")).toBeInTheDocument();
    expect(screen.getByLabelText("entity.detail.character.bioAria")).toHaveValue(
      "달빛 해안에서 온 침착한 외교관.",
    );
    expect(screen.getByText("18/120")).toBeInTheDocument();
  });

  it("orders the split rail like stacked pages from oldest to newest", async () => {
    hooks.useCharacters.mockReturnValue(queryResult([...characters].reverse()));

    const { container } = render(<CharacterListPage />);
    const rail = container.querySelector('[data-el="story-split.rail"]');
    expect(rail).not.toBeNull();

    const rowTitles = await within(rail as HTMLElement).findAllByText(/Aethon|Bryn/);
    expect(rowTitles.map((node) => node.textContent)).toEqual(["Aethon", "Bryn"]);
    expect(await screen.findByDisplayValue("Aethon")).toBeInTheDocument();
  });

  it("renders hash-prefixed list item text one step larger and bolder", async () => {
    hooks.useCharacters.mockReturnValue(
      queryResult([
        {
          ...characters[0],
          name: "# Aethon",
        },
        characters[1],
      ]),
    );

    const { container } = render(<CharacterListPage />);
    const rail = container.querySelector('[data-el="story-split.rail"]');
    expect(rail).not.toBeNull();

    const hashTitle = await within(rail as HTMLElement).findByText("# Aethon");
    const baseTitle = within(rail as HTMLElement).getByText("Bryn");
    expect(hashTitle).toHaveClass("text-lg");
    expect(hashTitle).toHaveClass("font-medium");
    expect(baseTitle).toHaveClass("text-base");
    expect(baseTitle).toHaveClass("font-normal");
  });

  it("keeps the split shell during initial loading instead of flashing the legacy list page", () => {
    hooks.useCharacters.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      isFetching: true,
    });

    const { container } = render(<CharacterListPage />);

    expect(container.querySelector('[data-el="story-split.rail"]')).toBeInTheDocument();
    expect(container.querySelector('[data-el="story-split.detail"]')).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "shell.detail.searchAria" })).toBeInTheDocument();
    const rail = container.querySelector('[data-el="story-split.rail"]') as HTMLElement;
    expect(within(rail).getByRole("status")).toHaveTextContent("entity.split.rail.loading");
    expect(container.querySelector('[data-el="story-split.detail"]')).toBeEmptyDOMElement();
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "entity.split.rail.add" })).not.toBeInTheDocument();
  });

  it("filters the split rail from the top search field", async () => {
    const user = userEvent.setup();
    const { container } = render(<CharacterListPage />);
    const rail = container.querySelector('[data-el="story-split.rail"]');
    expect(rail).not.toBeNull();

    await user.type(screen.getByRole("searchbox", { name: "shell.detail.searchAria" }), "Bryn");

    expect(within(rail as HTMLElement).queryByText("Aethon")).not.toBeInTheDocument();
    expect(within(rail as HTMLElement).getByText("Bryn")).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByPlaceholderText("entity.detail.titlePlaceholder.character"),
      ).toHaveDisplayValue("Bryn"),
    );
  });

  it("keeps the route-selected detail when search filters it out of the rail", async () => {
    router.params = { projectId: "project-1", entityId: "character-1" };
    const user = userEvent.setup();
    const { container } = render(<CharacterListPage />);
    const rail = container.querySelector('[data-el="story-split.rail"]');
    expect(rail).not.toBeNull();

    await user.type(screen.getByRole("searchbox", { name: "shell.detail.searchAria" }), "Bryn");

    expect(within(rail as HTMLElement).queryByText("Aethon")).not.toBeInTheDocument();
    expect(within(rail as HTMLElement).getByText("Bryn")).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByPlaceholderText("entity.detail.titlePlaceholder.character"),
      ).toHaveDisplayValue("Aethon"),
    );
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it("switches selected detail on row click and updates the route", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<CharacterListPage />);

    await screen.findByDisplayValue("Aethon");
    await user.click(screen.getByText("Bryn"));

    router.params = { projectId: "project-1", entityId: "character-2" };
    rerender(<CharacterListPage />);

    await waitFor(() => expect(screen.getByDisplayValue("Bryn")).toBeInTheDocument());
    expect(router.navigate).toHaveBeenCalledWith({
      to: "/p/project-1/lore/characters/character-2",
    });
  });

  it("does not fight the current route while a clicked row navigation is pending", async () => {
    router.params = { projectId: "project-1", entityId: "character-1" };
    const user = userEvent.setup();
    render(<CharacterListPage />);

    await screen.findByDisplayValue("Aethon");
    await user.click(screen.getByText("Bryn"));

    await waitFor(() =>
      expect(router.navigate).toHaveBeenCalledWith({
        to: "/p/project-1/lore/characters/character-2",
      }),
    );
    expect(router.navigate).not.toHaveBeenCalledWith({
      to: "/p/project-1/lore/characters/character-1",
      replace: true,
    });
    expect(router.navigate).not.toHaveBeenCalledWith({
      to: "/p/project-1/lore/characters/character-2",
      replace: true,
    });
  });

  it("uses the route entity id as the selected split detail", async () => {
    router.params = { projectId: "project-1", entityId: "character-2" };

    render(<CharacterListPage />);

    expect(await screen.findByDisplayValue("Bryn")).toBeInTheDocument();
    expect(router.navigate).not.toHaveBeenCalled();
  });
});

function queryResult<T>(data: T) {
  return { data, isLoading: false, isError: false, isFetching: false };
}

function mutation() {
  return { mutate: vi.fn(), mutateAsync: vi.fn().mockResolvedValue(null), isPending: false };
}
