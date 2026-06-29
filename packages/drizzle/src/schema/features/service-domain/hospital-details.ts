import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { baseColumns } from "../../../utils/columns";
import { serviceHospitals } from "./hospitals";
import { serviceSpecialties } from "./specialties";

/**
 * 병원 진료과목 (Hospital ↔ specialty) — many-to-many. FR-006 (병원 상세).
 *
 * FR-006 has no separate DATA cluster; per the PB-FEAT-003 scope lock it is
 * REUSE→FR-005 and its data lives alongside FR-005 here. The core hub links
 * doctors to specialties, but the 병원 상세 page needs the hospital's own
 * department list, which this table provides.
 *
 * Public, read-only catalog data: visible when the parent hospital is
 * `published`. No admin-only fields.
 */
export const serviceHospitalSpecialties = pgTable(
  "service_hospital_specialties",
  {
    hospitalId: uuid("hospital_id")
      .notNull()
      .references(() => serviceHospitals.id, { onDelete: "cascade" }),
    specialtyId: uuid("specialty_id")
      .notNull()
      .references(() => serviceSpecialties.id, { onDelete: "cascade" }),
    /** Manual ordering of departments on the hospital detail page. */
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.hospitalId, t.specialtyId] }),
    // detail page: a hospital's departments in display order
    index("idx_hospital_specialties_hospital_order").on(t.hospitalId, t.sortOrder),
    // reverse lookup: hospitals offering a specialty
    index("idx_hospital_specialties_specialty").on(t.specialtyId),
  ],
);

/**
 * 병원 운영시간 (Hospital weekly operating hours) — FR-006 (병원 상세).
 *
 * One row per weekday for the 병원 상세 page schedule block. `dayOfWeek` follows
 * JS getDay(): 0 = Sunday … 6 = Saturday. Times are stored as "HH:MM" display
 * strings (kept simple; no timezone math — these are wall-clock posted hours).
 *
 * Public, read-only catalog data: visible when the parent hospital is
 * `published`. No admin-only fields.
 */
export const serviceHospitalHours = pgTable(
  "service_hospital_hours",
  {
    ...baseColumns(),

    hospitalId: uuid("hospital_id")
      .notNull()
      .references(() => serviceHospitals.id, { onDelete: "cascade" }),

    /** 0 = Sunday … 6 = Saturday (JS getDay()). */
    dayOfWeek: integer("day_of_week").notNull(),

    /** Opening time as "HH:MM" wall-clock, e.g. "09:00". Null when closed. */
    opensAt: varchar("opens_at", { length: 5 }),
    /** Closing time as "HH:MM" wall-clock, e.g. "18:00". Null when closed. */
    closesAt: varchar("closes_at", { length: 5 }),
    /** True when the hospital is closed this weekday (휴진). */
    isClosed: boolean("is_closed").notNull().default(false),
    /** Optional note, e.g. "점심시간 13:00–14:00". */
    note: varchar("note", { length: 120 }),
  },
  (t) => [
    // one schedule row per (hospital, weekday)
    uniqueIndex("uq_hospital_hours_hospital_day").on(t.hospitalId, t.dayOfWeek),
  ],
);

export type ServiceHospitalSpecialty = typeof serviceHospitalSpecialties.$inferSelect;
export type NewServiceHospitalSpecialty = typeof serviceHospitalSpecialties.$inferInsert;
export type ServiceHospitalHours = typeof serviceHospitalHours.$inferSelect;
export type NewServiceHospitalHours = typeof serviceHospitalHours.$inferInsert;
