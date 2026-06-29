import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  genre: z.string().max(100).optional(),
  template: z.string().max(100).nullable().optional(),
  status: z.enum(["active", "archived", "completed"]).optional(),
  aiMode: z.enum(["ai_powered", "ai_safety"]).optional(),
  // Project list redesign — pattern path or Blob URL (uploaded images go to
  // Vercel Blob via project.uploadCover, only the resulting URL lands here).
  coverImage: z.string().max(2048).nullable().optional(),
});

export class UpdateProjectDto extends createZodDto(updateProjectSchema) {}
