import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RelationPicker } from "./relation-picker";
import { TagPicker } from "./tag-picker";

const dataHooks = vi.hoisted(() => ({
  useAddEntityTag: vi.fn(),
  useCharacters: vi.fn(),
  useCodexEntries: vi.fn(),
  useCreateRelation: vi.fn(),
  useEntityTags: vi.fn(),
  useFactions: vi.fn(),
  useLocations: vi.fn(),
  useRemoveEntityTag: vi.fn(),
  useStoryLoreEntityList: vi.fn(),
  useTags: vi.fn(),
  useWorlds: vi.fn(),
}));

const dataBackend = vi.hoisted(() => ({
  addWithCreatedTag: vi.fn(),
}));

vi.mock("@repo/core/i18n", () => ({
  useFeatureTranslation: () => ({
    t: (key: string, values?: Record<string, string>) =>
      values?.name ? `${key}:${values.name}` : key,
  }),
}));

vi.mock("@repo/data/provider", () => ({
  useDataBackend: () => ({
    entityTags: dataBackend,
  }),
}));

vi.mock("@repo/data/hooks", () => dataHooks);

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count, estimateSize }: { count: number; estimateSize: () => number }) => {
    const rowHeight = estimateSize();
    return {
      getTotalSize: () => count * rowHeight,
      getVirtualItems: () =>
        Array.from({ length: count }, (_, index) => ({
          index,
          key: index,
          size: rowHeight,
          start: index * rowHeight,
        })),
    };
  },
}));

vi.mock("@repo/ui/shadcn/popover", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  const PopoverContext = React.createContext<{
    onOpenChange?: (open: boolean) => void;
    open?: boolean;
  }>({});

  return {
    Popover: ({
      children,
      onOpenChange,
      open,
    }: {
      children: React.ReactNode;
      onOpenChange?: (open: boolean) => void;
      open?: boolean;
    }) =>
      React.createElement(
        PopoverContext.Provider,
        { value: { onOpenChange, open } },
        React.createElement("div", null, children),
      ),
    PopoverContent: ({ children }: { children: React.ReactNode }) => {
      const context = React.useContext(PopoverContext);
      return context.open ? React.createElement("div", { role: "dialog" }, children) : null;
    },
    PopoverTrigger: ({ children }: { children: React.ReactNode }) => {
      const context = React.useContext(PopoverContext);
      return React.createElement(
        "span",
        {
          "data-testid": "popover-trigger",
          onClick: () => context.onOpenChange?.(!context.open),
        },
        children,
      );
    },
  };
});

describe("story sidebar pickers", () => {
  beforeEach(() => {
    dataBackend.addWithCreatedTag.mockReset();
    dataHooks.useAddEntityTag.mockReturnValue({ mutate: vi.fn() });
    dataHooks.useCreateRelation.mockReturnValue({ mutate: vi.fn() });
    dataHooks.useRemoveEntityTag.mockReturnValue({ mutate: vi.fn() });
    dataHooks.useEntityTags.mockReturnValue({ data: [] });
    dataHooks.useStoryLoreEntityList.mockReturnValue({ data: [] });
    dataHooks.useTags.mockReturnValue({ data: [] });
    dataHooks.useWorlds.mockReturnValue({ data: [] });
    dataHooks.useCharacters.mockReturnValue({ data: [] });
    dataHooks.useLocations.mockReturnValue({ data: [] });
    dataHooks.useFactions.mockReturnValue({ data: [] });
    dataHooks.useCodexEntries.mockReturnValue({ data: [] });
  });

  it("creates a lore relation when a popover item is selected", async () => {
    const user = userEvent.setup();
    const mutate = vi.fn();
    dataHooks.useCreateRelation.mockReturnValue({ mutate });
    dataHooks.useStoryLoreEntityList.mockReturnValue({
      data: [{ id: "char-1", name: "짐 레이너" }],
    });

    render(
      <RelationPicker
        projectId="project-1"
        sourceId="character-1"
        sourceType="character"
        initialType="character"
      >
        <button type="button">+ 연결 추가</button>
      </RelationPicker>,
    );

    await user.click(screen.getByRole("button", { name: "+ 연결 추가" }));
    await user.click(screen.getByRole("button", { name: /짐 레이너/ }));

    expect(mutate).toHaveBeenCalledWith(
      {
        projectId: "project-1",
        sourceId: "character-1",
        sourceType: "character",
        targetId: "char-1",
        targetName: "짐 레이너",
        targetType: "character",
      },
      { onError: expect.any(Function) },
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("adds a character-scoped tag when a tag popover item is selected", async () => {
    const user = userEvent.setup();
    const mutate = vi.fn();
    dataHooks.useAddEntityTag.mockReturnValue({ mutate });
    dataHooks.useTags.mockReturnValue({
      data: [{ id: "tag-1", name: "위험" }],
    });

    renderWithQueryClient(
      <TagPicker projectId="project-1" entityId="character-1" entityType="character">
        <button type="button">+ 태그 추가</button>
      </TagPicker>,
    );

    await user.click(screen.getByRole("button", { name: "+ 태그 추가" }));
    await user.click(screen.getByRole("button", { name: "위험" }));

    expect(mutate).toHaveBeenCalledWith({
      entityId: "character-1",
      entityType: "character",
      tagId: "tag-1",
      tagName: "위험",
    });
  });
});

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}
