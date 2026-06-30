import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import type { DrizzleDB } from "@repo/drizzle";
import { InjectDrizzle } from "@repo/drizzle";
import type {
  EmailStatus,
  EmailTemplate,
  EmailTemplateType,
  EmailTemplateVersion,
  NewEmailTemplate,
  NewEmailTemplateVersion,
} from "@repo/drizzle/schema";
import { emailLogs, emailTemplates, emailTemplateVersions } from "@repo/drizzle/schema";
import { and, count, desc, eq, inArray, max } from "drizzle-orm";
import {
  buildSampleVariables,
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

export interface EmailSendSummary {
  /** Total send-log rows attributed to this template key. */
  totalCount: number;
  /** Count per email status (only statuses that occurred are present). */
  statusCounts: Partial<Record<EmailStatus, number>>;
  /** Status of the most recently created send log, or null when never sent. */
  lastStatus: EmailStatus | null;
  /** Timestamp of the most recent send log (createdAt), or null when never sent. */
  lastSentAt: Date | null;
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
  /** Template row's last-modified timestamp (AC: 목록은 updatedAt 제공). */
  updatedAt: Date;
  /** Last-send status summary derived from email_logs (AC: 마지막 발송 상태 요약). */
  lastSend: EmailSendSummary;
}

export interface TemplateDetailView extends TemplateSummaryView {
  versions: TemplateVersionView[];
}

/** Zero-state send summary for templates that have never been sent. */
function emptySendSummary(): EmailSendSummary {
  return { totalCount: 0, statusCounts: {}, lastStatus: null, lastSentAt: null };
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
 * Admin-supplied payload for updating a template (PB-NOTI-EMAIL-API-UPDATE-001 /
 * BBR-659). Every field is optional — only the keys present are changed. Template
 * metadata (`name`/`description`/`category`/`isActive`) patches the template row;
 * content fields (`subject`/`bodySource`/`variableSchema`/`changelog`) land on the
 * working DRAFT version so a published version is never mutated (AC#1).
 */
export interface UpdateTemplateInput {
  name?: string;
  description?: string | null;
  category?: EmailTemplate["category"];
  isActive?: boolean;
  subject?: string;
  bodySource?: string | null;
  changelog?: string | null;
  /** Untrusted variable schema; validated semantically (422 on malformed). */
  variableSchema?: unknown;
}

/** Admin-supplied payload for publishing a template's working draft. */
export interface PublishTemplateInput {
  /**
   * Optional preview variables to validate the draft against before publish. When
   * absent, a type-correct sample is synthesized from the draft's schema so the
   * render is still exercised (AC#2).
   */
  previewVariables?: Record<string, unknown>;
}

type TemplateMetaPatch = Partial<
  Pick<NewEmailTemplate, "name" | "description" | "category" | "isActive">
>;

type VersionContentPatch = Partial<
  Pick<NewEmailTemplateVersion, "subject" | "bodySource" | "variableSchema" | "changelog">
>;

/** Collect the present template-row (metadata) fields from an update payload. */
function buildTemplateMetaPatch(input: UpdateTemplateInput): TemplateMetaPatch {
  const patch: TemplateMetaPatch = {};
  if (input.name !== undefined) {
    patch.name = input.name;
  }
  if (input.description !== undefined) {
    patch.description = input.description;
  }
  if (input.category !== undefined) {
    patch.category = input.category;
  }
  if (input.isActive !== undefined) {
    patch.isActive = input.isActive;
  }
  return patch;
}

/** Collect the present version-content fields from an update payload. */
function buildVersionContentPatch(
  input: UpdateTemplateInput,
  parsedSchema: TemplateVariableSchema | undefined,
): VersionContentPatch {
  const patch: VersionContentPatch = {};
  if (input.subject !== undefined) {
    patch.subject = input.subject;
  }
  if (input.bodySource !== undefined) {
    patch.bodySource = input.bodySource;
  }
  if (parsedSchema !== undefined) {
    patch.variableSchema = parsedSchema;
  }
  if (input.changelog !== undefined) {
    patch.changelog = input.changelog;
  }
  return patch;
}

/**
 * Build the values for a NEW draft version forked from the latest version,
 * applying the content patch over the base. Used when the latest version is
 * already published, so editing must not touch it (AC#1).
 */
function forkDraftValues(
  templateId: string,
  base: EmailTemplateVersion | null,
  patch: VersionContentPatch,
  actorUserId: string | null,
): NewEmailTemplateVersion {
  return {
    templateId,
    version: (base?.version ?? 0) + 1,
    subject: patch.subject ?? base?.subject ?? "",
    variableSchema: patch.variableSchema ?? base?.variableSchema ?? null,
    bodySource: "bodySource" in patch ? (patch.bodySource ?? null) : (base?.bodySource ?? null),
    status: "draft",
    changelog: patch.changelog ?? null,
    createdBy: actorUserId,
    publishedAt: null,
  };
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
        updatedAt: emailTemplates.updatedAt,
        currentVersion: emailTemplateVersions.version,
        currentStatus: emailTemplateVersions.status,
      })
      .from(emailTemplates)
      .leftJoin(
        emailTemplateVersions,
        eq(emailTemplates.currentVersionId, emailTemplateVersions.id),
      )
      .orderBy(emailTemplates.key);

    const summaries = await this.getSendSummaries(rows.map((row) => row.key));

    return rows.map((row) => ({
      key: row.key,
      name: row.name,
      description: row.description,
      category: row.category,
      isActive: row.isActive,
      renderer: resolveRenderer(row.key),
      currentVersion: row.currentVersion ?? null,
      currentStatus: row.currentStatus ?? null,
      updatedAt: row.updatedAt,
      lastSend: summaries.get(row.key) ?? emptySendSummary(),
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

  /**
   * Update a template (PB-NOTI-EMAIL-API-UPDATE-001 / BBR-659).
   *
   * Metadata changes patch the template row. Content changes
   * (subject/body/variableSchema/changelog) land on the working DRAFT version:
   * the latest version is edited in place when it is still a draft, otherwise a
   * NEW draft is forked from the latest (published) version. A published version
   * is therefore never mutated (AC: "수정은 기존 published 버전을 깨지 않고 새
   * draft/version으로 관리된다").
   *
   * - 404 when the key does not exist.
   * - 422 when `variableSchema` is malformed (same gate as create).
   */
  async updateTemplate(
    key: string,
    actorUserId: string | null,
    input: UpdateTemplateInput,
  ): Promise<TemplateDetailView> {
    const template = await this.findTemplateByKey(key);

    let parsedSchema: TemplateVariableSchema | undefined;
    if (input.variableSchema !== undefined) {
      const parsed = parseVariableSchemaInput(input.variableSchema);
      if (!parsed.valid) {
        throw new UnprocessableEntityException(
          `변수 스키마가 올바르지 않습니다. ${parsed.errors.join(" ")}`,
        );
      }
      parsedSchema = parsed.schema;
    }

    const metaPatch = buildTemplateMetaPatch(input);
    const contentPatch = buildVersionContentPatch(input, parsedSchema);
    const touchesMeta = Object.keys(metaPatch).length > 0;
    const touchesContent = Object.keys(contentPatch).length > 0;

    // The version to edit/fork is read before the write so the transaction body
    // only performs writes (and is simpler to reason about / mock).
    const latest = touchesContent ? await this.findLatestVersion(template.id) : null;

    await this.db.transaction(async (tx) => {
      if (touchesContent) {
        if (latest && latest.status === "draft") {
          await tx
            .update(emailTemplateVersions)
            .set(contentPatch)
            .where(eq(emailTemplateVersions.id, latest.id));
        } else {
          await tx
            .insert(emailTemplateVersions)
            .values(forkDraftValues(template.id, latest, contentPatch, actorUserId));
        }
      }

      // Patch (or touch) the template row so the list `updatedAt` reflects the edit.
      if (touchesMeta) {
        await tx.update(emailTemplates).set(metaPatch).where(eq(emailTemplates.id, template.id));
      } else if (touchesContent) {
        await tx
          .update(emailTemplates)
          .set({ updatedAt: new Date() })
          .where(eq(emailTemplates.id, template.id));
      }
    });

    return this.getTemplate(key);
  }

  /**
   * Publish a template's working draft (PB-NOTI-EMAIL-API-UPDATE-001 / BBR-659).
   *
   * Before publishing, the draft's variable schema and a preview render must pass
   * (AC: "발행 전 변수 스키마와 preview payload 검증이 통과해야 한다"):
   *   1. the stored `variableSchema` must be well-formed,
   *   2. the supplied (or synthesized) preview variables must satisfy it, and
   *   3. the subject + body must render with no unresolved placeholders.
   *
   * On success the draft becomes `published` and the template's
   * `currentVersionId` pointer moves to it. Previously-published versions stay
   * `published` so they remain available as rollback targets.
   *
   * - 404 when the key does not exist.
   * - 422 when there is no draft to publish, or any validation step fails.
   */
  async publishTemplate(key: string, input: PublishTemplateInput): Promise<TemplateDetailView> {
    const template = await this.findTemplateByKey(key);

    const draft = await this.findLatestDraft(template.id);
    if (!draft) {
      throw new UnprocessableEntityException(`발행할 draft 버전이 없습니다: ${key}`);
    }

    // AC#2 step 1 — the stored schema must be well-formed.
    const parsed = parseVariableSchemaInput(draft.variableSchema);
    if (!parsed.valid) {
      throw new UnprocessableEntityException(
        `변수 스키마가 올바르지 않습니다. ${parsed.errors.join(" ")}`,
      );
    }
    const schema = parsed.schema;

    // AC#2 step 2 — preview variables must satisfy the schema.
    const variables = input.previewVariables ?? buildSampleVariables(schema);
    const validation = validateTemplateVariables(schema, variables);
    if (!validation.valid) {
      throw new UnprocessableEntityException(
        `미리보기 변수 검증에 실패했습니다. ${summarizeValidationIssues(validation.issues)}`,
      );
    }

    // AC#2 step 3 — subject + body must render with no unresolved placeholders.
    const subjectResult = renderTemplateString(draft.subject, variables);
    if (subjectResult.missing.length > 0) {
      throw new UnprocessableEntityException(
        `제목에서 확인되지 않은 변수가 있습니다: ${subjectResult.missing.join(", ")}`,
      );
    }
    await this.assertDraftBodyRenders(template, draft, variables);

    const publishedAt = new Date();
    await this.db.transaction(async (tx) => {
      await tx
        .update(emailTemplateVersions)
        .set({ status: "published", publishedAt })
        .where(eq(emailTemplateVersions.id, draft.id));
      await tx
        .update(emailTemplates)
        .set({ currentVersionId: draft.id })
        .where(eq(emailTemplates.id, template.id));
    });

    return this.getTemplate(key);
  }

  /** Ensure a draft's body renders for the preview payload, else 422. */
  private async assertDraftBodyRenders(
    template: EmailTemplate,
    version: EmailTemplateVersion,
    variables: Record<string, unknown>,
  ): Promise<void> {
    const renderer = resolveRenderer(template.key);
    try {
      if (renderer) {
        await this.templateService.render(renderer, variables);
        return;
      }
      if (version.bodySource) {
        renderTemplateString(version.bodySource, variables);
        return;
      }
    } catch {
      throw new UnprocessableEntityException(
        `본문 미리보기 렌더링에 실패했습니다: ${template.key}`,
      );
    }
    throw new UnprocessableEntityException(
      `템플릿 "${template.key}"에 본문 렌더러 또는 본문 소스가 없어 발행할 수 없습니다.`,
    );
  }

  /** Latest version (any status) for a template, or null when it has none. */
  private async findLatestVersion(templateId: string): Promise<EmailTemplateVersion | null> {
    const [latest] = await this.db
      .select()
      .from(emailTemplateVersions)
      .where(eq(emailTemplateVersions.templateId, templateId))
      .orderBy(desc(emailTemplateVersions.version))
      .limit(1);
    return latest ?? null;
  }

  /** Highest-version draft for a template (the publishable working version). */
  private async findLatestDraft(templateId: string): Promise<EmailTemplateVersion | null> {
    const [draft] = await this.db
      .select()
      .from(emailTemplateVersions)
      .where(
        and(
          eq(emailTemplateVersions.templateId, templateId),
          eq(emailTemplateVersions.status, "draft"),
        ),
      )
      .orderBy(desc(emailTemplateVersions.version))
      .limit(1);
    return draft ?? null;
  }

  /** Map a template row + its version rows into the admin detail view. */
  private async toDetailView(
    template: EmailTemplate,
    versions: EmailTemplateVersion[],
  ): Promise<TemplateDetailView> {
    const current = versions.find((v) => v.id === template.currentVersionId) ?? null;
    const summaries = await this.getSendSummaries([template.key]);

    return {
      key: template.key,
      name: template.name,
      description: template.description,
      category: template.category,
      isActive: template.isActive,
      renderer: resolveRenderer(template.key),
      currentVersion: current?.version ?? null,
      currentStatus: current?.status ?? null,
      updatedAt: template.updatedAt,
      lastSend: summaries.get(template.key) ?? emptySendSummary(),
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

  /**
   * Build a per-key send-status summary from `email_logs` in a single grouped
   * query (one round-trip for the whole list — no N+1). Logs are attributed to a
   * template via `templateKey`; the most recently created log determines
   * `lastStatus` / `lastSentAt`.
   */
  private async getSendSummaries(keys: string[]): Promise<Map<string, EmailSendSummary>> {
    const summaries = new Map<string, EmailSendSummary>();
    if (keys.length === 0) {
      return summaries;
    }

    const rows = await this.db
      .select({
        templateKey: emailLogs.templateKey,
        status: emailLogs.status,
        count: count(),
        lastAt: max(emailLogs.createdAt),
      })
      .from(emailLogs)
      .where(inArray(emailLogs.templateKey, keys))
      .groupBy(emailLogs.templateKey, emailLogs.status);

    for (const row of rows) {
      if (!row.templateKey) {
        continue;
      }
      const summary = summaries.get(row.templateKey) ?? emptySendSummary();
      summary.totalCount += row.count;
      summary.statusCounts[row.status] = (summary.statusCounts[row.status] ?? 0) + row.count;
      if (row.lastAt && (!summary.lastSentAt || row.lastAt > summary.lastSentAt)) {
        summary.lastSentAt = row.lastAt;
        summary.lastStatus = row.status;
      }
      summaries.set(row.templateKey, summary);
    }

    return summaries;
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
