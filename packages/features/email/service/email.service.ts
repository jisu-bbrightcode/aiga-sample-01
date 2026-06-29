import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import type { AuthOrganizationInvitationInput } from "@repo/core/auth/organization-invitation-sender";
import type { DrizzleDB } from "@repo/drizzle";
import { InjectDrizzle } from "@repo/drizzle";
import type { EmailLog, EmailTemplateType } from "@repo/drizzle/schema";
import { emailLogs } from "@repo/drizzle/schema";
import { and, desc, eq, gte, ilike, type SQL } from "drizzle-orm";
import type { EmailLogsFilters, SendEmailInput } from "../../common/types";
import { EmailProviderService } from "./email-provider.service";
import { EmailTemplateService } from "./email-template.service";

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
