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
import type { DoctorCreateInput, HospitalCreateInput } from "./forms/create-schemas";
import type {
  DomainResourceDetail,
  DomainResourceFilters,
  DomainResourceListResult,
  DomainResourceStatus,
  DomainResourceType,
  DomainTaxonomyOptions,
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

// ---------------------------------------------------------------------------
// Archive / restore lifecycle — PB-ADMIN-DOMAIN-DELETE-001 / BBR-682
//
// 비활성/archive 는 실제 삭제가 아니라 게시 상태만 내려 공개/앱 노출을 차단하고
// (연결 데이터는 보존), restore 는 비공개 draft 로 되살린다. 모든 전이는 서버에서
// `admin_audit_log` 에 감사 기록된다.
// ---------------------------------------------------------------------------

const domainResourceLifecycleSchema = z.object({
  type: domainResourceTypeSchema,
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  status: domainResourceStatusSchema,
  isDeleted: z.boolean(),
});

export type DomainResourceLifecycleResult = z.infer<typeof domainResourceLifecycleSchema>;

/** archive | restore — the lifecycle transitions the console can trigger. */
export type DomainLifecycleAction = "archive" | "restore";

const LIFECYCLE_ERROR_MESSAGE: Record<DomainLifecycleAction, string> = {
  archive: "리소스를 보관하지 못했습니다",
  restore: "리소스를 복구하지 못했습니다",
};

/**
 * Trigger an archive/restore transition for one domain resource.
 *
 * @throws Error with a Korean operator-facing message on non-2xx responses.
 */
export async function mutateDomainResourceLifecycle(
  action: DomainLifecycleAction,
  type: DomainResourceType,
  id: string,
): Promise<DomainResourceLifecycleResult> {
  const url = `${API_URL}${DOMAIN_ADMIN_RESOURCES_ENDPOINT}/${type}/${id}/${action}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { Accept: "application/json", ...getAuthHeaders() },
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`${LIFECYCLE_ERROR_MESSAGE[action]} (HTTP ${response.status})`);
  }

  return domainResourceLifecycleSchema.parse(await response.json());
}

// ---------------------------------------------------------------------------
// Create (write) — PB-ADMIN-DOMAIN-CREATE-001 / BBR-680
// ---------------------------------------------------------------------------

/** Public taxonomy endpoints — used to populate the create-form selects. */
const SERVICE_SPECIALTIES_ENDPOINT = "/api/service/specialties";
const SERVICE_REGIONS_ENDPOINT = "/api/service/regions";

const taxonomyOptionSchema = z.object({ id: z.string(), name: z.string() });
const taxonomyListSchema = z.array(taxonomyOptionSchema);

/** The created record's id, used to navigate to its detail page. */
const createResultSchema = z.object({ id: z.string() });

/**
 * Map a non-2xx create response to a friendly, operator-facing Korean message.
 * We never echo the raw server body — only a stable, situation-specific string.
 */
function createErrorMessage(status: number): string {
  if (status === 409) {
    return "이미 사용 중인 slug입니다. 다른 slug를 입력해주세요.";
  }
  if (status === 400) {
    return "입력값을 확인해주세요.";
  }
  if (status === 401 || status === 403) {
    return "이 작업을 수행할 권한이 없습니다.";
  }
  return `리소스를 생성하지 못했습니다 (HTTP ${status})`;
}

/** Fetch the 진료과 / 지역 options for the create form selects. */
export async function fetchDomainTaxonomy(signal?: AbortSignal): Promise<DomainTaxonomyOptions> {
  const headers = { Accept: "application/json", ...getAuthHeaders() };
  const [specialtiesRes, regionsRes] = await Promise.all([
    fetch(`${API_URL}${SERVICE_SPECIALTIES_ENDPOINT}`, { headers, signal }),
    fetch(`${API_URL}${SERVICE_REGIONS_ENDPOINT}`, { headers, signal }),
  ]);

  if (!specialtiesRes.ok || !regionsRes.ok) {
    throw new Error("진료과·지역 정보를 불러오지 못했습니다.");
  }

  return {
    specialties: taxonomyListSchema.parse(await specialtiesRes.json()),
    regions: taxonomyListSchema.parse(await regionsRes.json()),
  };
}

async function postCreate(path: string, body: unknown): Promise<{ id: string }> {
  const response = await fetch(`${API_URL}${DOMAIN_ADMIN_RESOURCES_ENDPOINT}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...getAuthHeaders(),
    },
    credentials: "include",
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(createErrorMessage(response.status));
  }

  return createResultSchema.parse(await response.json());
}

/** Create a 의사 catalog record (defaults to draft). */
export function createDomainDoctor(input: DoctorCreateInput): Promise<{ id: string }> {
  return postCreate("doctors", input);
}

/** Create a 병원 catalog record (defaults to draft). */
export function createDomainHospital(input: HospitalCreateInput): Promise<{ id: string }> {
  return postCreate("hospitals", input);
}

