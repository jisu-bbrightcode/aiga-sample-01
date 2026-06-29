import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import type { DrizzleDB } from "@repo/drizzle";
import { InjectDrizzle } from "@repo/drizzle";
import type { EmailTemplate, EmailTemplateType, EmailTemplateVersion } from "@repo/drizzle/schema";
import { emailTemplates, emailTemplateVersions } from "@repo/drizzle/schema";
import { and, desc, eq } from "drizzle-orm";
import {
  normalizeVariableSchema,
  parseVariableSchemaInput,
  renderTemplateString,
  resolveRenderer,
  summarizeValidationIssues,
  type TemplateValidationResult,
  type TemplateVariableSchema,
  validateTemplateVariables,
} from "../template-registry";
import { EmailTemplateService } from "./email-template.service";

/** A version row as exposed to admins (variableSchema normalized + isCurrent). */
export interface TemplateVersionView {
  id: string;
  version: number;
  status: EmailTemplateVersion["status"];
  subject: string;
  variableSchema: TemplateVariableSchema;
  changelog: string | null;
  publishedAt: Date | null;
  isCurrent: boolean;
}

export interface TemplateSummaryView {
  key: string;
  name: string;
  description: string | null;
  category: EmailTemplate["category"];
  isActive: boolean;
  /** Renderer the key maps to, or null for body-source-only templates. */
  renderer: EmailTemplateType | null;
  currentVersion: number | null;
  currentStatus: EmailTemplateVersion["status"] | null;
}

export interface TemplateDetailView extends TemplateSummaryView {
  versions: TemplateVersionView[];
}

export interface ResolvedTemplateVersion {
  template: EmailTemplate;
  version: EmailTemplateVersion;
  schema: TemplateVariableSchema;
  renderer: EmailTemplateType | null;
}

export interface RenderedTemplate {
  key: string;
  templateVersionId: string;
  version: number;
  status: EmailTemplateVersion["status"];
  renderer: EmailTemplateType | null;
  subject: string;
  html: string;
  validation: TemplateValidationResult;
  /** Placeholders referenced in the subject but not supplied. */
  subjectMissing: string[];
}

/** Admin-supplied payload for creating a new template + its initial draft version. */
export interface CreateTemplateInput {
  key: string;
  name: string;
  description?: string | null;
  category?: EmailTemplate["category"];
  subject: string;
  bodySource?: string | null;
  changelog?: string | null;
  /** Untrusted variable schema; validated semantically (422 on malformed). */
  variableSchema?: unknown;
}

/**
 * Email Template Registry Service
 *
 * Capability: `notification.email.template-manager`
 * (PB-NOTI-EMAIL-TEMPLATE-001 / BBR-656).
 *
 * Reads the versioned template registry (`email_templates` /
 * `email_template_versions`) established by PB-NOTI-EMAIL-DATA-001 and turns it
 * into renderable + validatable templates:
 *   - list / inspect templates and distinguish draft vs published versions (AC#3)
 *   - resolve the published version for a stable key (AC#1)
 *   - validate supplied variables against the version's `variableSchema` (AC#2)
 *   - render subject (placeholder interpolation) + body (React renderer / body source)
 *     into a preview payload
 *
 * Pure logic lives in `../template-registry`; this service only handles DB I/O
 * and orchestration.
 */
const PG_UNIQUE_VIOLATION = "23505";

/** Detect a Postgres unique-constraint violation (e.g. concurrent duplicate key). */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === PG_UNIQUE_VIOLATION
  );
}

@Injectable()
export class EmailTemplateRegistryService {
  constructor(
    @InjectDrizzle() private readonly db: DrizzleDB,
    private readonly templateService: EmailTemplateService,
  ) {}

