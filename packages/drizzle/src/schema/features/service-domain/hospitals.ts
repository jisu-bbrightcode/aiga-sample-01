import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { baseColumnsWithSoftDelete } from "../../../utils/columns";
import { users } from "../../core/better-auth";
import { servicePublishStatusEnum } from "./enums";
import { serviceRegions } from "./regions";

/**
 * 병원 (Hospital) — core editorial resource.
 *
 * FR-006 (병원 상세) has no separate DATA cluster; per the PB-FEAT-003 scope
 * lock it is REUSE→FR-005 and its data lives here in the shared hub. FR-005
 * (의사 프로필, BBR-523) and FR-003 (통합검색, BBR-521) reference this table.
 *
 * Field visibility (acceptance criteria — public/private/admin separation):
 * - public:      name, slug, summary, description, regionId, addressLine,
 *                phone, websiteUrl, photoUrl, ratingAvg, reviewCount, isFeatured
 *                (only when status = 'published')
 * - admin-only:  status, businessRegistrationNo, internalNotes, sourceUrl,
 *                createdBy, updatedBy, soft-delete columns
 */
export const serviceHospitals = pgTable(
  "service_hospitals",
  {
    ...baseColumnsWithSoftDelete(),

    // -- public fields -------------------------------------------------------
    name: varchar("name", { length: 200 }).notNull(),
    slug: varchar("slug", { length: 200 }).notNull(),
    /** Short public blurb for cards / search results. */
    summary: text("summary"),
    /** Long public description for the detail page. */
    description: text("description"),
    regionId: uuid("region_id").references(() => serviceRegions.id, { onDelete: "set null" }),
    /** Public street address (display only). */
    addressLine: varchar("address_line", { length: 300 }),
    /** Public contact phone. */
    phone: varchar("phone", { length: 40 }),
    websiteUrl: text("website_url"),
    photoUrl: text("photo_url"),
    /** Public aggregate rating (denormalized from reviews; 0 when none). */
    ratingAvg: doublePrecision("rating_avg").notNull().default(0),
    reviewCount: integer("review_count").notNull().default(0),
    /** Public badge: editorially highlighted hospital. */
    isFeatured: boolean("is_featured").notNull().default(false),

    // -- admin-only fields ---------------------------------------------------
    /** Editorial lifecycle. Only 'published' is publicly visible. */
    status: servicePublishStatusEnum("status").notNull().default("draft"),
    /** Sensitive: 사업자등록번호. Never exposed on public surfaces. */
    businessRegistrationNo: varchar("business_registration_no", { length: 32 }),
    /** Internal editorial notes. Admin-only. */
    internalNotes: text("internal_notes"),
    /** Provenance of the record for editorial audit. Admin-only. */
    sourceUrl: text("source_url"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: text("updated_by").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [
    uniqueIndex("uq_service_hospitals_slug").on(t.slug),
    // public browse: published hospitals by region
    index("idx_service_hospitals_status_region").on(t.status, t.regionId),
    // public 명의/featured rail
    index("idx_service_hospitals_status_featured").on(t.status, t.isFeatured),
    // public name search / prefix
    index("idx_service_hospitals_name").on(t.name),
    // admin console: most-recently-edited first
    index("idx_service_hospitals_updated_at").on(t.updatedAt),
  ],
);

export type ServiceHospital = typeof serviceHospitals.$inferSelect;
export type NewServiceHospital = typeof serviceHospitals.$inferInsert;
