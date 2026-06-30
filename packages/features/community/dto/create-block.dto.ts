import { z } from "zod";

/**
 * 작성자 차단 생성 입력 (PB-COMM-BLOCK-API-CREATE-001 / BBR-615).
 * 차단 주체(blocker)는 인증 컨텍스트에서 가져오므로 본문에는 대상만 받는다.
 * 유저 ID 는 better-auth nanoid(text) 이므로 uuid 가 아니다.
 */
export const createBlockSchema = z.object({
  blockedId: z.string().min(1).describe("차단할 사용자 ID"),
});

export type CreateBlockDto = z.infer<typeof createBlockSchema>;
