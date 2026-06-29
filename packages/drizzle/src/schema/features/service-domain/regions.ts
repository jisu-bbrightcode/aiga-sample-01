import {
  type AnyPgColumn,
  boolean,
  index,
  integer,
  pgTable,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { baseColumns } from "../../../utils/columns";

/**
 * 지역 (Region) taxonomy — shared reference resource.
 *
 * Two-level hierarchy: 시/도 (parentId = null) → 시군구 (parentId set).
 * Used to filter/browse doctors and hospitals by location. Owned by
 * PB-DATA-001; FR clusters reference it by id.
 *
 * Field visibility:
 * - public:      name, slug, parentId, sortOrder
 * - admin-only:  isActive
 */
export const serviceRegions = pgTable(
  "service_regions",
  {
    ...baseColumns(),

    /** Display name, e.g. "서울특별시" / "강남구". Public. */
    name: varchar("name", { length: 100 }).notNull(),
    /** URL/slug key, e.g. "seoul" / "seoul-gangnam". Public, unique. */
    slug: varchar("slug", { length: 120 }).notNull(),
    /** Parent region (시/도). Null for top-level regions. Self-reference. */
    parentId: uuid("parent_id").references((): AnyPgColumn => serviceRegions.id, {
      onDelete: "set null",
    }),
    /** Manual ordering on public listings. */
    sortOrder: integer("sort_order").notNull().default(0),

    /** Admin-only: hide from public without deleting. */
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [
    uniqueIndex("uq_service_regions_slug").on(t.slug),
    // public drill-down: children of a region in display order
    index("idx_service_regions_parent_order").on(t.parentId, t.sortOrder),
    index("idx_service_regions_active").on(t.isActive),
  ],
);

export type ServiceRegion = typeof serviceRegions.$inferSelect;
export type NewServiceRegion = typeof serviceRegions.$inferInsert;