  /** List all templates with their current (published-pointer) version status. */
  async listTemplates(): Promise<TemplateSummaryView[]> {
    const rows = await this.db
      .select({
        key: emailTemplates.key,
        name: emailTemplates.name,
        description: emailTemplates.description,
        category: emailTemplates.category,
        isActive: emailTemplates.isActive,
        currentVersion: emailTemplateVersions.version,
        currentStatus: emailTemplateVersions.status,
      })
      .from(emailTemplates)
      .leftJoin(
        emailTemplateVersions,
        eq(emailTemplates.currentVersionId, emailTemplateVersions.id),
      )
      .orderBy(emailTemplates.key);

    return rows.map((row) => ({
      key: row.key,
      name: row.name,
      description: row.description,
      category: row.category,
      isActive: row.isActive,
      renderer: resolveRenderer(row.key),
      currentVersion: row.currentVersion ?? null,
      currentStatus: row.currentStatus ?? null,
    }));
  }

  /** Fetch a template by key plus all of its versions (draft/published/archived). */
  async getTemplate(key: string): Promise<TemplateDetailView> {
    const template = await this.findTemplateByKey(key);

    const versions = await this.db
      .select()
      .from(emailTemplateVersions)
      .where(eq(emailTemplateVersions.templateId, template.id))
      .orderBy(desc(emailTemplateVersions.version));

    return this.toDetailView(template, versions);
  }

