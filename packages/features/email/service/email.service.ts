import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import type { AuthOrganizationInvitationInput } from "@repo/core/auth/organization-invitation-sender";
import type { DrizzleDB } from "@repo/drizzle";
import { InjectDrizzle } from "@repo/drizzle";
import type { EmailLog, EmailStatus, EmailTemplateType } from "@repo/drizzle/schema";
import { emailLogs } from "@repo/drizzle/schema";
import { and, desc, eq, gte, ilike, type SQL } from "drizzle-orm";
import type {
  EmailLogsFilters,
  SendEmailInput,
  SendTemplateEmailInput,
  TestSendEmailInput,
} from "../../common/types";
import { buildSampleVariables } from "../template-registry";
import type { ResendWebhookPayload } from "../webhooks/resend.payload.schema";
import { mapResendEvent, resolveStatusUpdate } from "../webhooks/resend-event-mapper";
import { EmailProviderService } from "./email-provider.service";
import { EmailTemplateService } from "./email-template.service";
import {
  EmailTemplateRegistryService,
  type RenderedTemplate,
} from "./email-template-registry.service";

/** Postgres unique-constraint violation (e.g. concurrent idempotency-key insert). */
const PG_UNIQUE_VIOLATION = "23505";
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === PG_UNIQUE_VIOLATION
  );
}

/** Test-send rate limit: at most N sends per (template, recipient) per window. */
const TEST_SEND_RATE_LIMIT = 5;
const TEST_SEND_RATE_WINDOW_MS = 60 * 1000;

/**
 * Email Service
 *
 * 이메일 발송 및 로그 관리를 담당하는 핵심 서비스
 */
@Injectable()
export class EmailService {
  constructor(
    @InjectDrizzle() private readonly db: DrizzleDB,
    private readonly providerService: EmailProviderService,
    private readonly templateService: EmailTemplateService,
    private readonly templateRegistry: EmailTemplateRegistryService,
  ) {}

  /**
   * 이메일 발송 (메인 메서드)
   */
  async sendEmail(input: SendEmailInput): Promise<EmailLog> {
    // 1. 중복 발송 체크 (1분 이내)
    await this.checkDuplicateSend(input.recipientEmail, input.templateType);

    // 2. 템플릿 렌더링
    const html = await this.templateService.render(input.templateType, input.variables);

    // 3. 로그 생성
    const [log] = await this.db
      .insert(emailLogs)
      .values({
        recipientEmail: input.recipientEmail,
        recipientName: input.recipientName,
        recipientId: input.recipientId,
        templateType: input.templateType,
        subject: input.subject,
        status: "pending",
        metadata: input.variables,
      })
      .returning();

    if (!log) {
      throw new InternalServerErrorException("이메일 로그 생성에 실패했습니다");
    }

    // 4. 발송 시도
    try {
      const result = await this.providerService.send({
        to: input.recipientEmail,
        subject: input.subject,
        html,
      });

      // 5. 발송 성공 시 로그 업데이트
      await this.updateLogStatus(log.id, {
        status: "sent",
        sentAt: new Date(),
        providerMessageId: result.messageId,
      });
    } catch (error) {
      // 6. 발송 실패 시 로그 업데이트
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      await this.updateLogStatus(log.id, {
        status: "failed",
        failureReason: errorMessage,
        retryCount: log.retryCount + 1,
      });

      console.error(`[EmailService] Email send failed: ${log.id}`, error);

      throw error;
    }

    return log;
  }

