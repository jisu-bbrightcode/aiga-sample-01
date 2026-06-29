/**
 * Personalization create request DTOs (FR-002 / BBR-726).
 *
 * Bodies for `POST /saved-items` (저장) and `POST /interests` (관심). Both point
 * polymorphically at the service-domain catalog (PB-DATA-001) via `targetType`
 * + `targetId`. The owner is never part of the body — it is taken from the
 * authenticated session — so a caller can only create records for themselves.
 *
 * The create responses reuse the list wire types ({@link SavedItemDto} /
 * {@link InterestDto}); a repeated create is idempotent (중복 방지) and returns
 * the existing record, so no distinct response shape is needed.
 */
import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";

/** Catalog resource kinds a save/interest may target (의사/병원). */
export const personalizationTargetTypes = ["doctor", "hospital"] as const;

const targetShape = {
  targetType: z.enum(personalizationTargetTypes),
  targetId: z.string().uuid(),
};

/** Body for `POST /saved-items`. */
export const createSavedItemSchema = z.object({
  ...targetShape,
  /** Optional private note attached to the save. */
  memo: z.string().max(2000).optional(),
  /** Optional user-defined tags for organizing saves. */
  tags: z.array(z.string().min(1).max(64)).max(50).optional(),
});

export type CreateSavedItemInput = z.infer<typeof createSavedItemSchema>;

export class CreateSavedItemDto extends createZodDto(createSavedItemSchema) {}

/** Body for `POST /interests` (append-only — no editable fields). */
export const createInterestSchema = z.object({ ...targetShape });

export type CreateInterestInput = z.infer<typeof createInterestSchema>;

export class CreateInterestDto extends createZodDto(createInterestSchema) {}
