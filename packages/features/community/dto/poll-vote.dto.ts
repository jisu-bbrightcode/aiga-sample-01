import { z } from "zod";

/**
 * 투표 cast 요청. `optionIds`는 게시글 `pollData.options[].id` 값.
 * 단일 선택 투표는 1개, 복수 선택 투표는 1개 이상을 보낸다(상한은 선택지 수로 서비스에서 검증).
 */
export const castPollVoteSchema = z.object({
  optionIds: z
    .array(z.string().min(1).max(100))
    .min(1)
    .max(50)
    .describe("선택한 투표 항목 ID 목록"),
});

export type CastPollVoteDto = z.infer<typeof castPollVoteSchema>;
