import { createZodDto } from "@repo/shared/zod-nestjs";
import { createBlogPostSchema } from "./create-post.dto";

export const updateBlogPostSchema = createBlogPostSchema.partial();

export class UpdateBlogPostDto extends createZodDto(updateBlogPostSchema) {}
