import { EmailTemplateService } from "./email-template.service";

describe("EmailTemplateService", () => {
  it("renders the email verification template to HTML", async () => {
    const service = new EmailTemplateService();

    const html = await service.render("email-verification", {
      userName: "High Read",
      verifyUrl: "http://localhost:3002/api/auth/verify-email?token=test",
    });

    expect(html).toContain("이메일 주소를 인증해주세요");
    expect(html).toContain("http://localhost:3002/api/auth/verify-email?token=test");
    expect(html).toContain("https://example.com/logo.svg");
  });

  it("renders all auth email templates without runtime React globals", async () => {
    const service = new EmailTemplateService();

    await expect(
      service.render("welcome", {
        userName: "High Read",
        loginUrl: "https://product-builder.app/login",
      }),
    ).resolves.toContain("환영합니다");

    await expect(
      service.render("password-reset", {
        userName: "High Read",
        resetUrl: "https://product-builder.app/reset-password?token=test",
        expiresIn: "1시간",
      }),
    ).resolves.toContain("비밀번호 재설정 요청");

    await expect(
      service.render("password-changed", {
        userName: "High Read",
        changedAt: "2026. 5. 6. 오후 7:20:00",
        supportUrl: "https://product-builder.app/support",
      }),
    ).resolves.toContain("비밀번호가 변경되었습니다");

    await expect(
      service.render("notification", {
        title: "Your Product Builder sign-in link",
        body: "Open this link to sign in to Product Builder.",
        actionLabel: "Open Product Builder",
        actionUrl: "http://localhost:3002/api/auth/magic-link/verify?token=test",
      }),
    ).resolves.toContain("Your Product Builder sign-in link");
  });
});
