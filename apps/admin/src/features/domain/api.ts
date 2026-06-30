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
import type {
  DomainResourceDetail,
  DomainResourceFilters,
  DomainResourceListResult,
  DomainResourceType,
} from "./types";

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

// ---------------------------------------------------------------------------
// Detail (read-one) — PB-ADMIN-DOMAIN-READ-001 / BBR-679
// ---------------------------------------------------------------------------

const regionRefSchema = z.object({ id: z.string(), name: z.string(), slug: z.string() }).nullable();
const specialtyRefSchema = z.object({ id: z.string(), name: z.string(), slug: z.string() });
const resourceRefSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  status: domainResourceStatusSchema,
});
const affiliationRefSchema = resourceRefSchema.extend({
  role: z.string().nullable(),
  isPrimary: z.boolean(),
});
const opsSchema = z.object({
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  publishedAt: z.string().nullable(),
  isDeleted: z.boolean(),
  deletedAt: z.string().nullable(),
  createdBy: z.string().nullable(),
  updatedBy: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  internalNotes: z.string().nullable(),
});
const credentialViewSchema = z.object({
  id: z.string(),
  kind: z.string(),
  title: z.string(),
  organization: z.string().nullable(),
  displayPeriod: z.string().nullable(),
  startYear: z.number().nullable(),
  endYear: z.number().nullable(),
  isVisible: z.boolean(),
  sortOrder: z.number(),
});
const hoursViewSchema = z.object({
  id: z.string(),
  dayOfWeek: z.number(),
  opensAt: z.string().nullable(),
  closesAt: z.string().nullable(),
  isClosed: z.boolean(),
  note: z.string().nullable(),
});

const detailBaseShape = {
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  status: domainResourceStatusSchema,
  isFeatured: z.boolean(),
  photoUrl: z.string().nullable(),
  ratingAvg: z.number(),
  reviewCount: z.number(),
  region: regionRefSchema,
  ops: opsSchema,
};

const doctorDetailSchema = z.object({
  ...detailBaseShape,
  type: z.literal("doctor"),
  title: z.string().nullable(),
  yearsExperience: z.number().nullable(),
  featuredRank: z.number().nullable(),
  shortBio: z.string().nullable(),
  biography: z.string().nullable(),
  primarySpecialty: specialtyRefSchema.nullable(),
  specialties: z.array(specialtyRefSchema),
  hospitals: z.array(affiliationRefSchema),
  credentials: z.array(credentialViewSchema),
  licenseVerifiedAt: z.string().nullable(),
  sensitive: z.object({ licenseNumber: z.string().nullable() }),
});

const hospitalDetailSchema = z.object({
  ...detailBaseShape,
  type: z.literal("hospital"),
  summary: z.string().nullable(),
  description: z.string().nullable(),
  addressLine: z.string().nullable(),
  phone: z.string().nullable(),
  websiteUrl: z.string().nullable(),
  specialties: z.array(specialtyRefSchema),
  doctors: z.array(resourceRefSchema),
  hours: z.array(hoursViewSchema),
  sensitive: z.object({ businessRegistrationNo: z.string().nullable() }),
});

const domainResourceDetailSchema = z.discriminatedUnion("type", [
  doctorDetailSchema,
  hospitalDetailSchema,
]);

/**
 * Fetch one domain resource's admin detail.
 *
 * @throws Error with a Korean operator-facing message on non-2xx responses.
 */
export async function fetchDomainResourceDetail(
  type: DomainResourceType,
  id: string,
  signal?: AbortSignal,
): Promise<DomainResourceDetail> {
  const url = `${API_URL}${DOMAIN_ADMIN_RESOURCES_ENDPOINT}/${type}/${id}`;

  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json", ...getAuthHeaders() },
    credentials: "include",
    signal,
  });

  if (!response.ok) {
    throw new Error(`도메인 리소스 상세를 불러오지 못했습니다 (HTTP ${response.status})`);
  }

  return domainResourceDetailSchema.parse(await response.json());
}

export const adminDomainQueryKeys = {
  resourcesPrefix: () => ["admin", "domain", "resources"] as const,
  resources: (filters: DomainResourceFilters) =>
    [...adminDomainQueryKeys.resourcesPrefix(), filters] as const,
  detail: (type: DomainResourceType, id: string) =>
    [...adminDomainQueryKeys.resourcesPrefix(), "detail", type, id] as const,
};
