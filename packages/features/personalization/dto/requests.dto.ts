/**
 * Personalization list request DTOs (FR-002 / BBR-724).
 *
 * All three list endpoints share one cursor-pagination query shape. Validation
 * is zod-first via `createZodDto`, matching the repo feature pattern
 * (see service-domain/dto). `cursor` is an opaque token the client echoes back;
 * `limit` is clamped to a sane ceiling so a caller cannot ask for an unbounded
 * page.
 */
import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";

export const DEFAULT_LIST_LIMIT = 20;
export const MAX_LIST_LIMIT = 100;

export const listQuerySchema = z.object({
  /** Opaque forward cursor from a previous page's `nextCursor`. */
  cursor: z.string().min(1).max(512).optional(),
  /** Page size (1..100). Defaults to 20. */
  limit: z.coerce.number().int().min(1).max(MAX_LIST_LIMIT).default(DEFAULT_LIST_LIMIT),
});

export type ListQuery = z.infer<typeof listQuerySchema>;

export class ListQueryDto extends createZodDto(listQuerySchema) {}