  /**
   * Create a new template and its initial draft version
   * (PB-NOTI-EMAIL-API-CREATE-001 / BBR-658).
   *
   * - Rejects a malformed `variableSchema` with 422 (AC: "잘못된 변수 스키마를 422로 거부").
   * - Rejects a duplicate `key` with 422 (AC: "중복 템플릿 키를 422로 거부"). A unique
   *   index also guards the key, so a concurrent insert is mapped to 422 too.
   * - The created template starts with NO published pointer; its first version is
   *   `draft` v1 (AC: "생성된 템플릿은 draft 상태와 버전 정보를 가진다").
   */
  async createTemplate(
    actorUserId: string | null,
    input: CreateTemplateInput,
  ): Promise<TemplateDetailView> {
    const parsedSchema = parseVariableSchemaInput(input.variableSchema);
    if (!parsedSchema.valid) {
      throw new UnprocessableEntityException(
        `변수 스키마가 올바르지 않습니다. ${parsedSchema.errors.join(" ")}`,
      );
    }

    const [existing] = await this.db
      .select({ id: emailTemplates.id })
      .from(emailTemplates)
      .where(eq(emailTemplates.key, input.key))
      .limit(1);
    if (existing) {
      throw new UnprocessableEntityException(`이미 존재하는 템플릿 키입니다: ${input.key}`);
    }

    try {
      return await this.db.transaction(async (tx) => {
        const [template] = await tx
          .insert(emailTemplates)
          .values({
            key: input.key,
            name: input.name,
            description: input.description ?? null,
            category: input.category ?? "transactional",
            isActive: true,
          })
          .returning();
        if (!template) {
          throw new Error("email_templates insert returned no row");
        }

        const [version] = await tx
          .insert(emailTemplateVersions)
          .values({
            templateId: template.id,
            version: 1,
            subject: input.subject,
            variableSchema: parsedSchema.schema,
            bodySource: input.bodySource ?? null,
            status: "draft",
            changelog: input.changelog ?? null,
            createdBy: actorUserId,
            publishedAt: null,
          })
          .returning();
        if (!version) {
          throw new Error("email_template_versions insert returned no row");
        }

        return this.toDetailView(template, [version]);
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new UnprocessableEntityException(`이미 존재하는 템플릿 키입니다: ${input.key}`);
      }
      throw error;
    }
  }

  /** Map a template row + its version rows into the admin detail view. */
  private toDetailView(
    template: EmailTemplate,
    versions: EmailTemplateVersion[],
  ): TemplateDetailView {
    const current = versions.find((v) => v.id === template.currentVersionId) ?? null;

    return {
      key: template.key,
      name: template.name,
      description: template.description,
      category: template.category,
      isActive: template.isActive,
      renderer: resolveRenderer(template.key),
      currentVersion: current?.version ?? null,
      currentStatus: current?.status ?? null,
      versions: versions.map((v) => ({
        id: v.id,
        version: v.version,
        status: v.status,
        subject: v.subject,
        variableSchema: normalizeVariableSchema(v.variableSchema),
        changelog: v.changelog,
        publishedAt: v.publishedAt,
        isCurrent: v.id === template.currentVersionId,
      })),
    };
  }

  /**
   * Resolve the published version that new sends should use. Prefers the
   * `current_version_id` pointer (the rollback target); falls back to the latest
   * published version. Throws when no published version exists.
   */
  async resolvePublishedVersion(key: string): Promise<ResolvedTemplateVersion> {
    const template = await this.findTemplateByKey(key);

    let version: EmailTemplateVersion | null = null;

    if (template.currentVersionId) {
      const [current] = await this.db
        .select()
        .from(emailTemplateVersions)
        .where(eq(emailTemplateVersions.id, template.currentVersionId))
        .limit(1);
      if (current && current.status === "published") {
        version = current;
      }
    }

    if (!version) {
      const [latest] = await this.db
        .select()
        .from(emailTemplateVersions)
        .where(
          and(
            eq(emailTemplateVersions.templateId, template.id),
            eq(emailTemplateVersions.status, "published"),
          ),
        )
        .orderBy(desc(emailTemplateVersions.version))
        .limit(1);
      version = latest ?? null;
    }

    if (!version) {
      throw new NotFoundException(`템플릿 "${key}"에 게시(published)된 버전이 없습니다.`);
    }

    return {
      template,
      version,
      schema: normalizeVariableSchema(version.variableSchema),
      renderer: resolveRenderer(template.key),
    };
  }

  /** Validate supplied variables against the published version's schema. */
  async validateVariables(
    key: string,
    variables: Record<string, unknown>,
  ): Promise<{ key: string; version: number; validation: TemplateValidationResult }> {
    const resolved = await this.resolvePublishedVersion(key);
    return {
      key,
      version: resolved.version.version,
      validation: validateTemplateVariables(resolved.schema, variables),
    };
  }

  /**
   * Render a template by key into subject + body HTML.
   *
   * When `requireValid` is true (the send path), invalid variables throw a
   * `BadRequestException` BEFORE any HTML is produced or anything is sent.
   * Preview callers pass `requireValid: false` so they still get HTML plus the
   * validation report for the gaps.
   */
  async renderByKey(
    key: string,
    variables: Record<string, unknown>,
    options: { requireValid: boolean },
  ): Promise<RenderedTemplate> {
    const resolved = await this.resolvePublishedVersion(key);
    const validation = validateTemplateVariables(resolved.schema, variables);

    if (options.requireValid && !validation.valid) {
      throw new BadRequestException(
        `이메일 변수 검증에 실패했습니다. ${summarizeValidationIssues(validation.issues)}`,
      );
    }

    const subjectResult = renderTemplateString(resolved.version.subject, variables);
    const html = await this.renderBody(resolved, variables);

    return {
      key,
      templateVersionId: resolved.version.id,
      version: resolved.version.version,
      status: resolved.version.status,
      renderer: resolved.renderer,
      subject: subjectResult.output,
      html,
      validation,
      subjectMissing: subjectResult.missing,
    };
  }

  /** Preview a template without failing on validation gaps. */
  preview(key: string, variables: Record<string, unknown>): Promise<RenderedTemplate> {
    return this.renderByKey(key, variables, { requireValid: false });
  }

  /** Render the body: React renderer when the key maps to one, else body source. */
  private async renderBody(
    resolved: ResolvedTemplateVersion,
    variables: Record<string, unknown>,
  ): Promise<string> {
    if (resolved.renderer) {
      return await this.templateService.render(resolved.renderer, variables);
    }
    if (resolved.version.bodySource) {
      return renderTemplateString(resolved.version.bodySource, variables).output;
    }
    throw new NotFoundException(
      `템플릿 "${resolved.template.key}"의 본문 렌더러를 찾을 수 없습니다.`,
    );
  }

  private async findTemplateByKey(key: string): Promise<EmailTemplate> {
    const [template] = await this.db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.key, key))
      .limit(1);

    if (!template) {
      throw new NotFoundException(`이메일 템플릿을 찾을 수 없습니다: ${key}`);
    }
    return template;
  }
}
