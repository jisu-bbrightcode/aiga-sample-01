/**
 * Domain admin list — data access + query keys.
 *
 * The generated OpenAPI client does not yet expose the admin domain endpoint
 * (it lands with the backend task — see the contract doc referenced in
 * `constants.ts`). This thin, schema-validated fetch layer reuses the same
 * base URL + auth headers as the typed `apiClient`, so the UI compiles and
 * runs today and starts returning live data the moment the endpoint ships —
 * no client regeneration required on the frontend side.
 */
import { z } from "zod";
import { API_URL, getAuthHeaders } from "../../lib/api";
import type { DomainResourceFilters, DomainResourceListResult } from "./types";

/** REST contract: admin domain resource list/search. */
export const DOMAIN_ADMIN_RESOURCES_ENDPOINT = "/api/admin/domain/resources";

const domainResourceTypeSchema = z.enum(["doctor", "hospital"]);
const domainResourceStatusSchema = z.enum(["draft", "published", "archived"]);

const domainResourceSchema = z.object({
  id: z.string(),
  type: domainResourceTypeSchema,
  name: z.string(),
  slug: z.string(),
  status: domainResourceStatusSchema,
  regionName: z.string().nullable().default(null),
  specialtyName: z.string().nullable().default(null),
  isFeatured: z.boolean().default(false),
  updatedAt: z.string().nullable().default(null),
  createdAt: z.string().nullable().default(null),
});

const domainResourceListSchema = z.object({
  items: z.array(domainResourceSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number(),
});

function buildQuery(filters: DomainResourceFilters): string {
  const params = new URLSearchParams();
  if (filters.page != null) params.set("page", String(filters.page));
  if (filters.limit != null) params.set("limit", String(filters.limit));
  if (filters.type) params.set("type", filters.type);
  if (filters.status) params.set("status", filters.status);
  if (filters.search) params.set("search", filters.search);
  if (filters.sort) params.set("sort", filters.sort);
  if (filters.order) params.set("order", filters.order);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/**
 * Fetch a page of domain resources for the admin console.
 *
 * @throws Error with a Korean operator-facing message on non-2xx responses.
 */
export async function fetchDomainResources(
  filters: DomainResourceFilters,
  signal?: AbortSignal,
): Promise<DomainResourceListResult> {
  const url = `${API_URL}${DOMAIN_ADMIN_RESOURCES_ENDPOINT}${buildQuery(filters)}`;

  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json", ...getAuthHeaders() },
    credentials: "include",
    signal,
  });

  if (!response.ok) {
    throw new Error(`도메인 리소스 목록을 불러오지 못했습니다 (HTTP ${response.status})`);
  }

  return domainResourceListSchema.parse(await response.json());
}

export const adminDomainQueryKeys = {
  resourcesPrefix: () => ["admin", "domain", "resources"] as const,
  resources: (filters: DomainResourceFilters) =>
    [...adminDomainQueryKeys.resourcesPrefix(), filters] as const,
};
