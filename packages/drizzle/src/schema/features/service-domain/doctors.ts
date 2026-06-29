import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { baseColumnsWithSoftDelete } from "../../../utils/columns";
import { users } from "../../core/better-auth";
import { servicePublishStatusEnum } from "./enums";
import { serviceHospitals } from "./hospitals";
import { serviceSpecialties } from "./specialties";
import { serviceRegions } from "./regions";

/**
 * 의사 (Doctor) — the central hub resource of the AIGA service domain.
 *
 * PB-DATA-001 owns the core doctor record (identity, public profile summary,
 * status, denormalized browse keys). Downstream FR clusters EXTEND it without
 * redefining it:
 * - FR-005 의사 프로필 (BBR-523): rich profile detail (career/education/etc.)
 * - FR-004 명의 큐레이션 (BBR-522): curated collections referencing doctors
 * - FR-003 통합검색 (BBR-521): search projection over doctors/hospitals
 * - FR-002 개인화 (BBR-732): user saves/favorites referencing doctors
 *
 * Field visibility (acceptance criteria — public/private/admin separation):
 * - public:      name, slug, title, primarySpecialtyId, primaryHospitalId,
 *                regionId, shortBio, biography, photoUrl, yearsExperience,
 *                ratingAvg, reviewCount, isFeatured, featuredRank
 *                (only when status = 'published')
 * - admin-only:  status, licenseNumber, licenseVerifiedAt, internalNotes,
 *                sourceUrl, createdBy, updatedBy, soft-delete columns
 */
export const serviceDoctors = pgTable(
  "service_doctors",
  {
    ...baseColumnsWithSoftDelete(),

    // -- public fields -------------------------------------------------------
    name: varchar("name", { length: 120 }).notNull(),
    slug: varchar("slug", { length: 160 }).notNull(),
    /** Public title/position, e.g. "정형외과 교수", "원장". */
    title: varchar("title", { length: 120 }),
    /** Primary specialty for cards/filters; full set in service_doctor_specialties. */
    primarySpecialtyId: uuid("primary_specialty_id").references(() => serviceSpecialties.id, {
      onDelete: "set null",
    }),
    /** Primary hospital affiliation; full set in service_doctor_hospitals. */
    primaryHospitalId: uuid("primary_hospital_id").references(() => serviceHospitals.id, {
      onDelete: "set null",
    }),
    /** Denormalized region (from primary hospital) for fast browse/filter. */
    regionId: uuid("region_id").references(() => serviceRegions.id, { onDelete: "set null" }),
    /** Short public blurb for cards / search results. */
    shortBio: text("short_bio"),
    /** Long public biography for the detail page (FR-005 may extend). */
    biography: text("biography"),
    photoUrl: text("photo_url"),
    yearsExperience: integer("years_experience"),
    /** Public aggregate rating (denormalized from reviews; 0 when none). */
    ratingAvg: doublePrecision("rating_avg").notNull().default(0),
    reviewCount: integer("review_count").notNull().default(0),
    /** Public 명의 badge: editorially verified renowned doctor. */
    isFeatured: boolean("is_featured").notNull().default(false),
    /** Ordering among featured 명의 (lower = higher). Null = unranked. */
    featuredRank: integer("featured_rank"),

    // -- admin-only fields ---------------------------------------------------
    /** Editorial lifecycle. Only 'published' is publicly visible. */
    status: servicePublishStatusEnum("status").notNull().default("draft"),
    /** Sensitive: 의사 면허번호. Never exposed on public surfaces. */
    licenseNumber: varchar("license_number", { length: 64 }),
    licenseVerifiedAt: timestamp("license_verified_at", { withTimezone: true }),
    /** Internal editorial notes. Admin-only. */
    internalNotes: text("internal_notes"),
    /** Provenance of the record for editorial audit. Admin-only. */
    sourceUrl: text("source_url"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: text("updated_by").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [
    uniqueIndex("uq_service_doctors_slug").on(t.slug),
    // public browse: published doctors by specialty / region
    index("idx_service_doctors_status_specialty").on(t.status, t.primarySpecialtyId),
    index("idx_service_doctors_status_region").on(t.status, t.regionId),
    index("idx_service_doctors_hospital").on(t.primaryHospitalId),
    // public 명의 rail: published + featured in rank order
    index("idx_service_doctors_status_featured_rank").on(t.status, t.isFeatured, t.featuredRank),
    // public name search / prefix
    index("idx_service_doctors_name").on(t.name),
    // admin console: most-recently-edited first
    index("idx_service_doctors_updated_at").on(t.updatedAt),
  ],
);

/**
 * 의사 ↔ 진료과 (Doctor ↔ specialty) — many-to-many.
 *
 * A doctor may practice several specialties. `isPrimary` mirrors the doctor's
 * `primarySpecialtyId` for convenience; the canonical full set lives here.
 */
export const serviceDoctorSpecialties = pgTable(
  "service_doctor_specialties",
  {
    doctorId: uuid("doctor_id")
      .notNull()
      .references(() => serviceDoctors.id, { onDelete: "cascade" }),
    specialtyId: uuid("specialty_id")
      .notNull()
      .references(() => serviceSpecialties.id, { onDelete: "cascade" }),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.doctorId, t.specialtyId] }),
    // reverse lookup: doctors in a specialty
    index("idx_doctor_specialties_specialty").on(t.specialtyId),
  ],
);

/**
 * 의사 ↔ 병원 (Doctor ↔ hospital affiliation) — many-to-many.
 *
 * A doctor may be affiliated with multiple hospitals (현직/겸직). `role` is the
 * public title at that hospital; `isPrimary` mirrors `primaryHospitalId`.
 */
export const serviceDoctorHospitals = pgTable(
  "service_doctor_hospitals",
  {
    doctorId: uuid("doctor_id")
      .notNull()
      .references(() => serviceDoctors.id, { onDelete: "cascade" }),
    hospitalId: uuid("hospital_id")
      .notNull()
      .references(() => serviceHospitals.id, { onDelete: "cascade" }),
    /** Public role at this hospital, e.g. "진료부장". */
    role: varchar("role", { length: 80 }),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.doctorId, t.hospitalId] }),
    // reverse lookup: doctors at a hospital
    index("idx_doctor_hospitals_hospital").on(t.hospitalId),
  ],
);

export type ServiceDoctor = typeof serviceDoctors.$inferSelect;
export type NewServiceDoctor = typeof serviceDoctors.$inferInsert;
export type ServiceDoctorSpecialty = typeof serviceDoctorSpecialties.$inferSelect;
export type ServiceDoctorHospital = typeof serviceDoctorHospitals.$inferSelect;
