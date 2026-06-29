import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";

/**
 * Wire shape for a comment row.
 * Drizzle timestamps are Date objects but Fastify JSON-serializes to ISO strings,
 * so z.string() matches the actual wire format.
 */
export const commentResponseSchema = z.object({
  id: z.string(),
  content: z.string(),
  authorId: z.string(),
  targetType: z.enum(["board_post", "community_post", "blog_post", "page"]),
  targetId: z.string(),
  parentId: z.string().nullable(),
  depth: z.number(),
  status: z.enum(["visible", "hidden", "deleted"]),
  mentions: z.array(z.string()).nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

export class CommentResponseDto extends createZodDto(commentResponseSchema) {}

/**
 * Wire shape for a comment with author info.
 */
export const commentWithAuthorSchema = commentResponseSchema.extend({
  author: z.object({
    id: z.string(),
    name: z.string(),
    avatar: z.string().nullable(),
  }),
  replyCount: z.number().optional(),
});

export class CommentWithAuthorDto extends createZodDto(commentWithAuthorSchema) {}

/**
 * Paginated comments list.
 */
export const paginatedCommentsSchema = z.object({
  items: z.array(commentWithAuthorSchema),
  total: z.number(),
  hasMore: z.boolean(),
});

export class PaginatedCommentsDto extends createZodDto(paginatedCommentsSchema) {}

/**
 * Comment count response.
 */
export const commentCountSchema = z.object({ count: z.number() });

export class CommentCountDto extends createZodDto(commentCountSchema) {}

/** Shape returned by delete endpoint. */
export const deleteResponseSchema = z.object({ success: z.boolean() });

export class CommentDeleteResponseDto extends createZodDto(deleteResponseSchema) {}
