/**
 * Community policy-filter DTOs (PB-COMM-FILTER-API-001).
 *
 * 자동 필터 감사 로그 조회 / 검토 큐 / 검토 처리 요청·응답 계약.
 */
import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";

/** 검토 처리 요청: 자동 숨김 후보를 공개(approve)하거나 제거(reject). */
export const reviewFilterSchema = z.object({
  decision: z.enum(["approve", "reject"]).describe("검토 결정 (approve=공개, reject=제거)"),
  note: z.string().max(1000).optional().describe("검토 메모"),
});

export type ReviewFilterDto = z.infer<typeof reviewFilterSchema>;

export class ReviewFilterRequestDto extends createZodDto(reviewFilterSchema) {}

export const filterLogResponseSchema = z.object({
  id: z.string(),
  communityId: z.string(),
  authorId: z.string(),
  targetType: z.enum(["post", "comment"]).nullable(),
  targetId: z.string().nullable(),
  ruleType: z.enum(["keyword", "link", "attachment", "moderation"]),
  action: z.enum(["blocked", "hidden_for_review"]),
  matchedTerms: z.array(z.string()),
  reason: z.string().nullable(),
  reviewStatus: z.enum(["pending", "approved", "rejected"]),
  reviewedBy: z.string().nullable(),
  reviewedAt: z.string().nullable(),
  reviewNote: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export class FilterLogResponseDto extends createZodDto(filterLogResponseSchema) {}

export const filterLogListResponseSchema = z.object({
  items: z.array(filterLogResponseSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  hasMore: z.boolean(),
});

export class FilterLogListResponseDto extends createZodDto(filterLogListResponseSchema) {}

export const filterReviewQueueResponseSchema = z.object({
  items: z.array(filterLogResponseSchema),
  total: z.number(),
});

export class FilterReviewQueueResponseDto extends createZodDto(filterReviewQueueResponseSchema) {}
