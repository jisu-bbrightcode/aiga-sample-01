import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";
import { storyPropertyEntityTypeSchema } from "./create-relation.dto";

export const upsertEntityPropertySchema = z.object({
  projectId: z.string().uuid(),
  entityId: z.string().uuid(),
  entityType: storyPropertyEntityTypeSchema,
  key: z.string().min(1).max(80),
  value: z.string(),
});

export class UpsertEntityPropertyDto extends createZodDto(upsertEntityPropertySchema) {}

export const uploadEntityImageSmallSchema = z.object({
  projectId: z.string().uuid(),
  entityId: z.string().uuid(),
  entityType: storyPropertyEntityTypeSchema,
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1).max(120),
  bytesBase64: z.string().min(1),
});

export class UploadEntityImageSmallDto extends createZodDto(uploadEntityImageSmallSchema) {}
