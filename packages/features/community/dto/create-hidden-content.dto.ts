import { z } from "zod";

/**
 * 콘텐츠 숨김 생성 DTO.
 *
 * scope='user'(기본): 사용자별 숨김(per-viewer mute) — 본인 시야에서만 제외.
 * scope='global': 관리자/모더레이터 전역 숨김 — 커뮤니티 권한 필요.
 */
export const createHiddenContentSchema = z.object({
  targetType: z.enum(["post", "comment"]).describe("숨김 대상 유형"),
  targetId: z.string().uuid().describe("숨김 대상 ID"),
  scope: z
    .enum(["user", "global"])
    .default("user")
    .describe("user=사용자별 숨김(기본), global=관리자 전역 숨김"),
  reason: z.string().trim().min(1).max(500).optional().describe("숨김 사유 (선택)"),
});

export type CreateHiddenContentDto = z.infer<typeof createHiddenContentSchema>;

/**
 * 숨김 해제 DTO (사용자별 숨김 해제 전용).
 */
export const removeHiddenContentSchema = z.object({
  targetType: z.enum(["post", "comment"]).describe("숨김 해제 대상 유형"),
  targetId: z.string().uuid().describe("숨김 해제 대상 ID"),
});

export type RemoveHiddenContentDto = z.infer<typeof removeHiddenContentSchema>;

/**
 * 전역 숨김 복구 DTO (관리자/모더레이터 전용).
 *
 * 전역 숨김(scope='global')으로 비공개 처리된 게시글/댓글을 다시 공개 상태로
 * 복구한다. 커뮤니티 권한이 필요하며, 일반 사용자 숨김 해제와 저장소·권한이
 * 구분된다(AC#2).
 */
export const restoreHiddenContentSchema = z.object({
  targetType: z.enum(["post", "comment"]).describe("복구 대상 유형"),
  targetId: z.string().uuid().describe("복구 대상 ID"),
  reason: z.string().trim().min(1).max(500).optional().describe("복구 사유 (선택)"),
});

export type RestoreHiddenContentDto = z.infer<typeof restoreHiddenContentSchema>;
