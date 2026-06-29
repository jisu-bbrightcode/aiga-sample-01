import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DraftPage } from "./draft-page";

const hooks = vi.hoisted(() => ({
  useCreateDraft: vi.fn(),
  useDeleteDraft: vi.fn(),
  useDraft: vi.fn(),
  useDrafts: vi.fn(),
  useUpdateDraft: vi.fn(),
}));

const router = vi.hoisted(() => ({
  navigate: vi.fn(),
  params: { projectId: "project-1" } as { projectId: string; draftId?: string },
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: { children: ReactNode; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => router.navigate,
  useParams: () => router.params,
}));

vi.mock("@repo/data/hooks", () => hooks);

function queryResult(data: unknown) {
  return { data, isLoading: false, isError: false };
}

describe("DraftPage", () => {
  const createDraftMutate = vi.fn();
  const updateDraftMutate = vi.fn();
  const deleteDraftMutate = vi.fn();

  beforeEach(() => {
    router.navigate.mockReset();
    router.params = { projectId: "project-1" };
    createDraftMutate.mockReset();
    updateDraftMutate.mockReset();
    deleteDraftMutate.mockReset();

    hooks.useDrafts.mockReturnValue(
      queryResult([
        {
          id: "draft-1",
          title: "Festival cold open",
          description: "Opening document notes",
          updatedAt: "2026-05-08T10:00:00.000Z",
        },
      ]),
    );
    hooks.useDraft.mockReturnValue(queryResult(null));
    hooks.useCreateDraft.mockReturnValue({ mutate: createDraftMutate, isPending: false });
    hooks.useUpdateDraft.mockReturnValue({ mutate: updateDraftMutate, isPending: false });
    hooks.useDeleteDraft.mockReturnValue({ mutate: deleteDraftMutate, isPending: false });
  });

  it("renders the Drafts.html quick capture and index-card grid", () => {
    const { container } = render(<DraftPage />);

    expect(container.querySelector('[data-el="page.header"]')).toBeInTheDocument();
    expect(container.querySelector('[data-el="draft-subbar"]')).toBeInTheDocument();
    expect(container.querySelector('[data-el="draft-capture"]')).toBeInTheDocument();
    expect(container.querySelector('[data-el="draft-grid"]')).toBeInTheDocument();
    expect(container.querySelector('[data-el="draft-card.paper"]')).toBeInTheDocument();
    expect(container.querySelector('[data-el="entity-table"]')).not.toBeInTheDocument();

    expect(screen.getByText("Festival cold open")).toBeInTheDocument();
    expect(screen.getByText("Opening document notes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "전체 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "고정 0" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "태그됨 0" })).toBeInTheDocument();
  });

  it("keeps draft creation on the page add button", async () => {
    const user = userEvent.setup();
    render(<DraftPage />);

    await user.click(screen.getByRole("button", { name: "새 초안" }));

    expect(createDraftMutate).toHaveBeenCalledWith(
      { projectId: "project-1", title: "새 초안" },
      expect.any(Object),
    );
  });

  it("creates a quick-capture draft with the first line as title", async () => {
    const user = userEvent.setup();
    render(<DraftPage />);

    await user.type(
      screen.getByPlaceholderText(/떠오른 아이디어를 빠르게 기록/),
      "Festival cold open\n#opening beat",
    );
    await user.click(screen.getByRole("button", { name: "저장" }));

    expect(createDraftMutate).toHaveBeenCalledWith(
      {
        projectId: "project-1",
        title: "Festival cold open",
        description: "Festival cold open\n#opening beat",
      },
      expect.any(Object),
    );
  });

  it("opens the selected draft as the only enlarged card editor and auto-saves edits", async () => {
    const user = userEvent.setup();
    router.params = { projectId: "project-1", draftId: "draft-1" };
    hooks.useDraft.mockReturnValue(
      queryResult({
        id: "draft-1",
        title: "Festival cold open",
        description: "Opening document notes",
        updatedAt: "2026-05-08T10:00:00.000Z",
      }),
    );

    const { container } = render(<DraftPage />);

    expect(container.querySelector('[data-el="draft-expanded-card.paper"]')).toBeInTheDocument();
    expect(container.querySelector('[data-el="draft-detail.toolbar"]')).toBeInTheDocument();
    expect(screen.queryByText("편집 중")).not.toBeInTheDocument();
    expect(container.querySelector('[data-el="draft-subbar"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-el="draft-capture"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-el="draft-card"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-el="draft-detail.delete"]')).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "초안 작업" })).toBeInTheDocument();
    const title = screen.getByPlaceholderText("제목 없음");
    expect(title).toHaveAttribute("autocomplete", "off");
    expect(title).toHaveAttribute("autocorrect", "off");
    expect(title).toHaveAttribute("autocapitalize", "off");
    expect(title).toHaveAttribute("spellcheck", "false");
    const body = screen.getByPlaceholderText("카드 본문을 작성하세요");
    expect(body).toHaveAttribute("autocomplete", "off");
    expect(body).toHaveAttribute("autocorrect", "off");
    expect(body).toHaveAttribute("autocapitalize", "off");
    expect(body).toHaveAttribute("spellcheck", "false");
    await user.clear(body);
    await user.type(body, "Opening document notes updated");

    await waitFor(
      () => {
        expect(updateDraftMutate).toHaveBeenCalledWith({
          id: "draft-1",
          description: "Opening document notes updated",
        });
      },
      { timeout: 1500 },
    );
  });
});
