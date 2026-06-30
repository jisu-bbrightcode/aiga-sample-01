/**
 * Admin domain resource DETAIL — pure projection & masking logic.
 *
 * PB-ADMIN-DOMAIN-READ-001 (BBR-679) is the read-one counterpart to the admin
 * list (PB-ADMIN-DOMAIN-API-001). It powers the admin detail screen, which —
 * unlike the public surfaces — must show the full operational state of a
 * catalog record (lifecycle status incl. draft/archived, soft-delete
 * bookkeeping, provenance, editor ids) AND the related entities the record
 * links to (region, specialties, hospital/doctor affiliations, credentials,
 * hours).
 *
 * Acceptance-critical: sensitive identifiers (의사 면허번호 / 사업자등록번호) are
 * NEVER returned in the clear. They are masked here so the admin can confirm a
 * value exists and matches the last few digits without the raw PII leaving the
 * server. Keeping this module side-effect-free lets the mask + projection be
 * unit-tested without a database or HTTP layer.
 */
import type {
  ServiceDoctor,
  ServiceDoctorCredential,
  ServiceHospital,
  ServiceHospitalHours,
  ServiceRegion,
  ServiceSpecialty,
} from "@repo/drizzle/schema";
import type { AdminDomainResourceType } from "./admin-resources";
import type { ServicePublishStatus } from "./status";

const iso = (value: Date | string | null | undefined): string | null => {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString() : value;
};

/**
 * Mask a sensitive identifier, revealing only the last 4 characters.
 *
 * - `null`/empty → `null` (the field simply isn't set; nothing to mask).
 * - ≤4 chars → fully masked (revealing a 4-char tail would expose the whole
 *   value).
 * - otherwise → bullet-padded prefix + 4-char tail, e.g. `••••••1234`.
 *
 * The returned string never contains the leading characters of the original,
 * so it is safe to render in the admin UI and to log.
 */
export function maskSecret(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length <= 4) return "•".repeat(trimmed.length);
  const tail = trimmed.slice(-4);
  return `${"•".repeat(trimmed.length - tail.length)}${tail}`;
}

// ---------------------------------------------------------------------------
// Related-entity reference shapes (the "관련 정보 링크" the detail screen renders)
// ---------------------------------------------------------------------------

export interface RegionRef {
  id: string;
  name: string;
  slug: string;
}

export interface SpecialtyRef {
  id: string;
  name: string;
  slug: string;
}

/** A linked catalog resource the admin can navigate to from the detail page. */
export interface ResourceRef {
  id: string;
  name: string;
  slug: string;
  status: ServicePublishStatus;
}

/** A doctor's hospital affiliation (or a hospital's affiliated doctor). */
export interface AffiliationRef extends ResourceRef {
  role: string | null;
  isPrimary: boolean;
}

export interface AdminCredentialView {
  id: string;
  kind: ServiceDoctorCredential["kind"];
  title: string;
  organization: string | null;
  displayPeriod: string | null;
  startYear: number | null;
  endYear: number | null;
  isVisible: boolean;
  sortOrder: number;
}

export interface AdminHoursView {
  id: string;
  dayOfWeek: number;
  opensAt: string | null;
  closesAt: string | null;
  isClosed: boolean;
  note: string | null;
}

/**
 * Operational/audit metadata shared by both resource types. These are the
 * admin-only "운영 필드" — never present on public surfaces.
 */
export interface AdminResourceOps {
  createdAt: string | null;
  updatedAt: string | null;
  publishedAt: string | null;
  isDeleted: boolean;
  deletedAt: string | null;
  /** User ids for editorial audit; resolve to user links on the client. */
  createdBy: string | null;
  updatedBy: string | null;
  /** Provenance of the record (editorial audit). Admin-only. */
  sourceUrl: string | null;
  /** Free-form internal editorial notes. Admin-only. */
  internalNotes: string | null;
}

// ---------------------------------------------------------------------------
// Detail view models
// ---------------------------------------------------------------------------

interface AdminResourceDetailBase {
  id: string;
  name: string;
  slug: string;
  status: ServicePublishStatus;
  isFeatured: boolean;
  photoUrl: string | null;
  ratingAvg: number;
  reviewCount: number;
  region: RegionRef | null;
  ops: AdminResourceOps;
}

export interface AdminDoctorDetail extends AdminResourceDetailBase {
  type: "doctor";
  title: string | null;
  yearsExperience: number | null;
  featuredRank: number | null;
  shortBio: string | null;
  biography: string | null;
  primarySpecialty: SpecialtyRef | null;
  specialties: SpecialtyRef[];
  hospitals: AffiliationRef[];
  credentials: AdminCredentialView[];
  licenseVerifiedAt: string | null;
  /** Sensitive identifiers — masked, never raw. */
  sensitive: { licenseNumber: string | null };
}

