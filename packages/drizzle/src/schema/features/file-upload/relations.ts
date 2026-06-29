import { relations } from "drizzle-orm";
import { users } from "../../core/better-auth";
import { fileAssets } from "./file-assets";

/**
 * file-upload relations.
 *
 * Only the owner/deleter relations to `users` are wired here. The
 * target resource link (`targetType`/`targetId`) is intentionally a soft
 * reference, not a drizzle relation, so this table stays decoupled from every
 * feature that attaches files.
 */
export const fileAssetsRelations = relations(fileAssets, ({ one }) => ({
  owner: one(users, {
    fields: [fileAssets.ownerUserId],
    references: [users.id],
    relationName: "file_asset_owner",
  }),
  deletedByUser: one(users, {
    fields: [fileAssets.deletedBy],
    references: [users.id],
    relationName: "file_asset_deleted_by",
  }),
}));
