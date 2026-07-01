import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";

/**
 * 관리자 콘텐츠 복구 요청 (POST /admin/community/restore).
 *
 * 게시글/댓글의 모더레이션 상태(숨김·제거)를 공개 상태로 되돌린다. 원문이 파괴된
 * 제거 댓글은 서버가 거부한다(409). `reason` 은 community_mod_logs 감사에 기록된다.
 */
export const restoreContentSchema = z.object({
  targetType: z.enum(["post", "comment"]).describe("복구 대상 유형"),
  targetId: z.string().uuid().describe("복구 대상 ID"),
  reason: z.string().max(1000).optional().describe("복구 사유 (감사 로그 기록)"),
});

export type RestoreContentInput = z.infer<typeof restoreContentSchema>;

export class RestoreContentDto extends createZodDto(restoreContentSchema) {}

/** 관리자 콘텐츠 복구 결과. */
export const restoreContentResponseSchema = z.object({
  targetType: z.enum(["post", "comment"]),
  targetId: z.string(),
  status: z.string().describe("복구 후 노출 상태 (게시글=published, 댓글=visible)"),
  restored: z.boolean(),
});

export type RestoreContentResult = z.infer<typeof restoreContentResponseSchema>;

export class RestoreContentResponseDto extends createZodDto(restoreContentResponseSchema) {}
