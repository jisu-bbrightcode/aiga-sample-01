import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectSearchPage } from "./project-search-page";

const hooks = vi.hoisted(() => ({
  useWorlds: vi.fn(),
  useCharacters: vi.fn(),
  useLocations: vi.fn(),
  useFactions: vi.fn(),
  useCodexEntries: vi.fn(),
  useDrafts: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: { children: ReactNode; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
  useParams: () => ({ projectId: "project-1" }),
}));

vi.mock("@repo/data/hooks", () => hooks);

function queryResult(data: unknown) {
  return { data, isLoading: false, isError: false };
}

describe("ProjectSearchPage", () => {
  beforeEach(() => {
    hooks.useWorlds.mockReturnValue(
      queryResult([
        {
          id: "world-1",
          name: "Aethys",
          description: "Moon atlas world",
          updatedAt: new Date(),
        },
      ]),
    );
    hooks.useCharacters.mockReturnValue(
      queryResult([
        {
          id: "character-1",
          name: "Mira Vale",
          personality: "stoic",
          updatedAt: "2020-01-01T00:00:00.000Z",
        },
      ]),
    );
    hooks.useLocations.mockReturnValue(
      queryResult([{ id: "location-1", name: "North Archive", description: "Moon atlas vault" }]),
    );
    hooks.useFactions.mockReturnValue(queryResult([]));
    hooks.useCodexEntries.mockReturnValue(queryResult([]));
    hooks.useDrafts.mockReturnValue(
      queryResult([
        {
          id: "draft-1",
          title: "Festival cold open",
          description: "Moon atlas note",
          updatedAt: new Date(),
        },
      ]),
    );
  });

  it("does not list project content before the user enters a search query", () => {
    render(<ProjectSearchPage />);

    expect(screen.getByText("0개 결과")).toBeInTheDocument();
    expect(screen.queryByText("Aethys")).not.toBeInTheDocument();
  });

  it("does not render a fake all-tab in the search surface", () => {
    render(<ProjectSearchPage />);

    expect(screen.queryByRole("button", { name: "전체" })).not.toBeInTheDocument();
  });

  it("uses the existing compact 14px icon size for search surface controls", () => {
    const { container } = render(<ProjectSearchPage />);

    const headerIcon = container.querySelector('[data-el="project-search.header"] svg');
    const closeIcon = screen.getByRole("button", { name: "검색 닫기" }).querySelector("svg");
    const emptyIcon = container.querySelector('[data-el="project-search.empty"] svg');

    expect(headerIcon).toHaveClass("size-3.5");
    expect(closeIcon).toHaveClass("size-3.5");
    expect(emptyIcon).toHaveClass("size-3.5");
  });

  it("searches by names and titles", async () => {
    const user = userEvent.setup();
    render(<ProjectSearchPage />);

    await user.type(screen.getByRole("searchbox", { name: "콘텐츠 검색" }), "aethys");

    expect(screen.getByText("Aethys")).toBeInTheDocument();
    expect(screen.queryByText("North Archive")).not.toBeInTheDocument();
    expect(screen.queryByText("Festival cold open")).not.toBeInTheDocument();
  });

  it("keeps the search input transparent and result rows at 28px with 12px titles", async () => {
    const user = userEvent.setup();
    const { container } = render(<ProjectSearchPage />);

    const input = screen.getByRole("searchbox", { name: "콘텐츠 검색" });
    expect(input).toHaveClass("bg-transparent");

    await user.type(input, "aethys");

    const title = screen.getByText("Aethys");
    const table = container.querySelector('[data-el="entity-table"]');
    const row = title.closest('[data-el="entity-table.row"]');

    expect(table).toBeInTheDocument();
    expect(container.querySelector('[data-el="project-search.result"]')).not.toBeInTheDocument();
    expect(row).toHaveStyle({ height: "28px" });
    expect(title).toHaveClass("text-xs");
  });

  it("opens the filter context menu from @ without search-scope controls", async () => {
    const user = userEvent.setup();
    render(<ProjectSearchPage />);

    await user.type(screen.getByRole("searchbox", { name: "콘텐츠 검색" }), "moon");

    expect(screen.queryByText("검색 속성")).not.toBeInTheDocument();
    expect(screen.queryByText("North Archive")).not.toBeInTheDocument();

    await user.type(screen.getByRole("searchbox", { name: "콘텐츠 검색" }), " @");

    expect(screen.queryByText("검색 범위")).not.toBeInTheDocument();
    expect(screen.getByText("최근 수정")).toBeInTheDocument();
    expect(screen.getByText("결과 타입")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "이름" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "설명" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "본문" })).not.toBeInTheDocument();
    expect(screen.queryByText("North Archive")).not.toBeInTheDocument();
  });

  it("closes the @ filter menu with Escape or when the typed @ is deleted", async () => {
    const user = userEvent.setup();
    render(<ProjectSearchPage />);

    const input = screen.getByRole("searchbox", { name: "콘텐츠 검색" });
    await user.type(input, "@");

    expect(screen.getByRole("dialog", { name: "검색 필터 메뉴" })).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog", { name: "검색 필터 메뉴" })).not.toBeInTheDocument();

    await user.clear(input);
    await user.type(input, "@");

    expect(screen.getByRole("dialog", { name: "검색 필터 메뉴" })).toBeInTheDocument();

    await user.keyboard("{Backspace}");

    expect(input).toHaveValue("");
    expect(screen.queryByRole("dialog", { name: "검색 필터 메뉴" })).not.toBeInTheDocument();
  });

  it("closes the @ filter menu when the user clicks the empty search surface", async () => {
    const user = userEvent.setup();
    const { container } = render(<ProjectSearchPage />);

    await user.type(screen.getByRole("searchbox", { name: "콘텐츠 검색" }), "@");

    expect(screen.getByRole("dialog", { name: "검색 필터 메뉴" })).toBeInTheDocument();

    const content = container.querySelector('[data-el="project-search.content"]');
    expect(content).toBeInTheDocument();
    await user.click(content as Element);

    expect(screen.queryByRole("dialog", { name: "검색 필터 메뉴" })).not.toBeInTheDocument();
  });

  it("runs search immediately when a possible @ filter is selected", async () => {
    const user = userEvent.setup();
    render(<ProjectSearchPage />);

    const input = screen.getByRole("searchbox", { name: "콘텐츠 검색" });
    await user.type(input, "@");

    expect(screen.getByRole("button", { name: "초안" })).toHaveAttribute("aria-pressed", "false");

    await user.click(screen.getByRole("button", { name: "초안" }));

    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
    expect(screen.queryByRole("dialog", { name: "검색 필터 메뉴" })).not.toBeInTheDocument();
    expect(screen.getByText("Festival cold open")).toBeInTheDocument();
    expect(screen.queryByText("Aethys")).not.toBeInTheDocument();
  });

  it("runs search immediately from a last-updated @ filter", async () => {
    const user = userEvent.setup();
    render(<ProjectSearchPage />);

    await user.type(screen.getByRole("searchbox", { name: "콘텐츠 검색" }), "@");
    await user.click(screen.getByRole("button", { name: "지난 1주" }));

    expect(screen.getByText("Aethys")).toBeInTheDocument();
    expect(screen.getByText("Festival cold open")).toBeInTheDocument();
    expect(screen.queryByText("Mira Vale")).not.toBeInTheDocument();
    expect(screen.queryByText("North Archive")).not.toBeInTheDocument();
  });

  it("does not render the old separate property exploration button", () => {
    render(<ProjectSearchPage />);

    expect(screen.queryByRole("button", { name: "속성 탐색" })).not.toBeInTheDocument();
  });

  it("does not create a duplicate search rail inside the search page", () => {
    render(<ProjectSearchPage />);

    expect(screen.queryByRole("button", { name: "전체 검색" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "속성 검색" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "속성 메뉴 열기" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "검색 필터" })).not.toBeInTheDocument();
  });

  it("keeps @ filter menu rows at the compact 28px design height", async () => {
    const user = userEvent.setup();
    render(<ProjectSearchPage />);

    await user.type(screen.getByRole("searchbox", { name: "콘텐츠 검색" }), "@");

    expect(screen.getByRole("button", { name: "지난 1주" })).toHaveClass("h-7");
    expect(screen.getByRole("button", { name: "지난 1주" })).toHaveClass("text-base");
  });
});
