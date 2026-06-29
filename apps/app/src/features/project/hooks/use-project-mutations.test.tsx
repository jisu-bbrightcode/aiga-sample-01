import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const archiveApiMock = vi.hoisted(() => vi.fn());
const permanentlyDeleteApiMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api", () => ({
  apiClient: {
    DELETE: (path: string, _opts: unknown) => {
      if (path === "/api/projects/{id}") return archiveApiMock(path, _opts);
      if (path === "/api/projects/{id}/permanently") return permanentlyDeleteApiMock(path, _opts);
      return Promise.resolve({ data: undefined, error: undefined });
    },
    POST: () => Promise.resolve({ data: undefined, error: undefined }),
    PUT: () => Promise.resolve({ data: undefined, error: undefined }),
    PATCH: () => Promise.resolve({ data: undefined, error: undefined }),
    GET: () => Promise.resolve({ data: undefined, error: undefined }),
  },
}));

import { useArchiveProject, usePermanentlyDeleteProject } from "./use-project-mutations";

// REST query key for project list (mirrors PROJECT_LIST_QUERY_KEY)
const PROJECT_LIST_BASE_KEY = ["get", "/api/projects"] as const;
const SETTINGS_PROJECTS_LIST_KEY = ["get", "/api/settings-projects"] as const;

function settingsProjectByIdKey(projectId: string) {
  return ["get", "/api/settings-projects/{projectId}", { params: { path: { projectId } } }] as const;
}

function makeWrapper(queryClient: QueryClient) {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return Wrapper;
}

describe("project removal mutations", () => {
  beforeEach(() => {
    archiveApiMock.mockReset();
    archiveApiMock.mockResolvedValue({ data: { success: true }, error: undefined });
    permanentlyDeleteApiMock.mockReset();
    permanentlyDeleteApiMock.mockResolvedValue({ data: { success: true }, error: undefined });
  });

  it("removes archived projects from home and active settings list caches", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
    });
    queryClient.setQueryData(
      [...PROJECT_LIST_BASE_KEY, { activeWorkspaceId: "org-a" }],
      [
        { id: "p1", name: "Delete me" },
        { id: "p2", name: "Keep me" },
      ],
    );
    queryClient.setQueryData(
      [...SETTINGS_PROJECTS_LIST_KEY, { filter: "active" }],
      [
        { id: "p1", name: "Delete me" },
        { id: "p2", name: "Keep me" },
      ],
    );
    queryClient.setQueryData(settingsProjectByIdKey("p1"), {
      id: "p1",
      name: "Delete me",
    });

    const { result } = renderHook(() => useArchiveProject("org-a"), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync("p1");
    });

    // Verify DELETE was called with correct path param
    expect(archiveApiMock).toHaveBeenCalledWith(
      "/api/projects/{id}",
      expect.objectContaining({ params: { path: { id: "p1" } } }),
    );
    expect(queryClient.getQueryData([...PROJECT_LIST_BASE_KEY, { activeWorkspaceId: "org-a" }])).toEqual([
      { id: "p2", name: "Keep me" },
    ]);
    expect(queryClient.getQueryData([...SETTINGS_PROJECTS_LIST_KEY, { filter: "active" }])).toEqual([
      { id: "p2", name: "Keep me" },
    ]);
    expect(
      queryClient.getQueryData(settingsProjectByIdKey("p1")),
    ).toBeUndefined();
  });

  it("removes permanently deleted projects from all visible project caches", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
    });
    queryClient.setQueryData(
      [...SETTINGS_PROJECTS_LIST_KEY, { filter: "archived" }],
      [
        { id: "p1", name: "Delete forever" },
        { id: "p2", name: "Keep me" },
      ],
    );
    queryClient.setQueryData(settingsProjectByIdKey("p1"), {
      id: "p1",
      name: "Delete forever",
    });

    const { result } = renderHook(() => usePermanentlyDeleteProject("org-a"), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync("p1");
    });

    // Verify DELETE /permanently was called with correct path param
    expect(permanentlyDeleteApiMock).toHaveBeenCalledWith(
      "/api/projects/{id}/permanently",
      expect.objectContaining({ params: { path: { id: "p1" } } }),
    );
    expect(queryClient.getQueryData([...SETTINGS_PROJECTS_LIST_KEY, { filter: "archived" }])).toEqual([
      { id: "p2", name: "Keep me" },
    ]);
    expect(
      queryClient.getQueryData(settingsProjectByIdKey("p1")),
    ).toBeUndefined();
  });
});
