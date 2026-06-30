import { z } from "zod";

/**
 * 커뮤니티 리액션 생성/변경 요청 (PUT /community/reactions).
 *
 * 동일 (사용자, 대상)에 대해 단일 리액션을 보장하는 set 의미이며, type 을 바꾸면
 * 기존 리액션이 변경된다(중복 생성 없음). 대상 유형은 게시글/댓글로 한정한다.
 */
export const setReactionSchema = z.object({
  targetType: z.enum(["post", "comment"]).describe("리액션 대상 유형"),
  targetId: z.string().uuid().describe("리액션 대상 ID"),
  type: z
    .enum(["like", "love", "haha", "wow", "sad", "angry"])
    .default("like")
    .describe("리액션 유형 (기본 like)"),
});

export type SetReactionDto = z.infer<typeof setReactionSchema>;
