/**
 * Community Feature — Reaction read DTOs (PB-COMM-REACTION-API-LIST-001 / BBR-611).
 *
 * 게시글/댓글 리액션 count, 내 리액션 상태, 지원 reaction type 목록의 wire shape.
 */
import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";

/** 지원하는 reaction type. common/types 의 ReactionType 과 동일하게 유지한다. */
const reactionTypeSchema = z.enum(["like", "love", "haha", "wow", "sad", "angry"]);

const reactionTypeCountSchema = z.object({
  type: reactionTypeSchema,
  count: z.number(),
});

const reactionCountsSchema = z.object({
  total: z.number(),
  byType: z.array(reactionTypeCountSchema),
});

const viewerReactionStateSchema = z.object({
  hasReacted: z.boolean(),
  types: z.array(reactionTypeSchema),
});

/** 게시글/댓글 리액션 요약 응답. */
export const reactionSummarySchema = z.object({
  targetType: z.enum(["community_post", "community_comment"]),
  targetId: z.string(),
  summary: reactionCountsSchema,
  /** 로그인 사용자의 내 리액션 상태. 비로그인이면 null. */
  viewer: viewerReactionStateSchema.nullable(),
  supportedTypes: z.array(reactionTypeSchema),
});

export class ReactionSummaryResponseDto extends createZodDto(reactionSummarySchema) {}

/** 지원하는 reaction type 목록 응답. */
export const reactionTypesSchema = z.object({
  types: z.array(reactionTypeSchema),
});

export class ReactionTypesResponseDto extends createZodDto(reactionTypesSchema) {}
