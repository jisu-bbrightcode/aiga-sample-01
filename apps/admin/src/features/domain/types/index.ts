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
  updatedAt: string | null;
  /** ISO timestamp of creation. */
  createdAt: string | null;
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

// ---------------------------------------------------------------------------
// Detail view models (PB-ADMIN-DOMAIN-READ-001 / BBR-679)
//
// The admin detail screen shows the full operational state of a record plus the
// related entities it links to. Sensitive identifiers arrive masked-only.
// ---------------------------------------------------------------------------

export interface DomainRegionRef {
  id: string;
  name: string;
  slug: string;
}

export interface DomainSpecialtyRef {
  id: string;
  name: string;
  slug: string;
}

/** A linked catalog resource the admin can navigate to from the detail page. */
export interface DomainResourceRef {
  id: string;
  name: string;
  slug: string;
  status: DomainResourceStatus;
}

/** A doctor's hospital affiliation (or a hospital's affiliated doctor). */
export interface DomainAffiliationRef extends DomainResourceRef {
  role: string | null;
  isPrimary: boolean;
}

export interface DomainCredentialView {
  id: string;
  kind: string;
  title: string;
  organization: string | null;
  displayPeriod: string | null;
  startYear: number | null;
  endYear: number | null;
  isVisible: boolean;
  sortOrder: number;
}

export interface DomainHoursView {
  id: string;
  dayOfWeek: number;
  opensAt: string | null;
  closesAt: string | null;
  isClosed: boolean;
  note: string | null;
}

/** Admin-only operational/audit metadata (운영 필드). */
export interface DomainResourceOps {
  createdAt: string | null;
  updatedAt: string | null;
  publishedAt: string | null;
  isDeleted: boolean;
  deletedAt: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  sourceUrl: string | null;
  internalNotes: string | null;
}

interface DomainResourceDetailBase {
  id: string;
  name: string;
  slug: string;
  status: DomainResourceStatus;
  isFeatured: boolean;
  photoUrl: string | null;
  ratingAvg: number;
  reviewCount: number;
  region: DomainRegionRef | null;
  ops: DomainResourceOps;
}

export interface DomainDoctorDetail extends DomainResourceDetailBase {
  type: "doctor";
  title: string | null;
  yearsExperience: number | null;
  featuredRank: number | null;
  shortBio: string | null;
  biography: string | null;
  primarySpecialty: DomainSpecialtyRef | null;
  specialties: DomainSpecialtyRef[];
  hospitals: DomainAffiliationRef[];
  credentials: DomainCredentialView[];
  licenseVerifiedAt: string | null;
  /** Sensitive identifier — masked, never raw. */
  sensitive: { licenseNumber: string | null };
}

export interface DomainHospitalDetail extends DomainResourceDetailBase {
  type: "hospital";
  summary: string | null;
  description: string | null;
  addressLine: string | null;
  phone: string | null;
  websiteUrl: string | null;
  specialties: DomainSpecialtyRef[];
  doctors: DomainResourceRef[];
  hours: DomainHoursView[];
  /** Sensitive identifier — masked, never raw. */
  sensitive: { businessRegistrationNo: string | null };
}

export type DomainResourceDetail = DomainDoctorDetail | DomainHospitalDetail;

/** Korean labels for the doctor credential kinds (FR-005 owned enum). */
export const DOMAIN_CREDENTIAL_KIND_LABELS: Record<string, string> = {
  education: "학력",
  career: "경력",
  certification: "자격/면허",
  award: "수상",
};

/** Short Korean day-of-week labels (0 = Sunday), for hospital hours. */
export const DOMAIN_DAY_OF_WEEK_LABELS = ["일", "월", "화", "수", "목", "금", "토"] as const;
