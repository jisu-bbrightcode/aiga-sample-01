/**
 * 통합검색 synonym admin DTOs (FR-003 create — BBR-533).
 *
 * Separate from the list/search DTOs (BBR-531): this is the admin-curated
 * synonym resource (term → expansions). zod-first via `createZodDto`; the HTTP
 * boundary rejects an empty term or an expansions list with no usable entries
 * before the service runs (normalization happens in the service).
 */
import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";

export const createSynonymSchema = z.object({
  /** Canonical search term to expand, e.g. "정형외과". */
  term: z.string().trim().min(1, "검색어를 입력해주세요.").max(100),
  /** Alternate terms that should match `term`. At least one required. */
  expansions: z
    .array(z.string().trim().min(1).max(100))
    .min(1, "확장어를 1개 이상 입력해주세요.")
    .max(50, "확장어는 최대 50개까지 등록할 수 있습니다."),
  /** Optional scope to a specialty context (denormalized, no FK). */
  specialtyId: z.string().uuid().optional(),
  /** Initial enabled state. Defaults to active on the server. */
  isActive: z.boolean().optional(),
  /** Internal editorial note. */
  notes: z.string().max(2000).optional(),
});
export class CreateSynonymDto extends createZodDto(createSynonymSchema) {}

export const listSynonymsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  /** Filter by enabled state when provided. */
  active: z.coerce.boolean().optional(),
  /** Case-insensitive substring match on the canonical term. */
  q: z.string().trim().min(1).max(100).optional(),
});
export class ListSynonymsQueryDto extends createZodDto(listSynonymsQuerySchema) {}

export const synonymSchema = z.object({
  id: z.string(),
  term: z.string(),
  expansions: z.array(z.string()),
  specialtyId: z.string().nullable(),
  isActive: z.boolean(),
  notes: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});
export class SynonymDto extends createZodDto(synonymSchema) {}

export const synonymListSchema = z.object({
  items: z.array(synonymSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
});
export class SynonymListDto extends createZodDto(synonymListSchema) {}
