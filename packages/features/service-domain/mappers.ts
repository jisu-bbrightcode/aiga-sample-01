/**
 * Service-domain response mappers — pure projection functions.
 *
 * PB-DATA-001 defines a strict public/admin field boundary on the catalog
 * tables. These mappers are the single place that boundary is enforced for
 * the REST layer: public surfaces get an explicit allow-list of columns and
 * NEVER the sensitive ones (license number, business registration number,
 * internal notes, provenance, editor ids, soft-delete bookkeeping).
 *
 * The functions build a brand-new object field-by-field rather than deleting
 * keys off the row, so a future column added to the schema is excluded from
 * public output by default (fail-closed).
 */
import type {
  ServiceDoctor,
  ServiceHospital,
  ServiceRegion,
  ServiceSpecialty,
} from "@repo/drizzle/schema";

const iso = (value: Date | string | null | undefined): string | null => {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString() : value;
};

// ---------------------------------------------------------------------------
// Taxonomy (regions / specialties) — public read-only reference data.
// ---------------------------------------------------------------------------

export interface PublicSpecialty {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
}

export function toPublicSpecialty(row: ServiceSpecialty): PublicSpecialty {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    sortOrder: row.sortOrder,
  };
}

export interface PublicRegion {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  sortOrder: number;
}

export function toPublicRegion(row: ServiceRegion): PublicRegion {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    parentId: row.parentId,
    sortOrder: row.sortOrder,
  };
}

// ---------------------------------------------------------------------------
// Hospitals
// ---------------------------------------------------------------------------

export interface PublicHospital {
  id: string;
  name: string;
  slug: string;
  summary: string | null;
  description: string | null;
  regionId: string | null;
  addressLine: string | null;
  phone: string | null;
  websiteUrl: string | null;
  photoUrl: string | null;
  ratingAvg: number;
  reviewCount: number;
  isFeatured: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export function toPublicHospital(row: ServiceHospital): PublicHospital {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    summary: row.summary,
    description: row.description,
    regionId: row.regionId,
    addressLine: row.addressLine,
    phone: row.phone,
    websiteUrl: row.websiteUrl,
    photoUrl: row.photoUrl,
    ratingAvg: row.ratingAvg,
    reviewCount: row.reviewCount,
    isFeatured: row.isFeatured,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

/** Admin view: the full row, with timestamps normalized to ISO strings. */
export function toAdminHospital(row: ServiceHospital) {
  return {
    ...row,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    deletedAt: iso(row.deletedAt),
    publishedAt: iso(row.publishedAt),
  };
}

// ---------------------------------------------------------------------------
// Doctors
// ---------------------------------------------------------------------------

export interface PublicDoctor {
  id: string;
  name: string;
  slug: string;
  title: string | null;
  primarySpecialtyId: string | null;
  primaryHospitalId: string | null;
  regionId: string | null;
  shortBio: string | null;
  biography: string | null;
  photoUrl: string | null;
  yearsExperience: number | null;
  ratingAvg: number;
  reviewCount: number;
  isFeatured: boolean;
  featuredRank: number | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export function toPublicDoctor(row: ServiceDoctor): PublicDoctor {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    title: row.title,
    primarySpecialtyId: row.primarySpecialtyId,
    primaryHospitalId: row.primaryHospitalId,
    regionId: row.regionId,
    shortBio: row.shortBio,
    biography: row.biography,
    photoUrl: row.photoUrl,
    yearsExperience: row.yearsExperience,
    ratingAvg: row.ratingAvg,
    reviewCount: row.reviewCount,
    isFeatured: row.isFeatured,
    featuredRank: row.featuredRank,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

/** Admin view: the full row, with timestamps normalized to ISO strings. */
export function toAdminDoctor(row: ServiceDoctor) {
  return {
    ...row,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    deletedAt: iso(row.deletedAt),
    licenseVerifiedAt: iso(row.licenseVerifiedAt),
    publishedAt: iso(row.publishedAt),
  };
}

// ---------------------------------------------------------------------------
// Detail (hub) view types — public doctor/hospital plus resolved relations.
// ---------------------------------------------------------------------------

export interface PublicDoctorDetail extends PublicDoctor {
  region: PublicRegion | null;
  specialties: PublicSpecialty[];
  hospitals: Array<{ hospital: PublicHospital; role: string | null; isPrimary: boolean }>;
}

export interface PublicHospitalDetail extends PublicHospital {
  region: PublicRegion | null;
  doctors: PublicDoctor[];
}