// ---------------------------------------------------------------------------
// Update / status change / history — PB-ADMIN-DOMAIN-UPDATE-001 / BBR-681
//
// 수정과 상태 변경은 서버에서 admin_audit_log 에 감사 기록되고, 상태 변경은 허용된
// 전이만 통과한다 (서버가 422 로 거부). 변경 이력은 그 감사 로그를 최신순으로 읽는다.
// ---------------------------------------------------------------------------

/** Edit-form payloads — a partial of the create inputs (all fields optional). */
export type DoctorUpdateInput = Partial<DoctorCreateInput>;
export type HospitalUpdateInput = Partial<HospitalCreateInput>;

const updateResultSchema = z.object({ id: z.string() });

/**
 * Map a non-2xx update/status response to a friendly operator-facing Korean
 * message. We never echo the raw server body.
 */
function mutateErrorMessage(status: number): string {
  if (status === 409) {
    return "이미 사용 중인 slug입니다. 다른 slug를 입력해주세요.";
  }
  if (status === 422) {
    return "허용되지 않은 상태 변경입니다.";
  }
  if (status === 400) {
    return "입력값을 확인해주세요.";
  }
  if (status === 401 || status === 403) {
    return "이 작업을 수행할 권한이 없습니다.";
  }
  if (status === 404) {
    return "리소스를 찾을 수 없습니다.";
  }
  return `요청을 처리하지 못했습니다 (HTTP ${status})`;
}

async function patchUpdate(path: string, body: unknown): Promise<{ id: string }> {
  const response = await fetch(`${API_URL}${DOMAIN_ADMIN_RESOURCES_ENDPOINT}/${path}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...getAuthHeaders(),
    },
    credentials: "include",
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(mutateErrorMessage(response.status));
  }

  return updateResultSchema.parse(await response.json());
}

/** Edit a 의사 catalog record. */
export function updateDomainDoctor(id: string, input: DoctorUpdateInput): Promise<{ id: string }> {
  return patchUpdate(`doctors/${id}`, input);
}

/** Edit a 병원 catalog record. */
export function updateDomainHospital(
  id: string,
  input: HospitalUpdateInput,
): Promise<{ id: string }> {
  return patchUpdate(`hospitals/${id}`, input);
}

/**
 * Change a resource's publish status. The server validates the transition
 * (허용된 전이만) and audits the change; a disallowed move comes back as 422.
 */
export async function changeDomainResourceStatus(
  type: DomainResourceType,
  id: string,
  status: DomainResourceStatus,
): Promise<DomainResourceLifecycleResult> {
  const response = await fetch(
    `${API_URL}${DOMAIN_ADMIN_RESOURCES_ENDPOINT}/${type}/${id}/status`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...getAuthHeaders(),
      },
      credentials: "include",
      body: JSON.stringify({ status }),
    },
  );

  if (!response.ok) {
    throw new Error(mutateErrorMessage(response.status));
  }

  return domainResourceLifecycleSchema.parse(await response.json());
}

const historyEntrySchema = z.object({
  id: z.string(),
  actorUserId: z.string(),
  action: z.string(),
  targetType: z.string().nullable(),
  targetId: z.string().nullable(),
  payloadBefore: z.unknown(),
  payloadAfter: z.unknown(),
  reason: z.string().nullable(),
  createdAt: z.string(),
});

const historyResponseSchema = z.object({
  rows: z.array(historyEntrySchema),
  nextCursor: z.string().nullable(),
});

export type DomainResourceHistoryEntry = z.infer<typeof historyEntrySchema>;
export type DomainResourceHistoryResult = z.infer<typeof historyResponseSchema>;

/** Read a resource's 변경 이력 (audit trail), newest first. */
export async function fetchDomainResourceHistory(
  type: DomainResourceType,
  id: string,
  signal?: AbortSignal,
): Promise<DomainResourceHistoryResult> {
  const url = `${API_URL}${DOMAIN_ADMIN_RESOURCES_ENDPOINT}/${type}/${id}/history`;

  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json", ...getAuthHeaders() },
    credentials: "include",
    signal,
  });

  if (!response.ok) {
    throw new Error(`변경 이력을 불러오지 못했습니다 (HTTP ${response.status})`);
  }

  return historyResponseSchema.parse(await response.json());
}

export const adminDomainQueryKeys = {
  resourcesPrefix: () => ["admin", "domain", "resources"] as const,
  resources: (filters: DomainResourceFilters) =>
    [...adminDomainQueryKeys.resourcesPrefix(), filters] as const,
  detail: (type: DomainResourceType, id: string) =>
    [...adminDomainQueryKeys.resourcesPrefix(), "detail", type, id] as const,
  history: (type: DomainResourceType, id: string) =>
    [...adminDomainQueryKeys.resourcesPrefix(), "history", type, id] as const,
  taxonomy: () => ["admin", "domain", "taxonomy"] as const,
};
