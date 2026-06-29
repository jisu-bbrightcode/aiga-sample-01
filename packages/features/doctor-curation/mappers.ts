/**
 * 명의 큐레이션 response mappers — pure projection functions (FR-004 / BBR-538).
 *
 * PB-FEAT-004 defines a strict public/admin field boundary on the collection
 * table (see collections.ts header). These mappers are the single place that
 * boundary is enforced for the REST layer: the public projection is an explicit
 * allow-list and NEVER carries the admin-only columns (status, internalNotes,
 * sourceUrl, editor ids, publishedAt, soft-delete bookkeeping).
 *
 * Each function builds a brand-new object field-by-field rather than deleting
 * keys off the row, so a future column added to the schema is excluded from
 * public output by default (fail-closed).
 */
import type { ServiceDoctorCollection, ServiceDoctorCollectionItem } from "@repo/drizzle/schema";

const iso = (value: Date | string | null | undefined): string | null => {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString() : value;
};

export interface PublicCollection {
  id: string;
  name: string;
  slug: string;
  subtitle: string | null;
  description: string | null;
  heroImageUrl: string | null;
  kind: ServiceDoctorCollection["kind"];
  specialtyId: string | null;
  regionId: string | null;
  isFeatured: boolean;
  sortOrder: number;
  createdAt: string | null;
  updatedAt: string | null;
}

/** Public projection — fail-closed allow-list, no admin-only columns. */
export function toPublicCollection(row: ServiceDoctorCollection): PublicCollection {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    subtitle: row.subtitle,
    description: row.description,
    heroImageUrl: row.heroImageUrl,
    kind: row.kind,
    specialtyId: row.specialtyId,
    regionId: row.regionId,
    isFeatured: row.isFeatured,
    sortOrder: row.sortOrder,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

/** Admin view: the full row, with timestamps normalized to ISO strings. */
export function toAdminCollection(row: ServiceDoctorCollection) {
  return {
    ...row,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    deletedAt: iso(row.deletedAt),
    publishedAt: iso(row.publishedAt),
  };
}

export interface CollectionItemView {
  doctorId: string;
  rank: number;
  note: string | null;
  createdAt: string | null;
}

export function toCollectionItem(row: ServiceDoctorCollectionItem): CollectionItemView {
  return {
    doctorId: row.doctorId,
    rank: row.rank,
    note: row.note,
    createdAt: iso(row.createdAt),
  };
}

/** Admin collection detail = the full collection plus its ordered 수록 의사. */
export function toAdminCollectionDetail(
  row: ServiceDoctorCollection,
  items: ServiceDoctorCollectionItem[],
) {
  return {
    ...toAdminCollection(row),
    items: items.map(toCollectionItem),
  };
}
