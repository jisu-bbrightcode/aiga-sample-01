import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "../../lib/feature-i18n";
import { DesignSystemPage } from "./designsystem-page";

const DESIGN_SYSTEM_TEST_TIMEOUT_MS = 30_000;

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: (options: { count: number; estimateSize: (index: number) => number }) => {
    const items = Array.from({ length: options.count }, (_, index) => {
      let start = 0;
      for (let i = 0; i < index; i++) start += options.estimateSize(i);
      return {
        index,
        key: index,
        start,
        size: options.estimateSize(index),
      };
    });
    return {
      getVirtualItems: () => items,
      getTotalSize: () => items.reduce((total, item) => Math.max(total, item.start + item.size), 0),
    };
  },
}));

describe("DesignSystemPage", () => {
  beforeAll(() => {
    vi.setConfig({ testTimeout: DESIGN_SYSTEM_TEST_TIMEOUT_MS });
  });

  afterAll(() => {
    vi.resetConfig();
  });

  beforeEach(async () => {
    await i18n.changeLanguage("ko");
  });

  it("renders foundation-first inventory by default", () => {
    render(<DesignSystemPage />);

    expect(screen.getByRole("heading", { name: "Colors" })).toBeInTheDocument();
    expect(screen.getAllByText("Foundation").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Components").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Patterns").length).toBeGreaterThan(0);
    expect(screen.queryByText("Pages")).not.toBeInTheDocument();
    expect(screen.getByText("packages/ui")).toBeInTheDocument();
    expect(screen.queryByText("Usage Rules")).not.toBeInTheDocument();
  });

  it("renders toolbar samples with actual source references only", async () => {
    const user = userEvent.setup();
    render(<DesignSystemPage />);

    await user.click(screen.getByRole("button", { name: "Toolbar" }));

    expect(screen.getByRole("heading", { name: "Toolbar" })).toBeInTheDocument();
    expect(screen.getByText("Character list")).toBeInTheDocument();
    expect(screen.getByText("Canvas")).toBeInTheDocument();
    expect(screen.getByText("View off")).toBeInTheDocument();
    expect(screen.getByText("packages/ui/src/components/entity-subbar.tsx")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "검색" })).not.toBeInTheDocument();
  });

  it("renders typography as a 14px-first product inventory", async () => {
    const user = userEvent.setup();
    render(<DesignSystemPage />);

    await user.click(screen.getByRole("button", { name: "Typography" }));

    expect(screen.getByText("Product type scale")).toBeInTheDocument();
    expect(screen.getByText("14px 기반 UI 밀도")).toBeInTheDocument();
    expect(screen.getAllByText("가나다라마바사아자차카타파하abcdef~").length).toBeGreaterThan(1);
    expect(screen.getByText("text-base")).toBeInTheDocument();
    expect(screen.getAllByText("text-base / muted").length).toBeGreaterThan(0);
    expect(screen.getByText("text-sm / rare")).toBeInTheDocument();
    expect(screen.queryByText("Typography Specimens")).not.toBeInTheDocument();
    expect(screen.queryByText("List page")).not.toBeInTheDocument();
  });

  it("renders patterns using real shared layout components", async () => {
    const user = userEvent.setup();
    render(<DesignSystemPage />);

    await user.click(screen.getByRole("button", { name: "Entity Page" }));

    expect(screen.getByText("Aethon")).toBeInTheDocument();
    expect(screen.getByText("Nova")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "새 캐릭터" })).toBeInTheDocument();
    expect(screen.queryByText("Story / Entities")).not.toBeInTheDocument();
    expect(
      screen.getByText("apps/app/src/features/story/pages/entity-list-view.tsx"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("packages/ui/src/components/list-view-setting-popover.tsx"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Story Pages" })).not.toBeInTheDocument();
  });

  it("renders detail page pattern with the shared shell", async () => {
    const user = userEvent.setup();
    const { container } = render(<DesignSystemPage />);

    await user.click(screen.getByRole("button", { name: "Detail Page" }));

    expect(screen.getByRole("heading", { name: "Detail Page" })).toBeInTheDocument();
    expect(screen.getByText("DetailPageShell Composition")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "상세 제목" })).toHaveValue("Aethon");
    expect(screen.getByText("Nova")).toBeInTheDocument();
    expect(
      screen.getByText("apps/app/src/features/story/layouts/detail-page-shell.tsx"),
    ).toBeInTheDocument();
    const surface = container.querySelector('[data-el="ed-document-surface"]');
    expect(surface).toHaveClass("max-w-[1080px]");
    expect(surface).toHaveClass("grid-cols-[minmax(0,720px)_280px]");
  });

  it("renders list view settings popover and applies property toggles", async () => {
    const user = userEvent.setup();
    const { container } = render(<DesignSystemPage />);

    await user.click(screen.getByRole("button", { name: "Entity Page" }));
    expect(container.querySelector('[data-el="entity-table.col-head"]')).toHaveTextContent("상태");

    await user.click(screen.getByRole("button", { name: "설정" }));

    expect(screen.getByText("목록 설정")).toBeInTheDocument();
    expect(screen.getByText("그룹")).toBeInTheDocument();
    expect(screen.getByText("정렬")).toBeInTheDocument();
    expect(screen.getByText("최근")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "상태" })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "상태" }));

    expect(screen.getByRole("button", { name: "상태" })).toHaveAttribute("aria-pressed", "false");
    expect(container.querySelector('[data-el="entity-table.col-head"]')).not.toHaveTextContent(
      "상태",
    );
  });

  it("switches component previews without leaking previous section content", async () => {
    const user = userEvent.setup();
    render(<DesignSystemPage />);

    await user.click(screen.getByRole("button", { name: "Buttons" }));
    expect(screen.getByText("Button Component")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Popover" }));
    expect(screen.getByText("Popover Component")).toBeInTheDocument();
    expect(screen.getByText("Popover content")).toBeInTheDocument();
    expect(screen.queryByText("Button Component")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Settings Components" }));
    expect(screen.getByRole("heading", { name: "Settings Components" })).toBeInTheDocument();
    expect(screen.getByText("설정 사이드바와 항목 패턴")).toBeInTheDocument();
    expect(screen.getByText("Email notifications")).toBeInTheDocument();
    expect(screen.queryByText("Popover content")).not.toBeInTheDocument();
  });

  it("renders the custom caret overlay experiment with adjustable width", async () => {
    const user = userEvent.setup();
    const { container } = render(<DesignSystemPage />);

    await user.click(screen.getByRole("button", { name: "Custom Caret" }));

    expect(screen.getByRole("heading", { name: "Custom Caret" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Custom caret editor" })).toBeInTheDocument();
    expect(screen.getByText("Custom Caret Overlay")).toBeInTheDocument();
    expect(screen.getByText("현재 shape: rectangle")).toBeInTheDocument();
    expect(screen.getByText("현재 overlay width: 8px")).toBeInTheDocument();
    expect(screen.getByText(/native-like bar/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Small square" }));
    expect(screen.getByText("현재 shape: square")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "4px" }));

    expect(screen.getByText("현재 overlay width: 4px")).toBeInTheDocument();
    const overlay = container.querySelector('[data-el="designsystem.custom-caret-overlay"]');
    expect(overlay).not.toBeNull();
    expect(overlay).toHaveAttribute("data-shape", "square");
    expect(overlay).toHaveAttribute("data-native-like", "false");
    expect(overlay).toHaveAttribute("data-typing", "false");
    expect(overlay).toHaveStyle({ height: "8px", width: "8px" });
    expect(overlay).toHaveClass("animate-[custom-caret-blink_1s_steps(1,end)_infinite]");
    expect(
      screen.getByText("apps/app/src/pages/designsystem/designsystem-page.tsx"),
    ).toBeInTheDocument();
  });

  it("renders expanded shadcn component previews for service controls", async () => {
    const user = userEvent.setup();
    const { container } = render(<DesignSystemPage />);

    await user.click(screen.getByRole("button", { name: "Checkbox" }));
    expect(screen.getByRole("heading", { name: "Checkbox" })).toBeInTheDocument();
    expect(screen.getByText("Display properties")).toBeInTheDocument();
    expect(screen.getByText("packages/ui/src/_shadcn/checkbox.tsx")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Radio Group" }));
    expect(screen.getByText("Radio Group Component")).toBeInTheDocument();
    expect(screen.getByText("packages/ui/src/_shadcn/radio-group.tsx")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Switch" }));
    expect(screen.getByText("Switch Component")).toBeInTheDocument();
    expect(screen.getAllByRole("switch")).toHaveLength(3);

    await user.click(screen.getByRole("button", { name: "Toggle Group" }));
    expect(screen.getByText("Toggle Group Component")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Slider" }));
    expect(screen.getByText("Slider Component")).toBeInTheDocument();
    expect(screen.getByText("packages/ui/src/_shadcn/slider.tsx")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Form" }));
    expect(screen.getByText("Form Component")).toBeInTheDocument();
    expect(screen.getByLabelText("Entity name")).toBeInTheDocument();
    expect(screen.getByText("packages/ui/src/_shadcn/form.tsx")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Card" }));
    expect(screen.getByText("Card Components")).toBeInTheDocument();
    expect(screen.getByText("Project list card")).toBeInTheDocument();
    expect(
      screen.getByText("apps/app/src/features/project/components/project-card.tsx"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Paper Card" }));
    expect(screen.getByText("Project list paper card")).toBeInTheDocument();
    expect(
      screen.getByText("apps/app/src/features/project/components/project-card.tsx"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Navigation" }));
    expect(screen.getByText("Navigation Controls")).toBeInTheDocument();
    expect(screen.getByText("빠른 전환")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Outline" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Combobox" }));
    expect(screen.getByText("Combobox Component")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("엔티티 타입 선택")).toBeInTheDocument();
    expect(screen.getByText("packages/ui/src/_shadcn/combobox.tsx")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Command" }));
    expect(screen.getByText("Command Component")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Type a command or search...")).toBeInTheDocument();
    expect(screen.getByText("Suggestions")).toBeInTheDocument();
    expect(screen.getByText("Calendar")).toBeInTheDocument();
    expect(screen.getByText("packages/ui/src/_shadcn/command.tsx")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Context Menu" }));
    expect(screen.getByText("Context Menu Component")).toBeInTheDocument();
    expect(screen.getByText("packages/ui/src/_shadcn/context-menu.tsx")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Dropdown Menu" }));
    expect(screen.getByText("Dropdown Menu Component")).toBeInTheDocument();
    expect(screen.getByText("packages/ui/src/_shadcn/dropdown-menu.tsx")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Feedback" }));
    expect(screen.getByText("Feedback Components")).toBeInTheDocument();
    expect(screen.getByText("동기화 지연")).toBeInTheDocument();
    expect(screen.getByText("관계 그래프를 불러오는 중")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "AI Components" }));
    expect(screen.getByRole("heading", { name: "AI Components" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("What would you like to know?")).toBeInTheDocument();
    expect(screen.getByText("packages/ui/src/components/ai/prompt-input.tsx")).toBeInTheDocument();
    expect(
      screen.getByText("packages/ui/src/components/ai/voice-selector.tsx"),
    ).toBeInTheDocument();
    expect(container.querySelectorAll('[data-el="designsystem.ai-component-row"]')).toHaveLength(
      50,
    );
  });

  it("renders sidebar component fields under Components", async () => {
    const user = userEvent.setup();
    render(<DesignSystemPage />);

    await user.click(screen.getByRole("button", { name: "Sidebar" }));

    expect(screen.getByRole("heading", { name: "Sidebar" })).toBeInTheDocument();
    expect(screen.getByText("Sidebar Components")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Aethon")).toBeInTheDocument();
    expect(screen.getByDisplayValue("12")).toBeInTheDocument();
    expect(screen.getByDisplayValue("18:30")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2026-05-18")).toBeInTheDocument();
    expect(screen.getAllByText("상태").length).toBeGreaterThan(0);
    expect(screen.getByRole("switch", { name: "고정" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "On" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "주인공" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Comfortable" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Preview" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Hana" })).toBeInTheDocument();
    expect(
      screen.getByText("apps/app/src/features/story/layouts/detail-layout.tsx"),
    ).toBeInTheDocument();
  });

});
