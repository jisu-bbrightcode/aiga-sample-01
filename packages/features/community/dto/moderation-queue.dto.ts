/**
 * Unified admin moderation-queue DTOs (PB-COMM-MODERATION-API-LIST-001).
 *
 * Response contract for `GET /admin/community/moderation`, which aggregates
 * 신고(report)/필터(filter)/차단(ban) into a single trackable shape (AC#2).
 */
import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";

export const moderationQueueItemSchema = z.object({
  kind: z.enum(["report", "filter", "ban"]).describe("출처 종류 (신고/필터/차단)"),
  id: z.string().describe("출처 레코드 ID"),
  communityId: z.string(),
  targetType: z.string().nullable().describe("대상 타입 (post/comment/user)"),
  targetId: z.string().nullable(),
  subjectId: z.string().nullable().describe("관련 사용자 (신고자/작성자/차단 실행자)"),
  state: z.enum(["open", "resolved"]).describe("정규화된 처리 상태 (미처리/처리됨)"),
  status: z.string().describe("원본 소스 상태값"),
  severity: z.string().nullable().describe("심각도 (신고 전용)"),
  reason: z.string().nullable(),
  ruleType: z.string().nullable().describe("필터 규칙 종류 (필터 전용)"),
  action: z.string().nullable().describe("필터 조치 blocked/hidden_for_review (필터 전용)"),
  createdAt: z.string(),
});

export class ModerationQueueItemDto extends createZodDto(moderationQueueItemSchema) {}

export const moderationQueueResponseSchema = z.object({
  items: z.array(moderationQueueItemSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number(),
});

export class ModerationQueueResponseDto extends createZodDto(moderationQueueResponseSchema) {}
