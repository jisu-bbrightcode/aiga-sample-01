import {
  boolean,
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
import { serviceDoctors } from "../service-domain/doctors";
import { servicePublishStatusEnum } from "../service-domain/enums";
import { serviceRegions } from "../service-domain/regions";
import { serviceSpecialties } from "../service-domain/specialties";
import { serviceCollectionKindEnum } from "./enums";

/**
 * 명의 컬렉션 / 기획전 (Doctor collection) — FR-004 명의 큐레이션 (BBR-522).
 *
 * Editorial curated list that powers the "명의 찾기" discovery surface. The raw
 * 명의 browse/filter/sort (by 진료과 / 지역 / 평점 / featured_rank) is REUSED from
 * the PB-DATA-001 doctor hub (`service_doctors` + its existing indexes); this
 * feature adds the editorial curation layer on top — it does not re-implement
 * doctor search.
 *
 * Field visibility (acceptance criteria — public/private/admin separation):
 * - public:  name, slug, subtitle, description, heroImageUrl, kind,
 *            specialtyId, regionId, isFeatured, sortOrder
 *            (only when status = 'published')
 * - admin-only: status, internalNotes, sourceUrl, createdBy, updatedBy,
 *               publishedAt, soft-delete columns
 */
export const serviceDoctorCollections = pgTable(
  "service_doctor_collections",
  {
    ...baseColumnsWithSoftDelete(),

    // -- public fields -------------------------------------------------------
    /** Display title, e.g. "2026 대한민국 무릎관절 명의". */
    name: varchar("name", { length: 160 }).notNull(),
    /** URL/slug key, e.g. "2026-knee-joint". Public, stable, unique. */
    slug: varchar("slug", { length: 180 }).notNull(),
    /** Short public tagline shown under the title. */
    subtitle: varchar("subtitle", { length: 240 }),
    /** Long public description / editorial intro. */
    description: text("description"),
    heroImageUrl: text("hero_image_url"),
    /** Public browse facet: 기획 / 분야별 / 지역별. */
    kind: serviceCollectionKindEnum("kind").notNull().default("editorial"),
    /** Optional scope for kind = 'specialty' (분야별 명의). */
    specialtyId: uuid("specialty_id").references(() => serviceSpecialties.id, {
      onDelete: "set null",
    }),
    /** Optional scope for kind = 'region' (지역별 명의). */
    regionId: uuid("region_id").references(() => serviceRegions.id, { onDelete: "set null" }),
    /** Public home rail: highlight on the 명의 찾기 landing. */
    isFeatured: boolean("is_featured").notNull().default(false),
    /** Manual ordering among published collections (lower = higher). */
    sortOrder: integer("sort_order").notNull().default(0),

    // -- admin-only fields ---------------------------------------------------
    /** Editorial lifecycle (reused hub enum). Only 'published' is public. */
    status: servicePublishStatusEnum("status").notNull().default("draft"),
    /** Internal editorial notes. Admin-only. */
    internalNotes: text("internal_notes"),
    /** Provenance of the curation for editorial audit. Admin-only. */
    sourceUrl: text("source_url"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: text("updated_by").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [
    uniqueIndex("uq_service_doctor_collections_slug").on(t.slug),
    // public home rail: published + featured collections in display order
    index("idx_service_doctor_collections_status_featured_sort").on(
      t.status,
      t.isFeatured,
      t.sortOrder,
    ),
    // public browse by facet (필터): published collections of a kind
    index("idx_service_doctor_collections_status_kind").on(t.status, t.kind),
    // 분야별 명의 컬렉션 lookup by specialty
    index("idx_service_doctor_collections_specialty").on(t.specialtyId),
    // admin console: most-recently-edited first
    index("idx_service_doctor_collections_updated_at").on(t.updatedAt),
  ],
);

/**
 * 컬렉션 수록 의사 (Collection ↔ doctor) — ordered many-to-many.
 *
 * A doctor may appear in many collections; a collection lists many doctors in
 * editorial `rank` order. `note` is a public per-entry blurb (선정 이유). Both
 * the parent collection and the referenced doctor must be `published` for an
 * item to surface publicly — enforced at the query layer.
 */
export const serviceDoctorCollectionItems = pgTable(
  "service_doctor_collection_items",
  {
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => serviceDoctorCollections.id, { onDelete: "cascade" }),
    doctorId: uuid("doctor_id")
      .notNull()
      .references(() => serviceDoctors.id, { onDelete: "cascade" }),
    /** Editorial ordering within the collection (lower = higher). */
    rank: integer("rank").notNull().default(0),
    /** Public per-entry blurb, e.g. 선정 이유. */
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.collectionId, t.doctorId] }),
    // ordered read: items within a collection by rank
    index("idx_doctor_collection_items_collection_rank").on(t.collectionId, t.rank),
    // reverse lookup: collections a doctor appears in (doctor profile "featured in")
    index("idx_doctor_collection_items_doctor").on(t.doctorId),
  ],
);

export type ServiceDoctorCollection = typeof serviceDoctorCollections.$inferSelect;
export type NewServiceDoctorCollection = typeof serviceDoctorCollections.$inferInsert;
export type ServiceDoctorCollectionItem = typeof serviceDoctorCollectionItems.$inferSelect;
export type NewServiceDoctorCollectionItem = typeof serviceDoctorCollectionItems.$inferInsert;
