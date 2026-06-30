import { z } from "zod";

export const updateCommentSchema = z.object({
  content: z.string().min(1).max(10000).describe("댓글 내용"),
});

export type UpdateCommentDto = z.infer<typeof updateCommentSchema>;
