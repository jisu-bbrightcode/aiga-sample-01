/**
 * Localization Mutation Hooks — Optimistic Update
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import type { components } from "@repo/api-client";
import {
  getGlossaryListQueryKey,
  getLanguageListQueryKey,
  getTranslationListQueryKey,
  getTranslationProgressQueryKey,
} from "./use-localization-queries";

type CreateLanguageInput = components["schemas"]["CreateLanguageDto"];
type UpdateLanguageInput = components["schemas"]["UpdateLanguageDto"];
type UpdateTranslationInput = components["schemas"]["UpdateTranslationDto"];
type BulkUpdateTranslationInput = components["schemas"]["BulkUpdateTranslationDto"];
type CreateGlossaryInput = components["schemas"]["CreateGlossaryDto"];
type UpdateGlossaryInput = components["schemas"]["UpdateGlossaryDto"];

/* Language Mutations */

export function useCreateLanguage(projectId: string) {
  const qc = useQueryClient();
  const key = getLanguageListQueryKey(projectId);

  return useMutation({
    mutationKey: ["post", "/api/localization/projects/{projectId}/languages"],
    mutationFn: async (input: CreateLanguageInput) => {
      const { data, error } = await apiClient.POST(
        "/api/localization/projects/{projectId}/languages",
        {
          params: { path: { projectId } },
          body: input,
        },
      );
      if (error) throw error;
      return data!;
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData(key);
      const optimistic = { id: `temp-${Date.now()}`, ...input, projectId };
      qc.setQueryData(key, (old: unknown) => [...((old as unknown[]) ?? []), optimistic]);
      return { prev, key };
    },
    onError: (_err, _input, ctx: any) => {
      if (ctx?.prev) qc.setQueryData(ctx.key, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
    },
  });
}

export function useUpdateLanguage(projectId: string) {
  const qc = useQueryClient();
  const key = getLanguageListQueryKey(projectId);

  return useMutation({
    mutationKey: ["put", "/api/localization/languages/{id}"],
    mutationFn: async (input: { id: string; data: UpdateLanguageInput }) => {
      const { data, error } = await apiClient.PUT("/api/localization/languages/{id}", {
        params: { path: { id: input.id } },
        body: input.data,
      });
      if (error) throw error;
      return data!;
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData(key);
      qc.setQueryData(key, (old: unknown) =>
        ((old as unknown[]) ?? []).map((l: any) =>
          l.id === input.id ? { ...l, ...input.data } : l,
        ),
      );
      return { prev, key };
    },
    onError: (_err, _input, ctx: any) => {
      if (ctx?.prev) qc.setQueryData(ctx.key, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
    },
  });
}

/* Translation Mutations */

export function useUpdateTranslation(projectId: string, languageId: string) {
  const qc = useQueryClient();
  const listKey = getTranslationListQueryKey(projectId, languageId);

  return useMutation({
    mutationKey: ["put", "/api/localization/translations/{id}"],
    mutationFn: async (input: { id: string; data: UpdateTranslationInput }) => {
      const { data, error } = await apiClient.PUT("/api/localization/translations/{id}", {
        params: { path: { id: input.id } },
        body: input.data,
      });
      if (error) throw error;
      return data!;
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: listKey });
      const prev = qc.getQueryData(listKey);
      qc.setQueryData(listKey, (old: unknown) =>
        ((old as unknown[]) ?? []).map((t: any) =>
          t.id === input.id ? { ...t, ...input.data } : t,
        ),
      );
      return { prev, key: listKey };
    },
    onError: (_err, _input, ctx: any) => {
      if (ctx?.prev) qc.setQueryData(ctx.key, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: listKey });
      qc.invalidateQueries({ queryKey: getTranslationProgressQueryKey(projectId, languageId) });
    },
  });
}

export function useBulkUpdateTranslations(projectId: string, languageId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationKey: ["post", "/api/localization/translations/bulk-update"],
    mutationFn: async (input: BulkUpdateTranslationInput) => {
      const { data, error } = await apiClient.POST("/api/localization/translations/bulk-update", {
        body: input,
      });
      if (error) throw error;
      return data!;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: getTranslationListQueryKey(projectId, languageId) });
      qc.invalidateQueries({ queryKey: getTranslationProgressQueryKey(projectId, languageId) });
    },
  });
}

/* Glossary Mutations */

export function useCreateGlossaryEntry(projectId: string) {
  const qc = useQueryClient();
  const key = getGlossaryListQueryKey(projectId);

  return useMutation({
    mutationKey: ["post", "/api/localization/projects/{projectId}/glossary"],
    mutationFn: async (input: CreateGlossaryInput) => {
      const { data, error } = await apiClient.POST(
        "/api/localization/projects/{projectId}/glossary",
        {
          params: { path: { projectId } },
          body: input,
        },
      );
      if (error) throw error;
      return data!;
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData(key);
      const optimistic = { id: `temp-${Date.now()}`, ...input, projectId };
      qc.setQueryData(key, (old: unknown) => [...((old as unknown[]) ?? []), optimistic]);
      return { prev, key };
    },
    onError: (_err, _input, ctx: any) => {
      if (ctx?.prev) qc.setQueryData(ctx.key, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
    },
  });
}

export function useUpdateGlossaryEntry(projectId: string) {
  const qc = useQueryClient();
  const key = getGlossaryListQueryKey(projectId);

  return useMutation({
    mutationKey: ["put", "/api/localization/glossary/{id}"],
    mutationFn: async (input: { id: string; data: UpdateGlossaryInput }) => {
      const { data, error } = await apiClient.PUT("/api/localization/glossary/{id}", {
        params: { path: { id: input.id } },
        body: input.data,
      });
      if (error) throw error;
      return data!;
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData(key);
      qc.setQueryData(key, (old: unknown) =>
        ((old as unknown[]) ?? []).map((g: any) =>
          g.id === input.id ? { ...g, ...input.data } : g,
        ),
      );
      return { prev, key };
    },
    onError: (_err, _input, ctx: any) => {
      if (ctx?.prev) qc.setQueryData(ctx.key, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
    },
  });
}

export function useDeleteGlossaryEntry(projectId: string) {
  const qc = useQueryClient();
  const key = getGlossaryListQueryKey(projectId);

  return useMutation({
    mutationKey: ["delete", "/api/localization/glossary/{id}"],
    mutationFn: async (id: string) => {
      const { data, error } = await apiClient.DELETE("/api/localization/glossary/{id}", {
        params: { path: { id } },
      });
      if (error) throw error;
      return data!;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData(key);
      qc.setQueryData(key, (old: unknown) =>
        ((old as unknown[]) ?? []).filter((g: any) => g.id !== id),
      );
      return { prev, key };
    },
    onError: (_err, _id, ctx: any) => {
      if (ctx?.prev) qc.setQueryData(ctx.key, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
    },
  });
}
