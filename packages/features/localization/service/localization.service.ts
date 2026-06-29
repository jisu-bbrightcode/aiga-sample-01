import { Injectable, NotFoundException } from "@nestjs/common";
import { createLogger } from "@repo/core/logger";
import type { DrizzleDB } from "@repo/drizzle";
import { InjectDrizzle } from "@repo/drizzle";
import { locGlossary, locLanguages, locTranslations } from "@repo/drizzle/schema";
import { and, count, desc, eq, ilike, sql } from "drizzle-orm";
import type {
  CreateGlossaryDto,
  CreateLanguageDto,
  CreateTranslationDto,
  UpdateGlossaryDto,
  UpdateLanguageDto,
  UpdateTranslationDto,
} from "../dto";

const logger = createLogger("localization");

@Injectable()
export class LocalizationService {
  constructor(@InjectDrizzle() private readonly db: DrizzleDB) {}

  // ============================================================================
  // Languages
  // ============================================================================

  async listLanguages(projectId: string) {
    const languages = await this.db
      .select()
      .from(locLanguages)
      .where(and(eq(locLanguages.projectId, projectId), eq(locLanguages.isDeleted, false)))
      .orderBy(desc(locLanguages.createdAt));

    return languages;
  }

  async getLanguage(id: string) {
    const [language] = await this.db
      .select()
      .from(locLanguages)
      .where(and(eq(locLanguages.id, id), eq(locLanguages.isDeleted, false)))
      .limit(1);

    if (!language) {
      throw new NotFoundException(`Language not found: ${id}`);
    }

    return language;
  }

  async createLanguage(projectId: string, data: CreateLanguageDto) {
    const [language] = await this.db
      .insert(locLanguages)
      .values({
        projectId,
        code: data.code,
        name: data.name,
        isSource: data.isSource,
      })
      .returning();

    logger.info("Language created", {
      "localization.language_id": language?.id,
      "localization.language_code": data.code,
      "localization.project_id": projectId,
    });

    return language;
  }

  async updateLanguage(id: string, data: UpdateLanguageDto) {
    await this.getLanguage(id);

    const [updated] = await this.db
      .update(locLanguages)
      .set(data)
      .where(eq(locLanguages.id, id))
      .returning();

    logger.info("Language updated", {
      "localization.language_id": id,
    });

    return updated;
  }

  async deleteLanguage(id: string) {
    await this.getLanguage(id);

    await this.db
      .update(locLanguages)
      .set({ isDeleted: true, deletedAt: new Date() })
      .where(eq(locLanguages.id, id));

    logger.info("Language deleted", {
      "localization.language_id": id,
    });

    return { success: true };
  }

  // ============================================================================
  // Translations
  // ============================================================================

  async listTranslations(
    projectId: string,
    languageId: string,
    filters?: { entityType?: string; status?: string },
  ) {
    const conditions = [
      eq(locTranslations.projectId, projectId),
      eq(locTranslations.languageId, languageId),
      eq(locTranslations.isDeleted, false),
    ];

    if (filters?.entityType) {
      conditions.push(eq(locTranslations.entityType, filters.entityType));
    }

    if (filters?.status) {
      conditions.push(
        eq(
          locTranslations.status,
          filters.status as "pending" | "translated" | "reviewed" | "approved",
        ),
      );
    }

    const translations = await this.db
      .select()
      .from(locTranslations)
      .where(and(...conditions))
      .orderBy(desc(locTranslations.createdAt));

    return translations;
  }

  async getTranslation(id: string) {
    const [translation] = await this.db
      .select()
      .from(locTranslations)
      .where(and(eq(locTranslations.id, id), eq(locTranslations.isDeleted, false)))
      .limit(1);

    if (!translation) {
      throw new NotFoundException(`Translation not found: ${id}`);
    }

    return translation;
  }

  async createTranslation(projectId: string, data: CreateTranslationDto) {
    const [translation] = await this.db
      .insert(locTranslations)
      .values({
        projectId,
        languageId: data.languageId,
        entityId: data.entityId,
        entityType: data.entityType,
        field: data.field,
        sourceText: data.sourceText,
        translatedText: data.translatedText,
        status: data.status,
      })
      .returning();

    logger.info("Translation created", {
      "localization.translation_id": translation?.id,
      "localization.entity_type": data.entityType,
      "localization.project_id": projectId,
    });

    return translation;
  }

