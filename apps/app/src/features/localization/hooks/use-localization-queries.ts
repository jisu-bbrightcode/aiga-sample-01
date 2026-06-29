/**
 * Localization Query Hooks
 */
import { $api } from "@/lib/api";

// ============================================================================
// Query key consts — used for invalidation parity in mutations
// ============================================================================

export const getLanguageListQueryKey = (projectId: string) =>
  ["get", "/api/localization/projects/{projectId}/languages", { params: { path: { projectId } } }] as const;

export const getTranslationListQueryKey = (projectId: string, languageId: string) =>
  [
    "get",
    "/api/localization/projects/{projectId}/languages/{languageId}/translations",
    { params: { path: { projectId, languageId } } },
  ] as const;

export const getTranslationProgressQueryKey = (projectId: string, languageId: string) =>
  [
    "get",
    "/api/localization/projects/{projectId}/languages/{languageId}/progress",
    { params: { path: { projectId, languageId } } },
  ] as const;

export const getGlossaryListQueryKey = (projectId: string) =>
  ["get", "/api/localization/projects/{projectId}/glossary", { params: { path: { projectId } } }] as const;

// ============================================================================
// Language Queries
// ============================================================================

export function useLanguages(projectId: string) {
  return $api.useQuery(
    "get",
    "/api/localization/projects/{projectId}/languages",
    { params: { path: { projectId } } },
    { enabled: !!projectId },
  );
}

export function useLanguage(id: string) {
  return $api.useQuery(
    "get",
    "/api/localization/languages/{id}",
    { params: { path: { id } } },
    { enabled: !!id },
  );
}

// ============================================================================
// Translation Queries
// ============================================================================

interface TranslationFilters {
  entityType?: string;
  status?: string;
}

export function useTranslations(
  projectId: string,
  languageId: string,
  filters?: TranslationFilters,
) {
  const hasFilters = !!(filters?.entityType || filters?.status);
  return $api.useQuery(
    "get",
    "/api/localization/projects/{projectId}/languages/{languageId}/translations",
    {
      params: {
        path: { projectId, languageId },
        ...(hasFilters && {
          query: {
            entityType: filters?.entityType,
            status: filters?.status,
          },
        }),
      },
    },
    { enabled: !!projectId && !!languageId },
  );
}

export function useTranslation(id: string) {
  return $api.useQuery(
    "get",
    "/api/localization/translations/{id}",
    { params: { path: { id } } },
    { enabled: !!id },
  );
}

export function useTranslationProgress(projectId: string, languageId: string) {
  return $api.useQuery(
    "get",
    "/api/localization/projects/{projectId}/languages/{languageId}/progress",
    { params: { path: { projectId, languageId } } },
    { enabled: !!projectId && !!languageId },
  );
}

// ============================================================================
// Glossary Queries
// ============================================================================

export function useGlossary(projectId: string, search?: string) {
  return $api.useQuery(
    "get",
    "/api/localization/projects/{projectId}/glossary",
    {
      params: {
        path: { projectId },
        ...(search !== undefined && { query: { search } }),
      },
    },
    { enabled: !!projectId },
  );
}

export function useGlossaryEntry(id: string) {
  return $api.useQuery(
    "get",
    "/api/localization/glossary/{id}",
    { params: { path: { id } } },
    { enabled: !!id },
  );
}
