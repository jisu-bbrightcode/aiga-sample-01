/**
 * Project Mutation Hooks — Optimistic Update
 */

import type { components } from "@repo/api-client";
import { ANALYTICS_EVENTS, captureEvent, setProjectGroup } from "@repo/core/analytics/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import {
  getSettingsProjectByIdQueryKey,
  SETTINGS_PROJECTS_LIST_QUERY_KEY,
} from "@/pages/settings/api";
import { getWorkspaceProjectListQueryKey, PROJECT_LIST_QUERY_KEY } from "./use-project-queries";

type UpdateProjectInput = components["schemas"]["UpdateProjectDto"];
// aiMode has a server-side default ("ai_safety") so callers may omit it.
type CreateProjectInput = Omit<components["schemas"]["CreateProjectDto"], "aiMode"> & {
  aiMode?: components["schemas"]["CreateProjectDto"]["aiMode"];
};

type CachedProjectList = Array<{ id: string }> | undefined;

function removeProjectFromList(id: string) {
  return (old: CachedProjectList): CachedProjectList =>
    Array.isArray(old) ? old.filter((project) => project.id !== id) : old;
}

function restoreQueries(
  qc: ReturnType<typeof useQueryClient>,
  entries: Array<readonly [readonly unknown[], CachedProjectList]>,
) {
  for (const [queryKey, data] of entries) {
    qc.setQueryData(queryKey, data);
  }
}

export function useCreateProject(activeWorkspaceId?: string | null) {
  const qc = useQueryClient();
  const projectListKey = getWorkspaceProjectListQueryKey(PROJECT_LIST_QUERY_KEY, activeWorkspaceId);

  return useMutation({
    mutationKey: ["post", "/api/projects"],
    mutationFn: async (input: CreateProjectInput) => {
      const { data, error } = await apiClient.POST("/api/projects", {
        // aiMode is optional client-side (server default: "ai_safety")
        body: input as components["schemas"]["CreateProjectDto"],
      });
      if (error) throw error;
      return data!;
    },
    onMutate: async (input) => {
      const key = projectListKey;
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData(key);
      const optimistic = {
        id: `temp-${Date.now()}`,
        name: input.name ?? "",
        description: input.description ?? null,
        genre: input.genre ?? null,
        aiMode: input.aiMode ?? "ai_powered",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastOpenedAt: new Date().toISOString(),
      };
      qc.setQueryData(key, (old: any[] | undefined) => [...(old ?? []), optimistic]);
      return { prev, key };
    },
    onError: (_err, _input, ctx: any) => {
      if (ctx?.prev) qc.setQueryData(ctx.key, ctx.prev);
    },
    onSuccess: (data, input) => {
      const projectId = data?.id;
      captureEvent(ANALYTICS_EVENTS.PROJECT_CREATED, {
        source: activeWorkspaceId ? "list" : "onboarding",
        workspace_id: activeWorkspaceId ?? undefined,
        ai_mode: input.aiMode,
      });
      if (projectId) setProjectGroup(projectId, { ai_mode: input.aiMode });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: PROJECT_LIST_QUERY_KEY });
    },
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();

  // Keeps existing call-site shape: mutate({ id, data: {...} })
  return useMutation({
    mutationKey: ["put", "/api/projects/{id}"],
    mutationFn: async (input: { id: string; data: UpdateProjectInput }) => {
      const { data, error } = await apiClient.PUT("/api/projects/{id}", {
        params: { path: { id: input.id } },
        body: input.data,
      });
      if (error) throw error;
      return data!;
    },
    onMutate: async (input) => {
      const key = PROJECT_LIST_QUERY_KEY;
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData(key);
      qc.setQueryData(key, (old: any[] | undefined) =>
        (old ?? []).map((p: any) =>
          p.id === input.id ? { ...p, ...input.data, updatedAt: new Date().toISOString() } : p,
        ),
      );
      return { prev, key };
    },
    onError: (_err, _input, ctx: any) => {
      if (ctx?.prev) qc.setQueryData(ctx.key, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: PROJECT_LIST_QUERY_KEY });
    },
  });
}

