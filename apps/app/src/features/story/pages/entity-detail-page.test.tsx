import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EntityDetailPage } from "./entity-detail-page";

const dataHooks = vi.hoisted(() => ({
  getStoryLoreEntityById: vi.fn(),
  getStoryLoreEntityListQueryOptions: vi.fn(),
  toStoryLoreEntityType: vi.fn((category: string) =>
    category === "place" ? "location" : category,
  ),
  useAllDomainCreates: vi.fn(),
  useAllDomainDeletes: vi.fn(),
  useAllDomainUpdates: vi.fn(),
  useCharacter: vi.fn(),
  useCharacters: vi.fn(),
  useCodexEntry: vi.fn(),
  useCreateRelation: vi.fn(),
  useDeleteRelation: vi.fn(),
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
}));

const queryClient = vi.hoisted(() => ({
  ensureQueryData: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => queryClient,
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => router.navigate,
  useParams: () => ({ projectId: "project-1", entityId: "character-1" }),
}));

vi.mock("@repo/data/hooks", () => dataHooks);
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
  useProject: () => ({ data: { id: "project-1" } }),
}));
vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => ({ data: { user: { id: "owner-1" } } }) },
}));
vi.mock("@repo/ui/shadcn/sidebar", () => ({
  useSidebar: () => ({ open: true }),
}));
vi.mock("@/features/document", () => ({
  deriveDocumentStats: () => ({ mentionCounts: new Map(), bodyCharCount: 0 }),
  DocumentEditor: () => <div data-testid="document-editor" />,
  stringifyDocumentContent: () => JSON.stringify({ type: "doc", content: [] }),
  parseStoredDocument: () => null,
}));
vi.mock("../components/relation-picker", () => ({
  RelationPicker: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("../components/tag-picker", () => ({
  TagPicker: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("../components/actor-manage-button", () => ({
  ActorManageButton: () => <button type="button">actor</button>,
}));

describe("EntityDetailPage document detail", () => {
  beforeEach(() => {
    router.navigate.mockReset();
    queryClient.ensureQueryData.mockReset();
    dataHooks.useWorld.mockReturnValue(emptyQuery());
    dataHooks.useCharacter.mockReturnValue(emptyQuery());
    dataHooks.useLocation.mockReturnValue(emptyQuery());
    dataHooks.useFaction.mockReturnValue(emptyQuery());
    dataHooks.useCodexEntry.mockReturnValue(emptyQuery());
    dataHooks.useWorlds.mockReturnValue(emptyListQuery());
    dataHooks.useCharacters.mockReturnValue(emptyListQuery());
    dataHooks.useLocations.mockReturnValue(emptyListQuery());
    dataHooks.useFactions.mockReturnValue(emptyListQuery());
    dataHooks.useEntityTags.mockReturnValue(emptyListQuery());
    dataHooks.useEntityProperties.mockReturnValue(emptyEntityPropertiesQuery());
    dataHooks.useRelations.mockReturnValue(emptyListQuery());
    dataHooks.useRemoveEntityTag.mockReturnValue({ mutate: vi.fn() });
    dataHooks.useDeleteRelation.mockReturnValue({ mutate: vi.fn() });
    dataHooks.useCreateRelation.mockReturnValue({ mutate: vi.fn() });
    dataHooks.useAllDomainCreates.mockReturnValue({
      worlds: mutation(),
      characters: mutation(),
      locations: mutation(),
      factions: mutation(),
      codex: mutation(),
    });
    dataHooks.useAllDomainUpdates.mockReturnValue({
      worlds: mutation(),
      characters: mutation(),
      locations: mutation(),
      factions: mutation(),
      codex: mutation(),
    });
    dataHooks.useAllDomainDeletes.mockReturnValue({
      worlds: mutation(),
      characters: mutation(),
      locations: mutation(),
      factions: mutation(),
      codex: mutation(),
    });
    dataHooks.useUploadEntityImageSmall.mockReturnValue(mutation());
  });

  it("does not render a page count in the page toolbar", () => {
    dataHooks.useCharacter.mockReturnValue({
      data: {
        id: "character-1",
        name: "Aethon",
        description: "",
        body: "",
        createdAt: "2026-05-11T00:00:00.000Z",
        updatedAt: "2026-05-11T00:00:00.000Z",
      },
      isLoading: false,
    });
    dataHooks.useCharacters.mockReturnValue({
      data: [
        { id: "character-1", name: "Aethon" },
        { id: "character-2", name: "Bryn" },
      ],
      isLoading: false,
    });

    const { container } = render(
      <EntityDetailPage
        entityType="character"
        projectId="project-1"
        entityId="character-1"
        embedded
      />,
    );

    expect(container.querySelector('[data-el="ed-pager"]')).not.toBeInTheDocument();
    expect(screen.queryByText("1")).not.toBeInTheDocument();
    expect(screen.queryByText("2")).not.toBeInTheDocument();
  });

  it("removes page mode from the toolbar while keeping focus mode", () => {
    dataHooks.useCharacter.mockReturnValue({
      data: {
        id: "character-1",
        name: "Aethon",
        description: "",
        body: "",
        createdAt: "2026-05-11T00:00:00.000Z",
        updatedAt: "2026-05-11T00:00:00.000Z",
      },
      isLoading: false,
    });

    render(
      <EntityDetailPage
        entityType="character"
        projectId="project-1"
        entityId="character-1"
        embedded
      />,
    );

    expect(screen.queryByRole("button", { name: "shell.detail.pageMode" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "shell.detail.focusMode" })).toBeInTheDocument();
  });

  it("renders topbar add-ons before focus mode and feedback actions", () => {
    dataHooks.useCharacter.mockReturnValue({
      data: {
        id: "character-1",
        name: "Aethon",
        description: "",
        body: "",
        createdAt: "2026-05-11T00:00:00.000Z",
        updatedAt: "2026-05-11T00:00:00.000Z",
      },
      isLoading: false,
    });

    const { container } = render(
      <EntityDetailPage
        entityType="character"
        projectId="project-1"
        entityId="character-1"
        embedded
        topbarAddon={
          <>
            <button type="button" aria-label="리스트뷰" />
            <button type="button" aria-label="그래프뷰" />
          </>
        }
      />,
    );

    const labels = [...container.querySelectorAll('[data-el="ed-topbar.actions"] button')].map(
      (button) => button.getAttribute("aria-label"),
    );
    expect(labels.slice(0, 4)).toEqual([
      "리스트뷰",
      "그래프뷰",
      "shell.detail.focusMode",
      "shell.detail.sidebarClose",
    ]);
  });

  it("renders a clickable 96px character image upload control", async () => {
    const upload = vi.fn().mockResolvedValue({ imageSmallUrl: "https://blob.test/aria.png" });
    dataHooks.useCharacter.mockReturnValue({
      data: {
        id: "character-1",
        name: "Aria",
        description: "",
        body: "",
        createdAt: "2026-05-11T00:00:00.000Z",
        updatedAt: "2026-05-11T00:00:00.000Z",
      },
      isLoading: false,
    });
    dataHooks.useEntityProperties.mockReturnValue({
      data: {
        entityId: "character-1",
        entityType: "character",
        projectId: "project-1",
        properties: [{ key: "imageSmallUrl", value: "https://blob.test/current.png" }],
      },
      isLoading: false,
      isFetching: false,
    });
    dataHooks.useUploadEntityImageSmall.mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: upload,
      isPending: false,
    });

    render(
      <EntityDetailPage
        entityType="character"
        projectId="project-1"
        entityId="character-1"
        embedded
      />,
    );

    const imageButton = screen.getByRole("button", {
      name: "entity.detail.imageUpload.ariaLabel",
    });
    expect(imageButton).toHaveClass("size-24");

    const fileInput = screen.getByLabelText("entity.detail.imageUpload.fileAria");
    const file = new File(["avatar"], "aria.png", { type: "image/png" });
    await userEvent.upload(fileInput, file);

    expect(upload).toHaveBeenCalledWith({
      projectId: "project-1",
      entityId: "character-1",
      entityType: "character",
      fileName: "aria.png",
      contentType: "image/png",
      bytesBase64: "YXZhdGFy",
    });
  });
});

function emptyQuery() {
  return { data: undefined, isLoading: false, isFetching: false };
}

function emptyListQuery() {
  return { data: [], isLoading: false, isFetching: false };
}

function emptyEntityPropertiesQuery() {
  return { data: undefined, isLoading: false, isFetching: false };
}

function mutation() {
  return { mutate: vi.fn(), mutateAsync: vi.fn().mockResolvedValue(null), isPending: false };
}