  /**
   * 템플릿 키 기반 발송 (PB-NOTI-EMAIL-TEMPLATE-001 / BBR-656)
   *
   * 게시(published)된 템플릿 버전을 조회하고, 변수 스키마 검증을 **발송 전에**
   * 수행한다. 누락/타입 불일치가 있으면 provider 호출 이전에 BadRequest 로 실패한다.
   * subject/body 는 레지스트리에서 렌더링하고, 로그에 templateKey/templateVersionId 를
   * 함께 남겨 어떤 버전으로 발송했는지 추적한다.
   */
  async sendByKey(input: SendTemplateEmailInput): Promise<EmailLog> {
    // 1. 게시 버전 조회 + 변수 검증 + subject/body 렌더링 (검증 실패 시 여기서 throw)
    const rendered = await this.templateRegistry.renderByKey(input.key, input.variables, {
      requireValid: true,
    });

    if (!rendered.renderer) {
      throw new BadRequestException(`템플릿 "${input.key}"는 발송 가능한 본문 렌더러가 없습니다.`);
    }

    // 2. 멱등성 가드 (AC: 중복 발송 방지). idempotencyKey 가 주어지면 동일 키로
    //    기록된 이전 발송을 그대로 반환해 재발송하지 않는다. 키가 없으면 기존
    //    수신자+타입 1분 중복 윈도우(equivalent guard)로 폴백한다.
    if (input.idempotencyKey) {
      const existing = await this.findLogByIdempotencyKey(input.idempotencyKey);
      if (existing) {
        return existing;
      }
    } else {
      await this.checkDuplicateSend(input.recipientEmail, rendered.renderer);
    }

    // 3. 로그 생성 + provider 발송 + 상태 갱신
    try {
      return await this.dispatchRendered(
        {
          rendered,
          recipientEmail: input.recipientEmail,
          recipientName: input.recipientName,
          recipientId: input.recipientId,
          metadata: input.variables,
          idempotencyKey: input.idempotencyKey,
        },
        { rethrowOnFailure: true },
      );
    } catch (error) {
      // 동시에 같은 키로 들어온 발송이 unique index 에서 충돌하면 패배한 쪽은
      // 멱등 처리: 500 대신 이미 기록된 로그를 반환한다.
      if (input.idempotencyKey && isUniqueViolation(error)) {
        const existing = await this.findLogByIdempotencyKey(input.idempotencyKey);
        if (existing) {
          return existing;
        }
      }
      throw error;
    }
  }

  /**
   * 운영자 테스트 발송 (PB-NOTI-EMAIL-SEND-001 / BBR-661).
   *
   * 게시된 템플릿을 렌더링해 실제 provider 로 발송하고 결과를 발송 이력에 남긴다
   * (AC: 운영자가 테스트 발송 수행 + 결과/provider id/실패 사유 기록). 변수를
   * 주지 않으면 스키마에서 타입에 맞는 샘플을 합성한다. 테스트 발송은 중복 발송
   * 윈도우를 우회하되, 같은 (템플릿, 수신자) 기준 rate limit 을 적용한다. provider
   * 실패 시에도 throw 하지 않고 실패가 기록된 로그를 반환해 운영자가 사유를 본다.
   */
  async sendTestEmail(input: TestSendEmailInput): Promise<EmailLog> {
    // 1. rate limit (운영자가 반복 테스트로 provider 를 폭주시키지 않도록)
    await this.assertTestSendRate(input.key, input.recipientEmail);

    // 2. 변수 확정: 주어진 변수가 없으면 게시 스키마에서 샘플 합성
    let variables = input.variables;
    if (!variables) {
      const resolved = await this.templateRegistry.resolvePublishedVersion(input.key);
      variables = buildSampleVariables(resolved.schema);
    }

    // 3. 렌더링 (발송 전 검증; 검증 실패 시 throw)
    const rendered = await this.templateRegistry.renderByKey(input.key, variables, {
      requireValid: true,
    });
    if (!rendered.renderer) {
      throw new BadRequestException(`템플릿 "${input.key}"는 발송 가능한 본문 렌더러가 없습니다.`);
    }

    // 4. 발송 + 기록 (중복 윈도우 우회, 실패해도 로그 반환)
    return this.dispatchRendered(
      {
        rendered,
        recipientEmail: input.recipientEmail,
        recipientName: input.recipientName,
        metadata: { ...variables, test: true, sentBy: input.actorUserId ?? null },
        idempotencyKey: input.idempotencyKey,
      },
      { rethrowOnFailure: false },
    );
  }

