import { boolean, index, integer, pgTable, text, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { baseColumns } from "../../../utils/columns";

/**
 * 진료과 (Medical specialty) taxonomy — shared reference resource.
 *
 * Public, read-only catalog dimension used to filter/browse doctors and to
 * group 명의 curations. Owned by PB-DATA-001 (the shared hub); FR clusters
 * reference it by id, they do not redefine it.
 *
 * Field visibility:
 * - public:      name, slug, description, sortOrder
 * - admin-only:  isActive (toggle visibility without deleting)
 */
export const serviceSpecialties = pgTable(
  "service_specialties",
  {
    ...baseColumns(),

    /** Display name, e.g. "정형외과". Public. */
    name: varchar("name", { length: 100 }).notNull(),
    /** URL/slug key, e.g. "orthopedics". Public, stable, unique. */
    slug: varchar("slug", { length: 100 }).notNull(),
    /** Short public description shown on category pages. */
    description: text("description"),
    /** Manual ordering on public listings. */
    sortOrder: integer("sort_order").notNull().default(0),

    /** Admin-only: hide from public without deleting (preserves references). */
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [
    // public lookup by slug + uniqueness guard
    uniqueIndex("uq_service_specialties_slug").on(t.slug),
    // public listing: active specialties in display order
    index("idx_service_specialties_active_order").on(t.isActive, t.sortOrder),
  ],
);

export type ServiceSpecialty = typeof serviceSpecialties.$inferSelect;
export type NewServiceSpecialty = typeof serviceSpecialties.$inferInsert;
