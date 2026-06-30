import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";

/**
 * Reaction type enum — matches pgEnum values.
 */
const reactionTypeSchema = z.enum(["like", "love", "haha", "wow", "sad", "angry"]);

/**
 * Single reaction type + count pair.
 */
const reactionTypeCountSchema = z.object({
  type: reactionTypeSchema,
  count: z.number(),
});

/**
 * Wire shape for getCounts / getCountsBatch entries.
 */
export const reactionCountsSchema = z.object({
  total: z.number(),
  byType: z.array(reactionTypeCountSchema),
});

export class ReactionCountsDto extends createZodDto(reactionCountsSchema) {}

/**
 * Wire shape for toggle response.
 */
export const toggleReactionResponseSchema = z.object({
  added: z.boolean(),
  type: reactionTypeSchema,
});

export class ToggleReactionResponseDto extends createZodDto(toggleReactionResponseSchema) {}

/**
 * Wire shape for the idempotent remove (cancel) response.
 * Carries fresh derived counts so the client can sync without a follow-up read.
 */
export const removeReactionResponseSchema = z.object({
  removed: z.boolean(),
  counts: reactionCountsSchema,
});

export class RemoveReactionResponseDto extends createZodDto(removeReactionResponseSchema) {}

/**
 * Wire shape for getUserStatus / getUserStatusBatch entries.
 */
export const userReactionStatusSchema = z.object({
  hasReacted: z.boolean(),
  types: z.array(reactionTypeSchema),
});

export class UserReactionStatusDto extends createZodDto(userReactionStatusSchema) {}