  async updateTranslation(id: string, data: UpdateTranslationDto) {
    await this.getTranslation(id);

    const [updated] = await this.db
      .update(locTranslations)
      .set(data)
      .where(eq(locTranslations.id, id))
      .returning();

    logger.info("Translation updated", {
      "localization.translation_id": id,
    });

    return updated;
  }

  async bulkUpdateTranslations(
    items: Array<{
      id: string;
      translatedText?: string;
      status?: "pending" | "translated" | "reviewed" | "approved";
    }>,
  ) {
    const results: (typeof locTranslations.$inferSelect)[] = [];

    for (const item of items) {
      await this.getTranslation(item.id);

      const updateData: Record<string, unknown> = {};
      if (item.translatedText !== undefined) {
        updateData.translatedText = item.translatedText;
      }
      if (item.status !== undefined) {
        updateData.status = item.status;
      }

      const [updated] = await this.db
        .update(locTranslations)
        .set(updateData)
        .where(eq(locTranslations.id, item.id))
        .returning();

      if (updated) {
        results.push(updated);
      }
    }

    logger.info("Translations bulk updated", {
      "localization.updated_count": items.length,
    });

    return results;
  }

  // ============================================================================
  // Glossary
  // ============================================================================

  async listGlossary(projectId: string, search?: string) {
    const conditions = [eq(locGlossary.projectId, projectId), eq(locGlossary.isDeleted, false)];

    if (search) {
      conditions.push(ilike(locGlossary.term, `%${search}%`));
    }

    const entries = await this.db
      .select()
      .from(locGlossary)
      .where(and(...conditions))
      .orderBy(desc(locGlossary.createdAt));

    return entries;
  }

  async getGlossaryEntry(id: string) {
    const [entry] = await this.db
      .select()
      .from(locGlossary)
      .where(and(eq(locGlossary.id, id), eq(locGlossary.isDeleted, false)))
      .limit(1);

    if (!entry) {
      throw new NotFoundException(`Glossary entry not found: ${id}`);
    }

    return entry;
  }

  async createGlossaryEntry(projectId: string, data: CreateGlossaryDto) {
    const [entry] = await this.db
      .insert(locGlossary)
      .values({
        projectId,
        term: data.term,
        definition: data.definition,
        translations: data.translations,
      })
      .returning();

    logger.info("Glossary entry created", {
      "localization.glossary_id": entry?.id,
      "localization.term": data.term,
      "localization.project_id": projectId,
    });

    return entry;
  }

  async updateGlossaryEntry(id: string, data: UpdateGlossaryDto) {
    await this.getGlossaryEntry(id);

    const [updated] = await this.db
      .update(locGlossary)
      .set(data)
      .where(eq(locGlossary.id, id))
      .returning();

    logger.info("Glossary entry updated", {
      "localization.glossary_id": id,
    });

    return updated;
  }

  async deleteGlossaryEntry(id: string) {
    await this.getGlossaryEntry(id);

    await this.db
      .update(locGlossary)
      .set({ isDeleted: true, deletedAt: new Date() })
      .where(eq(locGlossary.id, id));

    logger.info("Glossary entry deleted", {
      "localization.glossary_id": id,
    });

    return { success: true };
  }

  // ============================================================================
  // Progress
  // ============================================================================

  async calculateProgress(projectId: string, languageId: string) {
    const [totalResult] = await this.db
      .select({ count: count() })
      .from(locTranslations)
      .where(
        and(
          eq(locTranslations.projectId, projectId),
          eq(locTranslations.languageId, languageId),
          eq(locTranslations.isDeleted, false),
        ),
      );

    const [translatedResult] = await this.db
      .select({ count: count() })
      .from(locTranslations)
      .where(
        and(
          eq(locTranslations.projectId, projectId),
          eq(locTranslations.languageId, languageId),
          eq(locTranslations.isDeleted, false),
          sql`${locTranslations.status} IN ('translated', 'reviewed', 'approved')`,
        ),
      );

    const total = totalResult?.count ?? 0;
    const translated = translatedResult?.count ?? 0;
    const percentage = total > 0 ? Math.round((translated / total) * 100) : 0;

    return { total, translated, percentage };
  }
}
