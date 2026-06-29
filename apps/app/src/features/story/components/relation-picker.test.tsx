import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RelationPicker, RelationPickerPanel } from "./relation-picker";

const dataHooks = vi.hoisted(() => ({
  useCreateRelation: vi.fn(),
  useStoryLoreEntityList: vi.fn(),
}));

vi.mock("@repo/data/hooks", () => dataHooks);
vi.mock("@repo/core/i18n", () => ({
  useFeatureTranslation: () => ({
    t: (key: string) =>
      ({
        "picker.relation.empty": "일치하는 항목 없음",
        "picker.relation.head": "관계",
        "picker.relation.searchPlaceholder": "이름으로 검색...",
        "entity.card.type.character": "캐릭터",
        "entity.card.type.codex": "코덱스",
        "entity.card.type.faction": "세력",
        "entity.card.type.location": "장소",
        "entity.card.type.world": "세계",
      })[key] ?? key,
  }),
}));
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: (options: { count: number; estimateSize: (index: number) => number }) => ({
    getTotalSize: () => options.count * options.estimateSize(0),
    getVirtualItems: () =>
      Array.from({ length: options.count }, (_, index) => ({
        index,
        start: index * options.estimateSize(index),
      })),
  }),
}));

describe("RelationPickerPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dataHooks.useStoryLoreEntityList.mockReturnValue({
      data: [{ id: "char-raynor", name: "짐 레이너" }],
    });
    dataHooks.useCreateRelation.mockReturnValue({ mutate: vi.fn() });
  });

  it("uses the same unfiltered character cache key as the character list page", () => {
    render(
      <RelationPickerPanel projectId="project-1" initialType="character" onSelect={vi.fn()} />,
    );

    expect(dataHooks.useStoryLoreEntityList).toHaveBeenCalledWith(
      "character",
      "project-1",
      undefined,
    );
    expect(screen.getByRole("button", { name: /짐 레이너/ })).toBeInTheDocument();
  });

  it("opens the people picker directly on the character query", () => {
    render(
      <RelationPicker
        projectId="project-1"
        sourceId="character-1"
        sourceType="character"
        initialType="character"
      >
        <span>+ 인물 추가</span>
      </RelationPicker>,
    );

    expect(dataHooks.useStoryLoreEntityList).toHaveBeenCalledWith(
      "character",
      "project-1",
      undefined,
    );

    fireEvent.click(screen.getByText("+ 인물 추가"));

    expect(dataHooks.useStoryLoreEntityList).toHaveBeenCalledWith(
      "character",
      "project-1",
      undefined,
    );
    expect(screen.getByRole("button", { name: /짐 레이너/ })).toBeInTheDocument();
  });
});
