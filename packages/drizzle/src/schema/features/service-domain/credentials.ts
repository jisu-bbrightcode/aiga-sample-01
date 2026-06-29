import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { baseColumns } from "../../../utils/columns";
import { serviceDoctors } from "./doctors";

/**
 * 의사 프로필 자격/이력 종류 (Doctor credential kind) — FR-005 owned enum.
 *
 * Per the PB-DATA-001 ownership boundary, the shared hub owns catalog-wide
 * enums (service_publish_status) while each FR cluster owns its own
 * feature-specific enums in its own module. FR-005 (의사 프로필) owns this one.
 *
 * - education:     학력 (medical school, residency, fellowship)
 * - career:        경력 (past/current positions and appointments)
 * - certification: 자격/면허/학회 (board certifications, society memberships)
 * - award:         수상 (awards and editorial recognition)
 */
export const serviceDoctorCredentialKindEnum = pgEnum("service_doctor_credential_kind", [
  "education",
  "career",
  "certification",
  "award",
]);

/**
 * 의사 프로필 이력 항목 (Doctor profile credential) — FR-005 (BBR-523).
 *
 * Rich profile-detail timeline entries that the core `service_doctors` record
 * intentionally left to FR-005 (see doctors.ts header). One row per timeline
 * entry; the `kind` discriminates education / career / certification / award so
 * a single table backs every section of the 의사 프로필 detail page.
 *
 * Field visibility (acceptance criteria — public/private/admin separation):
 * - public:     kind, title, organization, startYear, endYear, displayPeriod,
 *               description, sortOrder
 *               (only when the parent doctor is `published` AND isVisible = true)
 * - admin-only: isVisible (hide a single entry without deleting), the parent
 *               doctor's editorial status gate.
 *
 * Visibility is inherited: the public API must filter on the parent doctor's
 * `status = 'published'` and on `isVisible = true`. There is no sensitive PII
 * stored here — license numbers stay on `service_doctors` (admin-only).
 */
export const serviceDoctorCredentials = pgTable(
  "service_doctor_credentials",
  {
    ...baseColumns(),

    doctorId: uuid("doctor_id")
      .notNull()
      .references(() => serviceDoctors.id, { onDelete: "cascade" }),

    /** Section discriminator for the profile detail page. */
    kind: serviceDoctorCredentialKindEnum("kind").notNull(),

    /** Headline of the entry, e.g. "정형외과 전문의", "서울대학교 의과대학". */
    title: varchar("title", { length: 200 }).notNull(),
    /** Issuing/affiliated organization, e.g. "대한정형외과학회". Optional. */
    organization: varchar("organization", { length: 200 }),

    /** Structured start year for sorting (e.g. 2008). Null when unknown. */
    startYear: integer("start_year"),
    /** Structured end year; null = ongoing (현재) or single-point entry. */
    endYear: integer("end_year"),
    /** Free-form period label for display, e.g. "2008–현재", "2005". */
    displayPeriod: varchar("display_period", { length: 80 }),

    /** Optional longer public description for the entry. */
    description: text("description"),

    /** Manual ordering within a kind section (lower = higher). */
    sortOrder: integer("sort_order").notNull().default(0),

    /** Admin-only: hide a single entry from public without deleting it. */
    isVisible: boolean("is_visible").notNull().default(true),
  },
  (t) => [
    // public profile detail: a doctor's entries grouped by section, in order
    index("idx_doctor_credentials_doctor_kind_order").on(t.doctorId, t.kind, t.sortOrder),
    // admin filter: visible/hidden entries for a doctor
    index("idx_doctor_credentials_doctor_visible").on(t.doctorId, t.isVisible),
  ],
);

export type ServiceDoctorCredential = typeof serviceDoctorCredentials.$inferSelect;
export type NewServiceDoctorCredential = typeof serviceDoctorCredentials.$inferInsert;
