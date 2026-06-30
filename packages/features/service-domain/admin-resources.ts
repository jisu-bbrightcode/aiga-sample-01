/**
 * Admin domain resource list — pure projection & merge logic.
 *
 * PB-ADMIN-DOMAIN-API-001 (BBR-761) exposes a single admin list across the two
 * PB-DATA-001 catalog tables (`service_doctors` + `service_hospitals`) for the
 * admin domain console (BBR-678, contract-first UI already shipped).
 *
 * This module is deliberately side-effect-free so the security-critical parts —
 * the admin-only column allow-list and the cross-table sort/merge — can be unit
 * tested without a database or HTTP layer. The mapper builds a brand-new object
 * field-by-field, so sensitive columns (licenseNumber, internalNotes, sourceUrl,
 * businessRegistrationNo, …) can never leak into the list projection even if a
 * caller passes a fuller row by mistake (fail-closed).
 */
import type { ServicePublishStatus } from "./status";

export const ADMIN_DOMAIN_RESOURCE_TYPES = ["doctor", "hospital"] as const;
export type AdminDomainResourceType = (typeof ADMIN_DOMAIN_RESOURCE_TYPES)[number];

export const ADMIN_DOMAIN_SORT_KEYS = ["name", "status", "updatedAt"] as const;
export type AdminDomainSortKey = (typeof ADMIN_DOMAIN_SORT_KEYS)[number];

export type SortOrder = "asc" | "desc";

/** The admin list item — exactly the columns the domain table renders. */
export interface AdminDomainResource {
  id: string;
  type: AdminDomainResourceType;
  name: string;
  slug: string;
  status: ServicePublishStatus;
  /** Resolved region display name (from the denormalized region id). Nullable. */
  regionName: string | null;
  /** Primary specialty display name — doctors only; always null for hospitals. */
  specialtyName: string | null;
  isFeatured: boolean;
  updatedAt: string | null;
  createdAt: string | null;
}

/** Paginated envelope returned by the admin domain list endpoint. */
export interface AdminDomainResourceListResult {
  items: AdminDomainResource[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * The shape of a single joined row coming back from the per-table query.
 *
 * `specialtyName` is optional because the hospital query never joins specialties.
 */
export interface JoinedResourceRow {
  id: string;
  name: string;
  slug: string;
  status: ServicePublishStatus;
  regionName: string | null;
  specialtyName?: string | null;
  isFeatured: boolean;
  updatedAt: Date | string | null;
  createdAt: Date | string | null;
}

const iso = (value: Date | string | null | undefined): string | null => {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString() : value;
};

/**
 * Map a joined catalog row to the admin list item.
 *
 * Only the contract's columns are copied; sensitive admin columns are never
 * referenced here, so they cannot appear in the output.
 */
export function toAdminDomainResource(
  row: JoinedResourceRow,
  type: AdminDomainResourceType,
): AdminDomainResource {
  return {
    id: row.id,
    type,
    name: row.name,
    slug: row.slug,
    status: row.status,
    regionName: row.regionName ?? null,
    // Hospitals never carry a specialty; force-null keeps the union shape uniform.
    specialtyName: type === "doctor" ? (row.specialtyName ?? null) : null,
    isFeatured: row.isFeatured,
    updatedAt: iso(row.updatedAt),
    createdAt: iso(row.createdAt),
  };
}

/** Stable status ordering for the `status` sort (lifecycle order, not lexical). */
const STATUS_RANK: Record<ServicePublishStatus, number> = {
  draft: 0,
  published: 1,
  archived: 2,
};

/** Three-way comparison for ordered primitives (no nested ternary). */
function cmp(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function compareByKey(
  a: AdminDomainResource,
  b: AdminDomainResource,
  sort: AdminDomainSortKey,
): number {
  switch (sort) {
    case "name":
      return a.name.localeCompare(b.name);
    case "status":
      return STATUS_RANK[a.status] - STATUS_RANK[b.status];
    case "updatedAt":
      // ISO-8601 strings sort lexicographically in chronological order.
      return cmp(a.updatedAt ?? "", b.updatedAt ?? "");
  }
}

/**
 * Build the comparator used for BOTH the SQL `ORDER BY` and the in-app merge of
 * the two tables. They MUST agree: the union page is assembled by concatenating
 * each table's first `page*limit` rows and re-sorting, which only yields the
 * correct global order when the JS comparator mirrors the DB ordering exactly.
 *
 * `id` is the deterministic tiebreaker so equal sort keys never reorder between
 * the DB and the merge (and so pagination is stable).
 */
export function compareResources(
  sort: AdminDomainSortKey,
  order: SortOrder,
): (a: AdminDomainResource, b: AdminDomainResource) => number {
  const dir = order === "asc" ? 1 : -1;
  return (a, b) => {
    const primary = compareByKey(a, b, sort);
    if (primary !== 0) return dir * primary;
    // tiebreaker — always ascending by id, independent of `order`, so the DB
    // (which applies the same secondary asc id) and the merge stay in lockstep.
    return cmp(a.id, b.id);
  };
}

/** Paging + sort options for {@link mergeResourcePage}. */
export interface MergePageOptions {
  sort: AdminDomainSortKey;
  order: SortOrder;
  page: number;
  limit: number;
}

/**
 * Merge the two already-sorted, already-truncated table slices into the single
 * page window the client asked for.
 *
 * Precondition: `doctors` and `hospitals` each contain that table's first
 * `page*limit` rows in `compareResources(sort, order)` order. The first
 * `page*limit` rows of the merged stream are fully determined by those inputs,
 * so re-sorting the concatenation and slicing the window is exact.
 */
export function mergeResourcePage(
  doctors: AdminDomainResource[],
  hospitals: AdminDomainResource[],
  { sort, order, page, limit }: MergePageOptions,
): AdminDomainResource[] {
  const merged = [...doctors, ...hospitals].sort(compareResources(sort, order));
  const start = (page - 1) * limit;
  return merged.slice(start, start + limit);
}

/** totalPages for a page envelope; 0 when there are no rows. */
export function totalPages(total: number, limit: number): number {
  if (total <= 0 || limit <= 0) return 0;
  return Math.ceil(total / limit);
}
