/**
 * 통합검색 response mappers — pure projection functions (FR-003 / BBR-531).
 *
 * The search index (`service_search_documents`) carries both public display
 * fields and index/ranking internals. PB-DATA-FR003 fixes the visibility
 * boundary:
 *
 * - public:  entityType, entityId, title, subtitle, slug, photoUrl, regionId,
 *            specialtyId, ratingAvg
 * - admin:   the public set PLUS the internals — body, keywords, weight,
 *            isPublished, sourceUpdatedAt (+ id/createdAt/updatedAt bookkeeping)
 *
 * Like the service-domain mappers, these build a brand-new object field by
 * field (never `delete` off the row) so a future column is excluded from the
 * public projection by default — fail-closed.
 */
import type { ServiceSearchDocument } from "@repo/drizzle/schema";

const iso = (value: Date | string | null | undefined): string | null => {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString() : value;
};

/** Columns selected for the public search list (no index internals). */
export interface PublicSearchHit {
  entityType: ServiceSearchDocument["entityType"];
  entityId: string;
  title: string;
  subtitle: string | null;
  slug: string;
  photoUrl: string | null;
  regionId: string | null;
  specialtyId: string | null;
  ratingAvg: number;
}

/** Subset of the document row the public query actually selects. */
type PublicHitRow = Pick<
  ServiceSearchDocument,
  | "entityType"
  | "entityId"
  | "title"
  | "subtitle"
  | "slug"
  | "photoUrl"
  | "regionId"
  | "specialtyId"
  | "ratingAvg"
>;

export function toPublicSearchHit(row: PublicHitRow): PublicSearchHit {
  return {
    entityType: row.entityType,
    entityId: row.entityId,
    title: row.title,
    subtitle: row.subtitle,
    slug: row.slug,
    photoUrl: row.photoUrl,
    regionId: row.regionId,
    specialtyId: row.specialtyId,
    ratingAvg: row.ratingAvg,
  };
}

/** Admin view: public fields + ranking/index internals, timestamps as ISO. */
export interface AdminSearchHit extends PublicSearchHit {
  id: string;
  body: string | null;
  keywords: string | null;
  weight: number;
  isPublished: boolean;
  sourceUpdatedAt: string | null;
  /** Archive (soft-delete) state — FR-003 delete/archive (BBR-535). */
  isDeleted: boolean;
  deletedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export function toAdminSearchHit(row: ServiceSearchDocument): AdminSearchHit {
  return {
    ...toPublicSearchHit(row),
    id: row.id,
    body: row.body,
    keywords: row.keywords,
    weight: row.weight,
    isPublished: row.isPublished,
    sourceUpdatedAt: iso(row.sourceUpdatedAt),
    isDeleted: row.isDeleted,
    deletedAt: iso(row.deletedAt),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

// ---- archive / restore result (FR-003 delete/archive / BBR-535) ------------

/**
 * The minimal post-archive/restore view returned by the DELETE and restore
 * endpoints. It echoes the resource key plus the new archive state so the
 * client can update its UI (and confirm 노출 차단 / 복구) without a re-fetch.
 */
export interface ArchiveResult {
  entityType: ServiceSearchDocument["entityType"];
  entityId: string;
  isDeleted: boolean;
  deletedAt: string | null;
  updatedAt: string | null;
}

export function toArchiveResult(row: ServiceSearchDocument): ArchiveResult {
  return {
    entityType: row.entityType,
    entityId: row.entityId,
    isDeleted: row.isDeleted,
    deletedAt: iso(row.deletedAt),
    updatedAt: iso(row.updatedAt),
  };
}

// ---- viewer state (FR-003 detail / BBR-532) --------------------------------

/**
 * The requesting viewer's relationship to a detail resource. Built fail-closed:
 * the public detail endpoint NEVER reports `isAdmin`/`canViewUnpublished` true,
 * even if an admin happens to call it — the privileged view lives behind the
 * admin-guarded endpoint. See doc/api/PB-FEAT-FR003-API-READ-search-detail.md.
 */
export interface ViewerState {
  authenticated: boolean;
  isAdmin: boolean;
  canViewUnpublished: boolean;
}

/** Viewer state for the public detail endpoint (published resources only). */
export function publicViewerState(authenticated: boolean): ViewerState {
  return { authenticated, isAdmin: false, canViewUnpublished: false };
}

/** Viewer state for the admin-guarded detail endpoint (owner/admin role). */
export const ADMIN_VIEWER_STATE: ViewerState = {
  authenticated: true,
  isAdmin: true,
  canViewUnpublished: true,
};
