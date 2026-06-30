/**
 * Personalization update request DTO (FR-002 / BBR-727).
 *
 * Body for `PATCH /saved-items/:id` (저장 항목 변경). Only the user-editable
 * fields of a save — `memo` and `tags` — are patchable; the target pointer
 * (`targetType`/`targetId`) and ownership are immutable. The owner is never part
 * of the body — it is taken from the authenticated session — so a caller can
 * only ever edit their own saves (소유자 스코프 강제).
 *
 * Partial semantics: a field that is **omitted** is left unchanged; a field set
 * to `null` (or `[]` for tags) clears it. At least one field must be present —
 * an empty patch is rejected (400) rather than silently doing nothing.
 *
 * The response reuses the list wire type ({@link SavedItemDto}); the updated
 * record (with a fresh `updatedAt`) is returned.
 */
import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";

export const updateSavedItemSchema = z
  .object({
    /** New private note, or `null` to clear it. Omit to leave unchanged. */
    memo: z.string().max(2000).nullable().optional(),
    /** New tag set, or `null`/`[]` to clear it. Omit to leave unchanged. */
    tags: z.array(z.string().min(1).max(64)).max(50).nullable().optional(),
  })
  .refine((v) => v.memo !== undefined || v.tags !== undefined, {
    message: "수정할 항목(메모 또는 태그)을 하나 이상 지정해 주세요.",
  });

export type UpdateSavedItemInput = z.infer<typeof updateSavedItemSchema>;

export class UpdateSavedItemDto extends createZodDto(updateSavedItemSchema) {}
