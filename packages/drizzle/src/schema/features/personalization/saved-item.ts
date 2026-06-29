import { index, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { baseColumns } from "../../../utils/columns";
import { users } from "../../core/better-auth";
import { personalizationTargetTypeEnum } from "./enums";

/**
 * 저장 (Saved item) — a user's bookmark of a catalog resource.
 *
 * FR-002 개인화 (BBR-732). Owner-scoped: every row belongs to a logged-in user
 * (`user_id` NOT NULL), so non-authenticated saves cannot exist at the data
 * layer — the login gate lives in the API/screen, and this constraint backstops
 * it. The (user, target_type, target_id) unique index prevents duplicate saves
 * of the same resource by the same user.
 *
 * `target_type` + `target_id` is a polymorphic pointer at the service-domain
 * catalog (PB-DATA-001) — a doctor or a hospital. It is intentionally not a
 * hard FK (a column cannot reference two tables); referential cleanup of
 * dangling targets is handled by the catalog/service layer.
 */
export const savedItem = pgTable(
  "saved_item",
  {
    // id + created_at + updated_at (memo/tags are editable, so updated_at applies)
    ...baseColumns(),

    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetType: personalizationTargetTypeEnum("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    /** Optional private note the user attached to the save. */
    memo: text("memo"),
    /** Optional user-defined tags for organizing saves. */
    tags: text("tags").array(),
  },
  (t) => [
    // 중복 저장 방지 — one save per (user, resource)
    uniqueIndex("uq_saved_item_owner_target").on(t.userId, t.targetType, t.targetId),
    // 사용자별 저장 목록 최근순 (also serves user_id lookups)
    index("idx_saved_item_user_created").on(t.userId, t.createdAt),
  ],
);

export type SavedItem = typeof savedItem.$inferSelect;
export type NewSavedItem = typeof savedItem.$inferInsert;
