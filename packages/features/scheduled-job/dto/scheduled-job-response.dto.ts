import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";

/**
 * Wire shape for a system_scheduled_jobs row.
 * All timestamp columns are Date objects in Drizzle but Fastify JSON-serializes
 * them to ISO strings, so z.string() matches the actual wire format.
 */
export const scheduledJobResponseSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  jobKey: z.string(),
  displayName: z.string(),
  description: z.string().nullable(),
  cronExpression: z.string(),
  isActive: z.boolean(),
  lastRunAt: z.string().nullable(),
  nextRunAt: z.string().nullable(),
  metadata: z.record(z.unknown()).nullable(),
});

export class ScheduledJobResponseDto extends createZodDto(scheduledJobResponseSchema) {}

/**
 * Wire shape for a system_job_runs row.
 */
export const jobRunResponseSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  jobId: z.string(),
  status: z.enum(["running", "success", "failed"]),
  startedAt: z.string(),
  completedAt: z.string().nullable(),
  durationMs: z.number().nullable(),
  result: z.record(z.unknown()).nullable(),
  errorMessage: z.string().nullable(),
});

export class JobRunResponseDto extends createZodDto(jobRunResponseSchema) {}

/**
 * Paginated job runs response.
 */
export const jobRunsPageResponseSchema = z.object({
  data: z.array(jobRunResponseSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number(),
});

export class JobRunsPageResponseDto extends createZodDto(jobRunsPageResponseSchema) {}

/** Shape returned by runJobNow endpoint. */
export const runJobNowResponseSchema = z.object({ success: z.boolean() });

export class RunJobNowResponseDto extends createZodDto(runJobNowResponseSchema) {}
