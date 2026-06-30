/**
 * Domain admin list — view-model types.
 *
 * These DTOs are intentionally decoupled from the Drizzle row types: the admin
 * list only needs the admin-projected fields (it never exposes sensitive
 * columns such as licenseNumber/internalNotes). The shape matches the REST
 * contract documented in `doc/contracts/PB-ADMIN-DOMAIN-LIST-001.md`.
 */

/** Which core catalog resource a row represents. */
export type DomainResourceType = "doctor" | "hospital";

/**
 * Editorial lifecycle (mirrors `servicePublishStatusEnum`). Only `published`
 * rows are visible on public surfaces; `draft`/`archived` are admin-only.
 */
export type DomainResourceStatus = "draft" | "published" | "archived";

/** Sortable columns the admin console exposes. */
export type DomainResourceSortField = "name" | "status" | "updatedAt";

export type SortOrder = "asc" | "desc";

/** One row in the admin domain resource list. */
export interface DomainResource {
  id: string;
  type: DomainResourceType;
  name: string;
  slug: string;
  status: DomainResourceStatus;
  /** Denormalized region label for browse/filter (nullable). */
  regionName: string | null;
  /** Primary specialty label — doctors only (null for hospitals). */
  specialtyName: string | null;
  /** 명의 badge / featured hospital flag. */
  isFeatured: boolean;
  /** ISO timestamp of the last edit (operational "recent change" signal). */
  updatedAt: string;
  /** ISO timestamp of creation. */
  createdAt: string;
}

/** Query parameters accepted by the admin list endpoint. */
export interface DomainResourceFilters {
  page?: number;
  limit?: number;
  type?: DomainResourceType;
  status?: DomainResourceStatus;
  search?: string;
  sort?: DomainResourceSortField;
  order?: SortOrder;
}

/** Paginated list envelope. */
export interface DomainResourceListResult {
  items: DomainResource[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const DOMAIN_TYPE_LABELS: Record<DomainResourceType, string> = {
  doctor: "의사",
  hospital: "병원",
};

export const DOMAIN_STATUS_LABELS: Record<DomainResourceStatus, string> = {
  draft: "초안",
  published: "공개",
  archived: "보관됨",
};

/** Badge variant per lifecycle status (public vs admin-only visibility cue). */
export const DOMAIN_STATUS_BADGE_VARIANT: Record<
  DomainResourceStatus,
  "success" | "secondary" | "outline"
> = {
  published: "success",
  draft: "secondary",
  archived: "outline",
};
