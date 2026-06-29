import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createStore, Provider as JotaiProvider } from "jotai";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardLayout } from "./dashboard-layout";

const navigateMock = vi.hoisted(() => vi.fn());
const matchRouteMock = vi.hoisted(() => vi.fn(() => false));
const useSessionMock = vi.hoisted(() => vi.fn());
const useListOrganizationsMock = vi.hoisted(() => vi.fn());
const setActiveOrganizationMock = vi.hoisted(() => vi.fn());
const signOutMock = vi.hoisted(() => vi.fn());
const sessionRefetchMock = vi.hoisted(() => vi.fn());
const organizationsRefetchMock = vi.hoisted(() => vi.fn());
const projectListQueryFn = vi.hoisted(() => vi.fn());

const PROJECT_LIST_QUERY_KEY = ["get", "/api/projects"] as const;
const SETTINGS_PROJECTS_LIST_QUERY_KEY = ["get", "/api/settings-projects"] as const;

vi.mock("@repo/core/auth", () => ({
  AuthGuard: ({ children }: { children: ReactNode }) => <>{children}</>,
  authenticatedAtom: Symbol("authenticatedAtom"),
}));

vi.mock("@repo/ui/shadcn/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    disabled,
    onClick,
  }: {
    children: ReactNode;
    disabled?: boolean;
    onClick?: () => void;
  }) => (
    <button disabled={disabled} type="button" onClick={onClick}>
      {children}
    </button>
  ),
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => (
    <button type="button">{children}</button>
  ),
}));

vi.mock("@tanstack/react-router", () => ({
  Outlet: () => <main data-testid="dashboard-outlet" />,
  useMatchRoute: () => matchRouteMock,
  useNavigate: () => navigateMock,
}));

vi.mock("jotai", async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import("jotai");
  return {
    ...actual,
    useAtomValue: (atomValue: unknown) => {
      if (typeof atomValue === "symbol") return true;
      throw new Error(`Unexpected useAtomValue atom in DashboardLayout test: ${String(atomValue)}`);
    },
  };
});

vi.mock("../lib/auth-client", () => ({
  authClient: {
    signOut: signOutMock,
    useSession: useSessionMock,
    useListOrganizations: useListOrganizationsMock,
    organization: {
      setActive: setActiveOrganizationMock,
    },
  },
}));

vi.mock("@/lib/api", () => ({
  apiClient: {
    GET: (path: string) => {
      if (path === "/api/projects") return projectListQueryFn();
      return Promise.resolve({ data: undefined, error: undefined });
    },
  },
}));

vi.mock("@/pages/auth/use-require-active-workspace", () => ({
  useRequireActiveWorkspace: () => ({
    activeWorkspaceId: "org-a",
    isCheckingWorkspace: false,
    needsWorkspace: false,
  }),
}));

describe("DashboardLayout workspace switcher", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    useSessionMock.mockReset();
    useListOrganizationsMock.mockReset();
    setActiveOrganizationMock.mockReset();
    signOutMock.mockReset();
    sessionRefetchMock.mockReset();
    organizationsRefetchMock.mockReset();
    projectListQueryFn.mockReset();
    matchRouteMock.mockReset();
    matchRouteMock.mockReturnValue(false);
    useSessionMock.mockReturnValue({
      data: {
        user: { id: "u1", email: "writer@studio.com" },
        session: { activeOrganizationId: "org-a" },
      },
      isPending: false,
      refetch: sessionRefetchMock,
    });
    useListOrganizationsMock.mockReturnValue({
      data: [
        { id: "org-a", name: "Aethys Studio" },
        { id: "org-b", name: "Bright Lab" },
      ],
      isPending: false,
      refetch: organizationsRefetchMock,
    });
    projectListQueryFn.mockResolvedValue([]);
  });

  it("sets the clicked workspace active and refreshes session before loading projects", async () => {
    const calls: string[] = [];
    setActiveOrganizationMock.mockImplementation(() => {
      calls.push("setActive");
      return Promise.resolve({ data: { id: "org-b" }, error: null });
    });
    sessionRefetchMock.mockImplementation(() => {
      calls.push("sessionRefetch");
      return Promise.resolve({ data: null });
    });
    organizationsRefetchMock.mockImplementation(() => {
      calls.push("organizationsRefetch");
      return Promise.resolve({ data: [] });
    });
    projectListQueryFn.mockImplementation(() => {
      calls.push("projectPrefetch");
      return Promise.resolve([]);
    });

    const queryClient = new QueryClient();
    queryClient.setQueryData(
      [...PROJECT_LIST_QUERY_KEY, { activeWorkspaceId: "org-a" }],
      [{ id: "old-project" }],
    );
    queryClient.setQueryData(SETTINGS_PROJECTS_LIST_QUERY_KEY, [{ id: "old-settings-project" }]);
    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");
    invalidateQueriesSpy.mockImplementation((filters) => {
      calls.push(`invalidate:${JSON.stringify(filters?.queryKey)}`);
      return Promise.resolve();
    });

    render(
      <QueryClientProvider client={queryClient}>
        <JotaiProvider store={createStore()}>
          <DashboardLayout />
        </JotaiProvider>
      </QueryClientProvider>,
    );

    await userEvent.click(screen.getByRole("button", { name: /Bright Lab/ }));

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({ to: "/" });
    });

    expect(setActiveOrganizationMock).toHaveBeenCalledWith({ organizationId: "org-b" });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: [...PROJECT_LIST_QUERY_KEY, { activeWorkspaceId: "org-b" }],
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: SETTINGS_PROJECTS_LIST_QUERY_KEY });
    expect(calls).toEqual([
      "setActive",
      "sessionRefetch",
      "organizationsRefetch",
      'invalidate:["get","/api/projects",{"activeWorkspaceId":"org-b"}]',
      'invalidate:["get","/api/settings-projects"]',
      "projectPrefetch",
    ]);
  });

  it("updates the visible workspace immediately while the session mutation is pending", async () => {
    let resolveSetActive: (value: { data: { id: string }; error: null }) => void = () => undefined;
    setActiveOrganizationMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSetActive = resolve;
        }),
    );
    sessionRefetchMock.mockResolvedValue({ data: null });
    organizationsRefetchMock.mockResolvedValue({ data: [] });

    const queryClient = new QueryClient();
    queryClient.setQueryData(
      [...PROJECT_LIST_QUERY_KEY, { activeWorkspaceId: "org-a" }],
      [{ id: "old-project" }],
    );

    render(
      <QueryClientProvider client={queryClient}>
        <JotaiProvider store={createStore()}>
          <DashboardLayout />
        </JotaiProvider>
      </QueryClientProvider>,
    );

    await userEvent.click(screen.getByRole("button", { name: /Bright Lab/ }));

    await waitFor(() => {
      expect(screen.getByText("writer@studio.com").closest("button")).toHaveTextContent(
        "Bright Lab",
      );
    });
    expect(sessionRefetchMock).not.toHaveBeenCalled();

    resolveSetActive({ data: { id: "org-b" }, error: null });
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({ to: "/" });
    });
  });
});
