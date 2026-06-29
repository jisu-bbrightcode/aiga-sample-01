import type { EmailLog } from "@repo/drizzle/schema";
import { EmailService } from "./email.service";

class CapturingEmailService extends EmailService {
  sentInput: unknown;

  constructor() {
    super({} as never, {} as never, {} as never, {} as never);
  }

  override sendEmail(input: never): Promise<EmailLog> {
    this.sentInput = input;
    return Promise.resolve({ id: "email-log-1" } as EmailLog);
  }
}

describe("EmailService", () => {
  it("sendEmailVerification uses the Better Auth verification URL directly", async () => {
    const service = new CapturingEmailService();
    const verifyUrl =
      "http://localhost:3002/api/auth/verify-email?token=abc&callbackURL=/onboarding";

    await service.sendEmailVerification(
      { id: "user-1", email: "new@studio.com", name: "홍길동" },
      verifyUrl,
    );

    expect(service.sentInput).toEqual({
      recipientEmail: "new@studio.com",
      recipientName: "홍길동",
      recipientId: "user-1",
      templateType: "email-verification",
      subject: "[Product Builder] 이메일 주소 확인",
      variables: {
        userName: "홍길동",
        verifyUrl,
      },
    });
  });

  it("sendPasswordResetEmail uses the Better Auth reset URL directly", async () => {
    const service = new CapturingEmailService();
    const resetUrl =
      "http://localhost:3002/api/auth/reset-password/reset-token?callbackURL=/reset-password";

    await service.sendPasswordResetEmail(
      { id: "user-1", email: "reset@studio.com", name: "홍길동" },
      resetUrl,
    );

    expect(service.sentInput).toEqual({
      recipientEmail: "reset@studio.com",
      recipientName: "홍길동",
      recipientId: "user-1",
      templateType: "password-reset",
      subject: "비밀번호 재설정 요청",
      variables: {
        userName: "홍길동",
        resetUrl,
        expiresIn: "1시간",
      },
    });
  });

  it("sendPasswordChangedEmail sends a password changed notification", async () => {
    const service = new CapturingEmailService();

    await service.sendPasswordChangedEmail({
      id: "user-1",
      email: "changed@studio.com",
      name: "홍길동",
    });

    expect(service.sentInput).toEqual({
      recipientEmail: "changed@studio.com",
      recipientName: "홍길동",
      recipientId: "user-1",
      templateType: "password-changed",
      subject: "비밀번호가 변경되었습니다",
      variables: {
        userName: "홍길동",
        changedAt: expect.any(String),
        supportUrl: "http://localhost:3000/support",
      },
    });
  });

  it("sendMagicLinkEmail sends a sign-in notification link", async () => {
    const service = new CapturingEmailService();
    const magicLinkUrl =
      "http://localhost:3002/api/auth/magic-link/verify?token=magic-token&callbackURL=/";

    await service.sendMagicLinkEmail({ email: "magic@studio.com" }, magicLinkUrl);

    expect(service.sentInput).toEqual({
      recipientEmail: "magic@studio.com",
      recipientName: undefined,
      recipientId: undefined,
      templateType: "notification",
      subject: "Your Product Builder sign-in link",
      variables: {
        title: "Your Product Builder sign-in link",
        body: "Open this link to sign in to Product Builder. The link expires in 10 minutes and can be used once.",
        actionLabel: "Open Product Builder",
        actionUrl: magicLinkUrl,
      },
    });
  });

  it("sendOrganizationInvitationEmail sends an accept invitation notification", async () => {
    const service = new CapturingEmailService();

    await service.sendOrganizationInvitationEmail({
      id: "invitation-1",
      email: "teammate@studio.com",
      role: "member",
      organization: {
        id: "org-1",
        name: "Aethys Saga",
        slug: "aethys-saga",
      },
      invitation: {
        id: "invitation-1",
        email: "teammate@studio.com",
        role: "member",
        organizationId: "org-1",
      },
      inviter: {
        user: {
          id: "user-1",
          email: "owner@studio.com",
          name: "Jane Writer",
        },
      },
    });

    expect(service.sentInput).toEqual({
      recipientEmail: "teammate@studio.com",
      recipientName: undefined,
      recipientId: undefined,
      templateType: "notification",
      subject: "You're invited to Aethys Saga on Product Builder",
      variables: {
        title: "You're invited to Aethys Saga",
        body: "Jane Writer invited you to join Aethys Saga as member.",
        actionLabel: "Accept invitation",
        actionUrl: "http://localhost:3000/accept-invitation?id=invitation-1",
        invitationId: "invitation-1",
        organizationId: "org-1",
        organizationName: "Aethys Saga",
        organizationSlug: "aethys-saga",
        inviterName: "Jane Writer",
        inviterEmail: "owner@studio.com",
        role: "member",
      },
    });
  });

  it("sendOrganizationInvitationEmail uses the request origin when APP_URL is not configured", async () => {
    const originalAppUrl = process.env.APP_URL;
    delete process.env.APP_URL;

    try {
      const service = new CapturingEmailService();
      const input = {
        id: "invitation-1",
        email: "teammate@studio.com",
        role: "member",
        organization: {
          id: "org-1",
          name: "Aethys Saga",
          slug: "aethys-saga",
        },
        invitation: {
          id: "invitation-1",
          email: "teammate@studio.com",
          role: "member",
          organizationId: "org-1",
        },
        inviter: {
          user: {
            id: "user-1",
            email: "owner@studio.com",
            name: "Jane Writer",
          },
        },
        request: {
          headers: {
            get: (name: string) =>
              name.toLowerCase() === "origin" ? "http://localhost:3000" : null,
          },
        },
      };

      await service.sendOrganizationInvitationEmail(input);

      expect(service.sentInput).toEqual(
        expect.objectContaining({
          variables: expect.objectContaining({
            actionUrl: "http://localhost:3000/accept-invitation?id=invitation-1",
          }),
        }),
      );
    } finally {
      if (originalAppUrl === undefined) {
        delete process.env.APP_URL;
      } else {
        process.env.APP_URL = originalAppUrl;
      }
    }
  });

  it("sendOrganizationInvitationEmail prefers APP_URL over the request origin", async () => {
    const originalAppUrl = process.env.APP_URL;
    process.env.APP_URL = "https://dev.product-builder.test";

    try {
      const service = new CapturingEmailService();
      const input = {
        id: "invitation-1",
        email: "teammate@studio.com",
        role: "member",
        organization: {
          id: "org-1",
          name: "Aethys Saga",
          slug: "aethys-saga",
        },
        invitation: {
          id: "invitation-1",
          email: "teammate@studio.com",
          role: "member",
          organizationId: "org-1",
        },
        inviter: {
          user: {
            id: "user-1",
            email: "owner@studio.com",
            name: "Jane Writer",
          },
        },
        request: {
          headers: {
            get: (name: string) =>
              name.toLowerCase() === "origin" ? "http://localhost:3000" : null,
          },
        },
      };

      await service.sendOrganizationInvitationEmail(input);

      expect(service.sentInput).toEqual(
        expect.objectContaining({
          variables: expect.objectContaining({
            actionUrl: "https://dev.product-builder.test/accept-invitation?id=invitation-1",
          }),
        }),
      );
    } finally {
      if (originalAppUrl === undefined) {
        delete process.env.APP_URL;
      } else {
        process.env.APP_URL = originalAppUrl;
      }
    }
  });
});
