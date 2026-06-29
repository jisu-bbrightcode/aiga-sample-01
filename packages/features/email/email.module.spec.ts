import {
  resetAuthEmailVerificationSenderForTests,
  sendAuthVerificationEmail,
} from "@repo/core/auth/email-verification-sender";
import {
  resetAuthMagicLinkSenderForTests,
  sendAuthMagicLinkEmail,
} from "@repo/core/auth/magic-link-sender";
import {
  resetAuthOrganizationInvitationSenderForTests,
  sendAuthOrganizationInvitationEmail,
} from "@repo/core/auth/organization-invitation-sender";
import {
  resetAuthPasswordChangedSenderForTests,
  sendAuthPasswordChangedEmail,
} from "@repo/core/auth/password-changed-sender";
import {
  resetAuthPasswordResetSenderForTests,
  sendAuthPasswordResetEmail,
} from "@repo/core/auth/password-reset-sender";
import { EmailModule } from "./email.module";
import type { EmailService } from "./service/email.service";

afterEach(() => {
  resetAuthEmailVerificationSenderForTests();
  resetAuthMagicLinkSenderForTests();
  resetAuthOrganizationInvitationSenderForTests();
  resetAuthPasswordChangedSenderForTests();
  resetAuthPasswordResetSenderForTests();
});

describe("EmailModule", () => {
  it("injects EmailService into the Better Auth verification sender", async () => {
    const sendEmailVerification = jest.fn(async () => undefined);
    const module = new EmailModule({ sendEmailVerification } as unknown as EmailService);

    module.onModuleInit();

    await sendAuthVerificationEmail({
      user: { id: "user-1", email: "new@studio.com", name: "홍길동" },
      url: "http://localhost:3002/api/auth/verify-email?token=abc&callbackURL=/onboarding",
    });

    expect(sendEmailVerification).toHaveBeenCalledWith(
      { id: "user-1", email: "new@studio.com", name: "홍길동" },
      "http://localhost:3002/api/auth/verify-email?token=abc&callbackURL=/onboarding",
    );
  });

  it("injects EmailService into the Better Auth password reset sender", async () => {
    const sendPasswordResetEmail = jest.fn(async () => undefined);
    const module = new EmailModule({ sendPasswordResetEmail } as unknown as EmailService);

    module.onModuleInit();

    await sendAuthPasswordResetEmail({
      user: { id: "user-1", email: "reset@studio.com", name: "홍길동" },
      token: "reset-token",
      url: "http://localhost:3002/api/auth/reset-password/reset-token?callbackURL=/reset-password",
    });

    expect(sendPasswordResetEmail).toHaveBeenCalledWith(
      { id: "user-1", email: "reset@studio.com", name: "홍길동" },
      "http://localhost:3002/api/auth/reset-password/reset-token?callbackURL=/reset-password",
    );
  });

  it("injects EmailService into the Better Auth password changed sender", async () => {
    const sendPasswordChangedEmail = jest.fn(async () => undefined);
    const module = new EmailModule({ sendPasswordChangedEmail } as unknown as EmailService);

    module.onModuleInit();

    await sendAuthPasswordChangedEmail({
      user: { id: "user-1", email: "changed@studio.com", name: "홍길동" },
    });

    expect(sendPasswordChangedEmail).toHaveBeenCalledWith({
      id: "user-1",
      email: "changed@studio.com",
      name: "홍길동",
    });
  });

  it("injects EmailService into the Better Auth magic link sender", async () => {
    const sendMagicLinkEmail = jest.fn(async () => undefined);
    const module = new EmailModule({ sendMagicLinkEmail } as unknown as EmailService);

    module.onModuleInit();

    await sendAuthMagicLinkEmail({
      email: "magic@studio.com",
      token: "magic-token",
      url: "http://localhost:3002/api/auth/magic-link/verify?token=magic-token&callbackURL=/",
    });

    expect(sendMagicLinkEmail).toHaveBeenCalledWith(
      { email: "magic@studio.com" },
      "http://localhost:3002/api/auth/magic-link/verify?token=magic-token&callbackURL=/",
    );
  });

  it("injects EmailService into the Better Auth organization invitation sender", async () => {
    const sendOrganizationInvitationEmail = jest.fn(async () => undefined);
    const module = new EmailModule({
      sendOrganizationInvitationEmail,
    } as unknown as EmailService);

    module.onModuleInit();

    await sendAuthOrganizationInvitationEmail({
      id: "invitation-1",
      email: "teammate@studio.com",
      role: "member",
      organization: {
        id: "org-1",
        name: "Aethys Saga",
        slug: "aethys-saga",
      },
      inviter: {
        user: {
          id: "user-1",
          email: "owner@studio.com",
          name: "Jane Writer",
        },
      },
      invitation: { id: "invitation-1" },
    });

    expect(sendOrganizationInvitationEmail).toHaveBeenCalledWith({
      id: "invitation-1",
      email: "teammate@studio.com",
      role: "member",
      organization: {
        id: "org-1",
        name: "Aethys Saga",
        slug: "aethys-saga",
      },
      inviter: {
        user: {
          id: "user-1",
          email: "owner@studio.com",
          name: "Jane Writer",
        },
      },
      invitation: { id: "invitation-1" },
    });
  });
});
