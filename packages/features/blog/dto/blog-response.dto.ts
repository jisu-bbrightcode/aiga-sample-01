import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";

/**
 * Wire shape for a blog post row.
 * All timestamp columns are Date objects in Drizzle but Fastify JSON-serializes
 * them to ISO strings, so z.string() matches the actual wire format.
 */
export const blogPostResponseSchema = z.object({
  id: z.string(),
  authorId: z.string(),
  title: z.string(),
  slug: z.string(),
  content: z.string().nullable(),
  excerpt: z.string().nullable(),
  coverImage: z.string().nullable(),
  status: z.enum(["draft", "published", "archived"]),
  publishedAt: z.string().nullable(),
  readTimeMinutes: z.number(),
  viewCount: z.number(),
  clapsCount: z.number(),
  responsesCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export class BlogPostResponseDto extends createZodDto(blogPostResponseSchema) {}

/** Shape returned by getPostBySlug — post + viewer-specific fields. */
export const blogPostDetailResponseSchema = blogPostResponseSchema.extend({
  userClaps: z.number(),
  isBookmarked: z.boolean(),
});

export class BlogPostDetailResponseDto extends createZodDto(blogPostDetailResponseSchema) {}

/** Shape returned by getPosts — paginated list. */
export const blogPostListResponseSchema = z.object({
  items: z.array(blogPostResponseSchema),
  nextCursor: z.string().optional(),
});

export class BlogPostListResponseDto extends createZodDto(blogPostListResponseSchema) {}

/** Shape for a blog response (comment) row. */
export const blogResponseResponseSchema = z.object({
  id: z.string(),
  postId: z.string(),
  authorId: z.string(),
  parentId: z.string().nullable(),
  content: z.string(),
  clapsCount: z.number(),
  isDeleted: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export class BlogResponseResponseDto extends createZodDto(blogResponseResponseSchema) {}

/** Shape returned by deletePost. */
export const blogDeleteResponseSchema = z.object({ success: z.boolean() });

export class BlogDeleteResponseDto extends createZodDto(blogDeleteResponseSchema) {}

/** Shape returned by clapPost. */
export const blogClapResponseSchema = z.object({ totalCount: z.number() });

export class BlogClapResponseDto extends createZodDto(blogClapResponseSchema) {}

/** Shape returned by toggleBookmark. */
export const blogBookmarkResponseSchema = z.object({ bookmarked: z.boolean() });

export class BlogBookmarkResponseDto extends createZodDto(blogBookmarkResponseSchema) {}
