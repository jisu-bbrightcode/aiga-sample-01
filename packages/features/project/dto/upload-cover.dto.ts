import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";

export const uploadCoverSchema = z.object({
  // base64 data URL — sized for ≤4MB image (1.34x base64 inflation).
  dataUrl: z.string().max(6_300_000).startsWith("data:image/"),
});

export class UploadCoverDto extends createZodDto(uploadCoverSchema) {}
