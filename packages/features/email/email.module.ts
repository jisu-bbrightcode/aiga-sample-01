import { Module, type OnModuleInit } from "@nestjs/common";
import { injectAuthEmailVerificationSender } from "@repo/core/auth/email-verification-sender";
import { injectAuthMagicLinkSender } from "@repo/core/auth/magic-link-sender";
import { injectAuthOrganizationInvitationSender } from "@repo/core/auth/organization-invitation-sender";
import { injectAuthPasswordChangedSender } from "@repo/core/auth/password-changed-sender";
import { injectAuthPasswordResetSender } from "@repo/core/auth/password-reset-sender";
import { EmailController } from "./controller/email.controller";
import { ResendWebhookController } from "./controller/resend-webhook.controller";
import { DomainVerificationService } from "./service/domain-verification.service";
import { EmailService } from "./service/email.service";
import { EmailProviderService } from "./service/email-provider.service";
import { EmailTemplateService } from "./service/email-template.service";
import { injectEmailService } from "./service-registry";

/**
 * Email Feature Module
 *
 * 이메일 발송 및 로그 관리 기능을 제공
 */
@Module({
  controllers: [EmailController, ResendWebhookController],
  providers: [EmailService, EmailProviderService, EmailTemplateService, DomainVerificationService],
  exports: [EmailService, EmailTemplateService, DomainVerificationService],
})
export class EmailModule implements OnModuleInit {
  constructor(private readonly emailService: EmailService) {}

  onModuleInit() {
    // tRPC 라우터에 서비스 인스턴스 주입
    injectEmailService(this.emailService);
    // Better Auth 이메일 인증 콜백도 동일 EmailService/로그/템플릿 경로를 사용한다.
    injectAuthEmailVerificationSender({
      sendVerificationEmail: async ({ user, url }) => {
        await this.emailService.sendEmailVerification(
          {
            id: user.id,
            email: user.email,
            name: user.name ?? undefined,
          },
          url,
        );
      },
    });
    // Better Auth 비밀번호 재설정 콜백도 동일 EmailService/로그/템플릿 경로를 사용한다.
    injectAuthPasswordResetSender({
      sendPasswordResetEmail: async ({ user, url }) => {
        await this.emailService.sendPasswordResetEmail(
          {
            id: user.id,
            email: user.email,
            name: user.name ?? "사용자",
          },
          url,
        );
      },
    });
    // Better Auth 비밀번호 변경 완료 알림도 동일 EmailService/로그/템플릿 경로를 사용한다.
    injectAuthPasswordChangedSender({
      sendPasswordChangedEmail: async ({ user }) => {
        await this.emailService.sendPasswordChangedEmail({
          id: user.id,
          email: user.email,
          name: user.name ?? "사용자",
        });
      },
    });
    // Better Auth magic-link 로그인도 동일 EmailService/로그/템플릿 경로를 사용한다.
    injectAuthMagicLinkSender({
      sendMagicLinkEmail: async ({ email, url }) => {
        await this.emailService.sendMagicLinkEmail({ email }, url);
      },
    });
    // Better Auth organization 초대도 동일 EmailService/로그/템플릿 경로를 사용한다.
    injectAuthOrganizationInvitationSender({
      sendOrganizationInvitationEmail: async (input) => {
        await this.emailService.sendOrganizationInvitationEmail(input);
      },
    });
  }
}