function useProjectRemovalMutation(
  opts: {
    mutationKey?: readonly unknown[];
    mutationFn?: (id: string) => Promise<unknown>;
  },
  activeWorkspaceId?: string | null,
) {
  const qc = useQueryClient();
  const projectListBaseKey = PROJECT_LIST_QUERY_KEY;
  const projectListKey = getWorkspaceProjectListQueryKey(projectListBaseKey, activeWorkspaceId);
  const settingsProjectListKey = SETTINGS_PROJECTS_LIST_QUERY_KEY;

  return useMutation({
    mutationKey: opts.mutationKey,
    mutationFn: async (id: string) => {
      if (!opts.mutationFn) throw new Error("Project removal mutation is not configured");
      return opts.mutationFn(id);
    },
    onMutate: async (id) => {
      await Promise.all([
        qc.cancelQueries({ queryKey: projectListBaseKey }),
        qc.cancelQueries({ queryKey: settingsProjectListKey }),
      ]);
      const previousProjectLists = qc.getQueriesData<CachedProjectList>({
        queryKey: projectListBaseKey,
      });
      const previousSettingsProjectLists = qc.getQueriesData<CachedProjectList>({
        queryKey: settingsProjectListKey,
      });
      qc.setQueriesData<CachedProjectList>(
        { queryKey: projectListBaseKey },
        removeProjectFromList(id),
      );
      qc.setQueriesData<CachedProjectList>(
        { queryKey: settingsProjectListKey },
        removeProjectFromList(id),
      );
      qc.setQueryData(projectListKey, removeProjectFromList(id));
      return { previousProjectLists, previousSettingsProjectLists };
    },
    onError: (_err, _id, ctx) => {
      if (!ctx) return;
      restoreQueries(qc, ctx.previousProjectLists);
      restoreQueries(qc, ctx.previousSettingsProjectLists);
    },
    onSuccess: (_data, id) => {
      // getById queryKey is now ["get", "/api/projects/{id}", { params: { path: { id } } }]
      qc.removeQueries({
        queryKey: ["get", "/api/projects/{id}", { params: { path: { id } } }],
      });
      qc.removeQueries({
        queryKey: getSettingsProjectByIdQueryKey(id),
      });
    },
    onSettled: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: projectListBaseKey }),
        qc.invalidateQueries({ queryKey: settingsProjectListKey }),
      ]);
    },
  });
}

// TODO(rest-migration): archive reuses DELETE /projects/{id} — service.delete() delegates to archive() internally
export function useArchiveProject(activeWorkspaceId?: string | null) {
  return useProjectRemovalMutation(
    {
      mutationKey: ["delete", "/api/projects/{id}"],
      mutationFn: async (id: string) => {
        const { data, error } = await apiClient.DELETE("/api/projects/{id}", {
          params: { path: { id } },
        });
        if (error) throw error;
        return data!;
      },
    },
    activeWorkspaceId,
  );
}

export function usePermanentlyDeleteProject(activeWorkspaceId?: string | null) {
  return useProjectRemovalMutation(
    {
      mutationKey: ["delete", "/api/projects/{id}/permanently"],
      mutationFn: async (id: string) => {
        const { data, error } = await apiClient.DELETE("/api/projects/{id}/permanently", {
          params: { path: { id } },
        });
        if (error) throw error;
        return data!;
      },
    },
    activeWorkspaceId,
  );
}

export const useDeleteProject = useArchiveProject;

export function useUpdateLastOpened(activeWorkspaceId?: string | null) {
  const qc = useQueryClient();
  const projectListKey = getWorkspaceProjectListQueryKey(PROJECT_LIST_QUERY_KEY, activeWorkspaceId);

  // Call site shape: mutate(id: string) — adapter keeps existing interface intact
  return useMutation({
    mutationKey: ["patch", "/api/projects/{id}/last-opened"],
    mutationFn: async (id: string) => {
      const { data, error } = await apiClient.PATCH("/api/projects/{id}/last-opened", {
        params: { path: { id } },
      });
      if (error) throw error;
      return data!;
    },
    onMutate: async (id) => {
      const key = projectListKey;
      const prev = qc.getQueryData(key);
      qc.setQueryData(key, (old: any[] | undefined) =>
        (old ?? []).map((p: any) =>
          p.id === id ? { ...p, lastOpenedAt: new Date().toISOString() } : p,
        ),
      );
      return { prev, key };
    },
    onError: (_err, _id, ctx: any) => {
      if (ctx?.prev) qc.setQueryData(ctx.key, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: PROJECT_LIST_QUERY_KEY });
    },
  });
}

/**
 * Upload a cover image (base64 data URL) to Vercel Blob via the server
 * and persist the resulting public URL on the project. Use this for
 * direct uploads. For pattern selection, use `useUpdateProject` with
 * `data: { coverImage: '/patterns/...' }`.
 */
export function useUploadProjectCover() {
  const qc = useQueryClient();

  return useMutation({
    mutationKey: ["post", "/api/projects/{id}/cover"],
    mutationFn: async (input: { id: string; dataUrl: string }) => {
      const { data, error } = await apiClient.POST("/api/projects/{id}/cover", {
        params: { path: { id: input.id } },
        body: { dataUrl: input.dataUrl },
      });
      if (error) throw error;
      return data!;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: PROJECT_LIST_QUERY_KEY });
    },
  });
}
