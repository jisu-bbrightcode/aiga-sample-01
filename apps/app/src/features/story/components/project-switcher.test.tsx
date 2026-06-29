import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectSwitcher } from "./project-switcher";

const navigateMock = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateMock,
  useParams: () => ({ projectId: "project-1" }),
}));

vi.mock("jotai", () => ({
  useAtomValue: () => null,
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: { session: { activeOrganizationId: "workspace-1" } } }),
  },
}));

vi.mock("@/features/workspace/active-workspace", () => ({
  activeWorkspaceOverrideAtom: {},
  getEffectiveActiveWorkspaceId: () => "workspace-1",
}));

vi.mock("@/features/project/hooks/use-project-queries", () => ({
  useProject: () => ({ data: { id: "project-1", name: "Design QA" } }),
  useProjects: () => ({ data: [{ id: "project-1", name: "Design QA" }] }),
}));

describe("ProjectSwitcher", () => {
  beforeEach(() => {
    navigateMock.mockClear();
  });

  it("uses the existing project-row search icon to open project search", async () => {
    const user = userEvent.setup();
    render(<ProjectSwitcher />);

    await user.click(screen.getByRole("button", { name: "프로젝트 검색" }));

    expect(navigateMock).toHaveBeenCalledWith({ to: "/p/project-1/search" });
  });

  it("opens settings with the current project id as search context", async () => {
    const user = userEvent.setup();
    render(<ProjectSwitcher />);

    await user.click(screen.getByRole("button", { name: /Design QA/ }));
    await user.click(screen.getByRole("button", { name: "설정" }));

    expect(navigateMock).toHaveBeenCalledWith({
      to: "/settings",
      search: { projectId: "project-1" },
    });
  });
});
