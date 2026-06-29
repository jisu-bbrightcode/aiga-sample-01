import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProjectListPage } from "./project-list-page";

const useProjectsMock = vi.hoisted(() => vi.fn());
const mutateMock = vi.hoisted(() => vi.fn());

vi.mock("@lottiefiles/dotlottie-react", () => ({
  DotLottieReact: (props: { src?: string }) => (
    <span data-src={props.src} data-testid="dotlottie" />
  ),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("jotai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("jotai")>()),
  useAtomValue: () => new Set<string>(),
}));

vi.mock("../hooks/use-project-queries", () => ({
  useProjects: (activeWorkspaceId?: string | null, options?: { enabled?: boolean }) =>
    useProjectsMock(activeWorkspaceId, options),
}));

vi.mock("../hooks/use-project-mutations", () => ({
  useArchiveProject: () => ({ mutate: mutateMock }),
  useUpdateLastOpened: () => ({ mutate: mutateMock }),
}));

vi.mock("../components/create-project-dialog", () => ({
  CreateProjectDialog: () => null,
}));

vi.mock("../components/empty-projects", () => ({
  EmptyProjects: () => <div />,
  NoResultsState: () => <div />,
}));

vi.mock("../components/project-card", () => ({
  ProjectCard: ({ name }: { name: string }) => <div data-testid="project-card">{name}</div>,
}));

describe("ProjectListPage", () => {
  it("uses quiet project card placeholders while projects are loading", () => {
    useProjectsMock.mockReturnValue({ data: undefined, error: null, isLoading: true });

    render(
      <ProjectListPage
        activeWorkspaceId="org-a"
        createDialogOpen={false}
        forceLoading={false}
        onClearFilters={vi.fn()}
        onCreateDialogChange={vi.fn()}
        onOpenCreateDialog={vi.fn()}
        query=""
        scope="all"
        sidebarFilter="all"
        sortBy="modified"
      />,
    );

    expect(screen.getByRole("status", { name: "프로젝트 불러오는 중..." })).toBeInTheDocument();
    expect(screen.getAllByTestId("project-loading-card")).toHaveLength(4);
    expect(screen.queryByTestId("dotlottie")).not.toBeInTheDocument();
    expect(useProjectsMock).toHaveBeenCalledWith("org-a", { enabled: true });
  });

  it("keeps old cached projects hidden while a workspace switch is pending", () => {
    useProjectsMock.mockReturnValue({
      data: [{ id: "old", name: "Old Workspace Project" }],
      error: null,
      isLoading: false,
    });

    render(
      <ProjectListPage
        activeWorkspaceId="org-b"
        createDialogOpen={false}
        forceLoading
        onClearFilters={vi.fn()}
        onCreateDialogChange={vi.fn()}
        onOpenCreateDialog={vi.fn()}
        query=""
        scope="all"
        sidebarFilter="all"
        sortBy="modified"
      />,
    );

    expect(screen.getByRole("status", { name: "프로젝트 불러오는 중..." })).toBeInTheDocument();
    expect(screen.queryByText("Old Workspace Project")).not.toBeInTheDocument();
    expect(useProjectsMock).toHaveBeenCalledWith("org-b", { enabled: false });
  });
});
