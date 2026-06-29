import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";

// ============================================================================
// Language Response
// ============================================================================

/**
 * Wire shape for loc_languages row.
 * Timestamps are Date in Drizzle but Fastify JSON-serializes to ISO strings.
 */
export const languageResponseSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  code: z.string(),
  name: z.string(),
  isSource: z.boolean(),
  progress: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
  isDeleted: z.boolean(),
});

export class LanguageResponseDto extends createZodDto(languageResponseSchema) {}

// ============================================================================
// Translation Response
// ============================================================================

/**
 * Wire shape for loc_translations row.
 */
export const translationResponseSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  languageId: z.string(),
  entityId: z.string(),
  entityType: z.string(),
  field: z.string(),
  sourceText: z.string().nullable(),
  translatedText: z.string().nullable(),
  status: z.enum(["pending", "translated", "reviewed", "approved"]),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
  isDeleted: z.boolean(),
});

export class TranslationResponseDto extends createZodDto(translationResponseSchema) {}

// ============================================================================
// Glossary Response
// ============================================================================

const glossaryTranslationWireSchema = z.object({
  languageCode: z.string(),
  translation: z.string(),
});

/**
 * Wire shape for loc_glossary row.
 */
export const glossaryResponseSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  term: z.string(),
  definition: z.string().nullable(),
  translations: z.array(glossaryTranslationWireSchema).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
  isDeleted: z.boolean(),
});

export class GlossaryResponseDto extends createZodDto(glossaryResponseSchema) {}

// ============================================================================
// Progress Response
// ============================================================================

export const progressResponseSchema = z.object({
  total: z.number(),
  translated: z.number(),
  percentage: z.number(),
});

export class ProgressResponseDto extends createZodDto(progressResponseSchema) {}

// ============================================================================
// Delete Response
// ============================================================================

export const deleteResponseSchema = z.object({ success: z.boolean() });
export class DeleteResponseDto extends createZodDto(deleteResponseSchema) {}