  /**
   * 렌더링된 이메일을 로그로 남기고 provider 로 발송한 뒤 상태를 갱신한다.
   * sendByKey / sendTestEmail 공통 경로. `rethrowOnFailure` 가 true 면 provider
   * 실패를 그대로 throw 하고(트랜잭션 발송), false 면 실패가 기록된 로그를 반환한다
   * (테스트 발송).
   */
  private async dispatchRendered(
    params: {
      rendered: RenderedTemplate;
      recipientEmail: string;
      recipientName?: string | null;
      recipientId?: string;
      metadata: Record<string, unknown>;
      idempotencyKey?: string;
    },
    options: { rethrowOnFailure: boolean },
  ): Promise<EmailLog> {
    const { rendered, recipientEmail, recipientName, recipientId, metadata, idempotencyKey } =
      params;
    const renderer = rendered.renderer;
    if (!renderer) {
      throw new InternalServerErrorException("본문 렌더러가 없는 템플릿은 발송할 수 없습니다.");
    }

    const [log] = await this.db
      .insert(emailLogs)
      .values({
        recipientEmail,
        recipientName,
        recipientId,
        templateType: renderer,
        templateKey: rendered.key,
        templateVersionId: rendered.templateVersionId,
        subject: rendered.subject,
        status: "pending",
        idempotencyKey: idempotencyKey ?? null,
        metadata,
      })
      .returning();

    if (!log) {
      throw new InternalServerErrorException("이메일 로그 생성에 실패했습니다");
    }

    try {
      const result = await this.providerService.send({
        to: recipientEmail,
        subject: rendered.subject,
        html: rendered.html,
      });

      const update: Partial<EmailLog> = {
        status: "sent",
        sentAt: new Date(),
        providerMessageId: result.messageId,
      };
      await this.updateLogStatus(log.id, update);
      return { ...log, ...update };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const update: Partial<EmailLog> = {
        status: "failed",
        failureReason: errorMessage,
        retryCount: log.retryCount + 1,
      };
      await this.updateLogStatus(log.id, update);

      console.error(`[EmailService] dispatch failed: ${log.id}`, error);

      if (options.rethrowOnFailure) {
        throw error;
      }
      return { ...log, ...update };
    }
  }

  /**
   * 환영 이메일 발송
   */
  sendWelcomeEmail(user: { email: string; name: string; id?: string }): Promise<EmailLog> {
    const appUrl = process.env.APP_URL || "http://localhost:3000";

    return this.sendEmail({
      recipientEmail: user.email,
      recipientName: user.name,
      recipientId: user.id,
      templateType: "welcome",
      subject: `${user.name}님, 환영합니다!`,
      variables: {
        userName: user.name,
        loginUrl: `${appUrl}/login`,
      },
    });
  }

  /**
   * 비밀번호 재설정 이메일 발송
   */
  sendPasswordResetEmail(
    user: { email: string; name: string; id?: string },
    resetUrl: string,
  ): Promise<EmailLog> {
    return this.sendEmail({
      recipientEmail: user.email,
      recipientName: user.name,
      recipientId: user.id,
      templateType: "password-reset",
      subject: "비밀번호 재설정 요청",
      variables: {
        userName: user.name,
        resetUrl,
        expiresIn: "1시간",
      },
    });
  }

