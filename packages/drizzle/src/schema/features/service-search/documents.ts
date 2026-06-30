import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
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
import { baseColumns, softDelete } from "../../../utils/columns";
import { serviceSearchEntityTypeEnum } from "./enums";

/**
 * Postgres `tsvector` column type (no native drizzle builder in 0.38).
 *
 * The value is database-generated (see `searchVector` below), so it never
 * appears in insert payloads.
 */
const tsvector = customType<{ data: string; driverData: string }>({
  dataType() {
    return "tsvector";
  },
});

/**
 * 통합검색 인덱스 (Unified search projection) — FR-003 / BBR-521.
 *
 * One row per *published* service-domain catalog resource (doctor, hospital,
 * specialty, region), denormalized into a single searchable shape so one query
 * can rank results across every resource type — this is the "통합" (unified)
 * in 통합검색.
 *
 * This table is a REBUILDABLE projection, not a source of truth:
 * - `entityId` is a polymorphic reference into the matching service-domain
 *   table; there is deliberately no FK. The seed/reindex job repopulates it
 *   from the catalog (see src/seed/service-search.ts).
 * - `regionId` / `specialtyId` are denormalized facet keys (no FK) so filtered
 *   search ("강남구 정형외과") stays a single-table scan.
 *
 * Field visibility (acceptance criteria — public vs admin separation):
 * - public:     entityType, entityId, title, subtitle, slug, photoUrl,
 *               regionId, specialtyId, ratingAvg  (only when isPublished = true)
 * - app/admin:  body, keywords, searchVector, weight, isPublished,
 *               sourceUpdatedAt  (ranking/index internals, never rendered raw)
 *
 * Public surfaces MUST filter `isPublished = true`; only published source rows
 * are ever projected here, but the column makes the guard explicit and lets a
 * source row be unpublished without deleting its document immediately.
 *
 * Archive (FR-003 delete/archive — BBR-535): `isDeleted`/`deletedAt` are an
 * admin-owned soft-delete distinct from `isPublished`. A reindex repopulates
 * the publish/display columns from the catalog but NEVER touches these two (see
 * the reindex `set` block in src/seed/service-search.ts), so an admin archive
 * survives reindex while `isPublished` mirrors source state. Both public AND
 * default admin reads exclude `isDeleted = true`; the row — and every payment/
 * history/audit record keyed off the source `entityId` — is preserved and
 * restorable.
 */
export const serviceSearchDocuments = pgTable(
  "service_search_documents",
  {
    ...baseColumns(),

    // -- identity ------------------------------------------------------------
    entityType: serviceSearchEntityTypeEnum("entity_type").notNull(),
    /** Polymorphic id of the source catalog row. No FK (rebuildable projection). */
    entityId: uuid("entity_id").notNull(),

    // -- public display fields ----------------------------------------------
    /** Primary label: doctor/hospital name, specialty/region name. */
    title: varchar("title", { length: 200 }).notNull(),
    /** Secondary line for result cards, e.g. "정형외과 · 강남구". */
    subtitle: varchar("subtitle", { length: 300 }),
    /** Source slug used to build the result link. */
    slug: varchar("slug", { length: 200 }).notNull(),
    photoUrl: text("photo_url"),
    /** Denormalized facet (no FK): region of the source row. */
    regionId: uuid("region_id"),
    /** Denormalized facet (no FK): primary specialty of the source row. */
    specialtyId: uuid("specialty_id"),
    /** Denormalized ranking signal copied from the source row (0 when none). */
    ratingAvg: doublePrecision("rating_avg").notNull().default(0),

    // -- index / ranking internals (not rendered raw) -----------------------
    /** Long searchable text (bio/summary) folded into the vector. */
    body: text("body"),
    /** Extra search terms (synonyms, aliases) folded into the vector. */
    keywords: text("keywords"),
    /** Editorial boost: higher ranks first (featured 명의 / hospital). */
    weight: integer("weight").notNull().default(0),
    /** Only true rows are publicly searchable. Mirrors source publish state. */
    isPublished: boolean("is_published").notNull().default(true),
    /** Source row's updatedAt at projection time — drives incremental reindex. */
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }),

    // -- archive (admin soft-delete, FR-003 delete/archive — BBR-535) --------
    /**
     * Admin-owned soft-delete, independent of `isPublished`. When true the row
     * is excluded from every public AND default admin read (노출 차단) but kept
     * on disk so it can be restored and so connected payment/history/audit data
     * (keyed off the source entityId) is preserved. The reindex job never
     * writes these columns, so an archive survives a re-projection.
     */
    ...softDelete(),

    /**
     * Weighted full-text vector, DATABASE-GENERATED from title/subtitle/
     * keywords/body. Uses the `simple` config (Korean has no bundled FTS
     * dictionary; `simple` tokenizes on whitespace/punctuation and the trigram
     * index below covers substring/typo recall). The GIN index over this
     * column and the trigram index over `title` are created in the migration
     * (0047) — drizzle-kit 0.38 cannot express the `gin_trgm_ops` op-class.
     */
    searchVector: tsvector("search_vector").generatedAlwaysAs(
      (): ReturnType<typeof sql> =>
        sql`setweight(to_tsvector('simple', coalesce("title", '')), 'A') || setweight(to_tsvector('simple', coalesce("subtitle", '')), 'B') || setweight(to_tsvector('simple', coalesce("keywords", '')), 'B') || setweight(to_tsvector('simple', coalesce("body", '')), 'C')`,
    ),
  },
  (t) => [
    // one document per source row; the reindex upserts on this key
    uniqueIndex("uq_service_search_documents_entity").on(t.entityType, t.entityId),
    // public search scope + type facet
    index("idx_service_search_documents_pub_type").on(t.isPublished, t.entityType),
    // facet filters
    index("idx_service_search_documents_region").on(t.regionId),
    index("idx_service_search_documents_specialty").on(t.specialtyId),
    // featured rail / weight-ordered results within published scope
    index("idx_service_search_documents_pub_weight").on(t.isPublished, t.weight),
    // active (non-archived) public scope — the hot path after soft-delete (BBR-535)
    index("idx_service_search_documents_active")
      .on(t.isPublished, t.entityType)
      .where(sql`${t.isDeleted} = false`),
    // NOTE: GIN(search_vector) and GIN(title gin_trgm_ops) live in migration 0047.
  ],
);

export type ServiceSearchDocument = typeof serviceSearchDocuments.$inferSelect;
export type NewServiceSearchDocument = typeof serviceSearchDocuments.$inferInsert;
