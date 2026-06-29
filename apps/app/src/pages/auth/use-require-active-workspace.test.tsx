import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRequireActiveWorkspace } from "./use-require-active-workspace";

const navigateMock = vi.hoisted(() => vi.fn<() => Promise<void>>());
const useSessionMock = vi.hoisted(() => vi.fn());
const useListOrganizationsMock = vi.hoisted(() => vi.fn());
const sessionRefetchMock = vi.hoisted(() => vi.fn<() => Promise<unknown>>());
const organizationsRefetchMock = vi.hoisted(() => vi.fn<() => Promise<unknown>>());
const setActiveOrganizationMock = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateMock,
}));

vi.mock("../../lib/auth-client", () => ({
  authClient: {
    useSession: useSessionMock,
    useListOrganizations: useListOrganizationsMock,
    organization: {
      setActive: setActiveOrganizationMock,
    },
  },
}));

describe("useRequireActiveWorkspace", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    navigateMock.mockResolvedValue(undefined);
    useSessionMock.mockReset();
    useListOrganizationsMock.mockReset();
    sessionRefetchMock.mockReset();
    organizationsRefetchMock.mockReset();
    setActiveOrganizationMock.mockReset();
    window.history.replaceState({}, "", "/");
    useSessionMock.mockReturnValue({
      data: {
        user: { id: "u1", email: "writer@studio.com", name: "Jane Writer" },
        session: { activeOrganizationId: null },
      },
      isPending: false,
      refetch: sessionRefetchMock,
    });
    useListOrganizationsMock.mockReturnValue({
      data: [],
      isPending: false,
      refetch: organizationsRefetchMock,
    });
  });

  it("keeps users without an active workspace on workspace selection after login", async () => {
    useListOrganizationsMock.mockReturnValue({
      data: [{ id: "org-current", name: "Current Workspace" }],
      isPending: false,
      refetch: organizationsRefetchMock,
    });

    render(<WorkspaceGuardProbe />);

    expect(screen.getByText("needs workspace")).toBeInTheDocument();
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({ to: "/workspace-select" });
    });
    expect(setActiveOrganizationMock).not.toHaveBeenCalled();
  });

  it("auto-activates a single workspace from a project deep link", async () => {
    window.history.replaceState(
      {},
      "",
      "/p/e765f5d3-a958-423f-875a-840417ac4138/lore",
    );
    useListOrganizationsMock.mockReturnValue({
      data: [{ id: "org-current", name: "Current Workspace" }],
      isPending: false,
      refetch: organizationsRefetchMock,
    });
    setActiveOrganizationMock.mockResolvedValue({ data: { id: "org-current" }, error: null });
    sessionRefetchMock.mockResolvedValue({ data: null });
    organizationsRefetchMock.mockResolvedValue({ data: [] });

    render(<WorkspaceGuardProbe />);

    expect(screen.getByText("checking workspace")).toBeInTheDocument();
    await waitFor(() => {
      expect(setActiveOrganizationMock).toHaveBeenCalledWith({ organizationId: "org-current" });
    });
    await waitFor(() => {
      expect(screen.getByText("ready:org-current")).toBeInTheDocument();
    });
    expect(navigateMock).not.toHaveBeenCalledWith(expect.objectContaining({ to: "/workspace-select" }));
    expect(sessionRefetchMock).toHaveBeenCalled();
    expect(organizationsRefetchMock).toHaveBeenCalled();
  });

  it("preserves the current project path when redirecting to workspace selection", async () => {
    window.history.replaceState(
      {},
      "",
      "/p/e765f5d3-a958-423f-875a-840417ac4138/lore",
    );

    render(<WorkspaceGuardProbe />);

    expect(screen.getByText("needs workspace")).toBeInTheDocument();
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({
        to: "/workspace-select",
        search: { next: "/p/e765f5d3-a958-423f-875a-840417ac4138/lore" },
      });
    });
  });

  it("keeps protected content blocked while validating a stale active workspace", async () => {
    useSessionMock.mockReturnValue({
      data: {
        user: { id: "u1", email: "writer@studio.com", name: "Jane Writer" },
        session: { activeOrganizationId: "org-stale" },
      },
      isPending: false,
      refetch: sessionRefetchMock,
    });
    useListOrganizationsMock
      .mockReturnValueOnce({
        data: undefined,
        isPending: true,
        refetch: organizationsRefetchMock,
      })
      .mockReturnValue({
        data: [{ id: "org-current", name: "Current Workspace" }],
        isPending: false,
        refetch: organizationsRefetchMock,
      });

    const { rerender } = render(<WorkspaceGuardProbe />);

    expect(screen.getByText("checking workspace")).toBeInTheDocument();
    expect(screen.queryByText("protected content")).not.toBeInTheDocument();

    rerender(<WorkspaceGuardProbe />);

    expect(screen.getByText("needs workspace")).toBeInTheDocument();
    expect(screen.queryByText("protected content")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({ to: "/workspace-select" });
    });
  });
});

function WorkspaceGuardProbe() {
  const {
    isCheckingWorkspace: workspaceChecking,
    needsWorkspace,
    activeWorkspaceId,
  } = useRequireActiveWorkspace(true);

  if (workspaceChecking) return <span>checking workspace</span>;
  return <span>{needsWorkspace ? "needs workspace" : `ready:${activeWorkspaceId}`}</span>;
}