  /**
   * 비밀번호 변경 완료 이메일 발송
   */
  sendPasswordChangedEmail(user: { email: string; name: string; id?: string }): Promise<EmailLog> {
    const appUrl = process.env.APP_URL || "http://localhost:3000";

    return this.sendEmail({
      recipientEmail: user.email,
      recipientName: user.name,
      recipientId: user.id,
      templateType: "password-changed",
      subject: "비밀번호가 변경되었습니다",
      variables: {
        userName: user.name,
        changedAt: new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }),
        supportUrl: `${appUrl}/support`,
      },
    });
  }

  /**
   * Magic Link 로그인 이메일 발송
   */
  sendMagicLinkEmail(
    user: { email: string; name?: string | null; id?: string },
    magicLinkUrl: string,
  ) {
    return this.sendEmail({
      recipientEmail: user.email,
      recipientName: user.name,
      recipientId: user.id,
      templateType: "notification",
      subject: "Your Product Builder sign-in link",
      variables: {
        title: "Your Product Builder sign-in link",
        body: "Open this link to sign in to Product Builder. The link expires in 10 minutes and can be used once.",
        actionLabel: "Open Product Builder",
        actionUrl: magicLinkUrl,
      },
    });
  }

  /**
   * 워크스페이스 초대 이메일 발송
   */
  sendOrganizationInvitationEmail(input: AuthOrganizationInvitationInput): Promise<EmailLog> {
    const invitationUrl = this.buildInvitationUrl(input.id, input.request);
    const organizationName = input.organization.name;
    const inviterName = input.inviter.user.name || input.inviter.user.email;

    return this.sendEmail({
      recipientEmail: input.email,
      recipientName: undefined,
      recipientId: undefined,
      templateType: "notification",
      subject: `You're invited to ${organizationName} on Product Builder`,
      variables: {
        title: `You're invited to ${organizationName}`,
        body: `${inviterName} invited you to join ${organizationName} as ${input.role}.`,
        actionLabel: "Accept invitation",
        actionUrl: invitationUrl,
        invitationId: input.id,
        organizationId: input.organization.id,
        organizationName,
        organizationSlug: input.organization.slug ?? null,
        inviterName,
        inviterEmail: input.inviter.user.email,
        role: input.role,
      },
    });
  }

  /**
   * 이메일 인증 발송
   */
  sendEmailVerification(
    user: { email: string; name?: string | null; id?: string },
    verificationUrl: string,
  ): Promise<EmailLog> {
    const userName = user.name || "사용자";

    return this.sendEmail({
      recipientEmail: user.email,
      recipientName: user.name,
      recipientId: user.id,
      templateType: "email-verification",
      subject: "[Product Builder] 이메일 주소 확인",
      variables: {
        userName,
        verifyUrl: verificationUrl,
      },
    });
  }

  /**
   * 이메일 로그 조회 (관리자)
   */
  async getEmailLogs(filters: EmailLogsFilters): Promise<EmailLog[]> {
    const { page = 1, limit = 20, status, templateType, search } = filters;

    const conditions: SQL[] = [];

    if (status) {
      conditions.push(eq(emailLogs.status, status));
    }
    if (templateType) {
      conditions.push(eq(emailLogs.templateType, templateType));
    }
    if (search) {
      conditions.push(ilike(emailLogs.recipientEmail, `%${search}%`));
    }

    const logs = await this.db
      .select()
      .from(emailLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .limit(limit)
      .offset((page - 1) * limit)
      .orderBy(desc(emailLogs.createdAt));

    return logs;
  }

  /**
   * 이메일 로그 상세 조회
   */
  async getEmailLog(logId: string): Promise<EmailLog | null> {
    const [log] = await this.db.select().from(emailLogs).where(eq(emailLogs.id, logId)).limit(1);

    return log || null;
  }

  /**
   * 이메일 재발송 (관리자)
   */
  async resendEmail(logId: string): Promise<EmailLog> {
    const log = await this.getEmailLog(logId);

    if (!log) {
      throw new NotFoundException("이메일 로그를 찾을 수 없습니다");
    }

    const html = await this.templateService.render(
      log.templateType,
      (log.metadata as Record<string, unknown>) || {},
    );

    try {
      const result = await this.providerService.send({
        to: log.recipientEmail,
        subject: log.subject,
        html,
      });

      await this.updateLogStatus(log.id, {
        status: "sent",
        sentAt: new Date(),
        providerMessageId: result.messageId,
        retryCount: log.retryCount + 1,
      });

      const updatedLog = await this.getEmailLog(log.id);
      if (!updatedLog) {
        throw new InternalServerErrorException("이메일 로그 업데이트 결과를 찾을 수 없습니다");
      }
      return updatedLog;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      await this.updateLogStatus(log.id, {
        status: "failed",
        failureReason: errorMessage,
        retryCount: log.retryCount + 1,
      });

      throw error;
    }
  }

  /**
   * Resend webhook 이벤트 반영 (bounce/complaint/delivered/opened)
   *
   * providerMessageId(= Resend email_id)로 로그를 찾아 상태를 갱신한다.
   * 상태는 역행하지 않으며(opened 이벤트가 bounced 를 덮어쓰지 않음),
   * 일치하는 로그가 없으면 matched:false 로 조용히 무시한다(재시도 폭주 방지).
   */
  async recordProviderEvent(
    payload: ResendWebhookPayload,
  ): Promise<{ matched: boolean; status?: EmailStatus }> {
    const mapped = mapResendEvent(payload);
    if (!mapped) {
      return { matched: false };
    }

    const [log] = await this.db
      .select()
      .from(emailLogs)
      .where(eq(emailLogs.providerMessageId, mapped.emailId))
      .limit(1);

    if (!log) {
      return { matched: false };
    }

    const nextStatus = resolveStatusUpdate(log.status, mapped.desiredStatus);
    const update: Partial<EmailLog> = {};

    if (nextStatus) {
      update.status = nextStatus;
    }
    if (mapped.failureReason) {
      update.failureReason = mapped.failureReason;
    }
    if (mapped.setDeliveredAt && !log.deliveredAt) {
      update.deliveredAt = new Date();
    }
    if (mapped.setOpenedAt && !log.openedAt) {
      update.openedAt = new Date();
    }
    update.metadata = {
      ...((log.metadata as Record<string, unknown> | null) ?? {}),
      lastProviderEvent: mapped.eventType,
    };

    await this.updateLogStatus(log.id, update);

    return { matched: true, status: nextStatus ?? log.status };
  }

  /**
   * 중복 발송 체크
   */
  private async checkDuplicateSend(email: string, templateType: EmailTemplateType): Promise<void> {
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);

    const [recentLog] = await this.db
      .select()
      .from(emailLogs)
      .where(
        and(
          eq(emailLogs.recipientEmail, email),
          eq(emailLogs.templateType, templateType),
          gte(emailLogs.createdAt, oneMinuteAgo),
        ),
      )
      .limit(1);

    if (recentLog) {
      throw new ConflictException("이미 발송된 이메일이 있습니다. 1분 후 다시 시도해주세요.");
    }
  }

  /** idempotencyKey 로 기록된 발송 로그를 조회한다 (없으면 null). */
  private async findLogByIdempotencyKey(idempotencyKey: string): Promise<EmailLog | null> {
    const [log] = await this.db
      .select()
      .from(emailLogs)
      .where(eq(emailLogs.idempotencyKey, idempotencyKey))
      .limit(1);

    return log ?? null;
  }

  /**
   * 테스트 발송 rate limit (AC: rate limit). 같은 (템플릿 키, 수신자) 조합으로
   * 윈도우 안에 누적된 발송이 한도 이상이면 429 로 거부한다.
   */
  private async assertTestSendRate(key: string, recipientEmail: string): Promise<void> {
    const windowStart = new Date(Date.now() - TEST_SEND_RATE_WINDOW_MS);

    const recent = await this.db
      .select({ id: emailLogs.id })
      .from(emailLogs)
      .where(
        and(
          eq(emailLogs.templateKey, key),
          eq(emailLogs.recipientEmail, recipientEmail),
          gte(emailLogs.createdAt, windowStart),
        ),
      )
      .limit(TEST_SEND_RATE_LIMIT);

    if (recent.length >= TEST_SEND_RATE_LIMIT) {
      throw new HttpException(
        "테스트 발송이 너무 잦습니다. 잠시 후 다시 시도해주세요.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /**
   * 로그 상태 업데이트
   */
  private async updateLogStatus(logId: string, update: Partial<EmailLog>): Promise<void> {
    await this.db
      .update(emailLogs)
      .set({ ...update, updatedAt: new Date() })
      .where(eq(emailLogs.id, logId));
  }

  private buildInvitationUrl(
    invitationId: string,
    request?: AuthOrganizationInvitationInput["request"],
  ): string {
    const appUrl = this.resolveInvitationAppUrl(request);
    const url = new URL("/accept-invitation", appUrl);
    url.searchParams.set("id", invitationId);
    return url.toString();
  }

  private resolveInvitationAppUrl(request?: AuthOrganizationInvitationInput["request"]): string {
    const configuredAppUrl = process.env.APP_URL?.trim();
    if (configuredAppUrl) {
      return configuredAppUrl;
    }

    const origin = this.readHeaderOrigin(request, "origin");
    if (origin) {
      return origin;
    }

    const referer = this.readHeaderOrigin(request, "referer");
    if (referer) {
      return referer;
    }

    const forwardedHost = request?.headers?.get("x-forwarded-host")?.trim();
    if (forwardedHost) {
      const proto = request?.headers?.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
      return `${proto}://${forwardedHost.split(",")[0]?.trim()}`;
    }

    if (request?.url) {
      const requestOrigin = this.readUrlOrigin(request.url);
      if (requestOrigin) {
        return requestOrigin;
      }
    }

    return "http://localhost:3000";
  }

  private readHeaderOrigin(
    request: AuthOrganizationInvitationInput["request"] | undefined,
    headerName: string,
  ): string | null {
    const value = request?.headers?.get(headerName)?.trim();
    if (!value) {
      return null;
    }
    return this.readUrlOrigin(value);
  }

  private readUrlOrigin(value: string): string | null {
    try {
      return new URL(value).origin;
    } catch {
      return null;
    }
  }
}