export interface AdminHospitalDetail extends AdminResourceDetailBase {
  type: "hospital";
  summary: string | null;
  description: string | null;
  addressLine: string | null;
  phone: string | null;
  websiteUrl: string | null;
  specialties: SpecialtyRef[];
  doctors: ResourceRef[];
  hours: AdminHoursView[];
  /** Sensitive identifiers — masked, never raw. */
  sensitive: { businessRegistrationNo: string | null };
}

export type AdminDomainResourceDetail = AdminDoctorDetail | AdminHospitalDetail;

export const ADMIN_DOMAIN_DETAIL_TYPES: readonly AdminDomainResourceType[] = ["doctor", "hospital"];

// ---------------------------------------------------------------------------
// Mappers — build a new object field-by-field (fail-closed on new columns).
// ---------------------------------------------------------------------------

const toRegionRef = (row: ServiceRegion | null | undefined): RegionRef | null =>
  row ? { id: row.id, name: row.name, slug: row.slug } : null;

const toSpecialtyRef = (row: ServiceSpecialty): SpecialtyRef => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
});

function toOps(row: {
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
  publishedAt: Date | string | null;
  isDeleted: boolean;
  deletedAt: Date | string | null;
  createdBy: string | null;
  updatedBy: string | null;
  sourceUrl: string | null;
  internalNotes: string | null;
}): AdminResourceOps {
  return {
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    publishedAt: iso(row.publishedAt),
    isDeleted: row.isDeleted,
    deletedAt: iso(row.deletedAt),
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    sourceUrl: row.sourceUrl,
    internalNotes: row.internalNotes,
  };
}

export interface DoctorDetailInput {
  doctor: ServiceDoctor;
  region: ServiceRegion | null;
  primarySpecialty: ServiceSpecialty | null;
  specialties: ServiceSpecialty[];
  hospitals: Array<{ hospital: ServiceHospital; role: string | null; isPrimary: boolean }>;
  credentials: ServiceDoctorCredential[];
}

export function toAdminDoctorDetail(input: DoctorDetailInput): AdminDoctorDetail {
  const { doctor, region, primarySpecialty, specialties, hospitals, credentials } = input;
  return {
    type: "doctor",
    id: doctor.id,
    name: doctor.name,
    slug: doctor.slug,
    status: doctor.status,
    isFeatured: doctor.isFeatured,
    photoUrl: doctor.photoUrl,
    ratingAvg: doctor.ratingAvg,
    reviewCount: doctor.reviewCount,
    region: toRegionRef(region),
    title: doctor.title,
    yearsExperience: doctor.yearsExperience,
    featuredRank: doctor.featuredRank,
    shortBio: doctor.shortBio,
    biography: doctor.biography,
    primarySpecialty: primarySpecialty ? toSpecialtyRef(primarySpecialty) : null,
    specialties: specialties.map(toSpecialtyRef),
    hospitals: hospitals.map((h) => ({
      id: h.hospital.id,
      name: h.hospital.name,
      slug: h.hospital.slug,
      status: h.hospital.status,
      role: h.role,
      isPrimary: h.isPrimary,
    })),
    credentials: credentials.map((c) => ({
      id: c.id,
      kind: c.kind,
      title: c.title,
      organization: c.organization,
      displayPeriod: c.displayPeriod,
      startYear: c.startYear,
      endYear: c.endYear,
      isVisible: c.isVisible,
      sortOrder: c.sortOrder,
    })),
    licenseVerifiedAt: iso(doctor.licenseVerifiedAt),
    sensitive: { licenseNumber: maskSecret(doctor.licenseNumber) },
    ops: toOps(doctor),
  };
}

export interface HospitalDetailInput {
  hospital: ServiceHospital;
  region: ServiceRegion | null;
  specialties: ServiceSpecialty[];
  doctors: ServiceDoctor[];
  hours: ServiceHospitalHours[];
}

export function toAdminHospitalDetail(input: HospitalDetailInput): AdminHospitalDetail {
  const { hospital, region, specialties, doctors, hours } = input;
  return {
    type: "hospital",
    id: hospital.id,
    name: hospital.name,
    slug: hospital.slug,
    status: hospital.status,
    isFeatured: hospital.isFeatured,
    photoUrl: hospital.photoUrl,
    ratingAvg: hospital.ratingAvg,
    reviewCount: hospital.reviewCount,
    region: toRegionRef(region),
    summary: hospital.summary,
    description: hospital.description,
    addressLine: hospital.addressLine,
    phone: hospital.phone,
    websiteUrl: hospital.websiteUrl,
    specialties: specialties.map(toSpecialtyRef),
    doctors: doctors.map((d) => ({
      id: d.id,
      name: d.name,
      slug: d.slug,
      status: d.status,
    })),
    hours: hours.map((h) => ({
      id: h.id,
      dayOfWeek: h.dayOfWeek,
      opensAt: h.opensAt,
      closesAt: h.closesAt,
      isClosed: h.isClosed,
      note: h.note,
    })),
    sensitive: { businessRegistrationNo: maskSecret(hospital.businessRegistrationNo) },
    ops: toOps(hospital),
  };
}
