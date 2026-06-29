import { Body, Container, Head, Hr, Html, Img, Link, Section, Text } from "@react-email/components";
import type { ReactNode } from "react";
// biome-ignore lint/correctness/noUnusedImports: Nest server build uses the classic JSX transform.
import * as React from "react";

interface EmailLayoutProps {
  children: ReactNode;
}

/**
 * 공통 이메일 레이아웃
 */
export function EmailLayout({ children }: EmailLayoutProps) {
  const appUrl = process.env.APP_URL || "https://app.example.com";
  // logo.svg 는 landing (example.com) 의 public asset 이라 app domain 과 별개.
  // LANDING_URL 환경변수가 있으면 override 가능.
  const landingUrl = process.env.LANDING_URL || "https://example.com";
  const logoUrl = new URL("/logo.svg", landingUrl).toString();

  return (
    <Html>
      <Head />
      <Body style={main}>
        <Container style={container}>
          {/* 헤더 */}
          <Section style={header}>
            <Img src={logoUrl} width="40" height="40" alt="Product Builder" style={logo} />
          </Section>

          <Hr style={divider} />

          {/* 본문 */}
          <Section style={content}>{children}</Section>

          <Hr style={divider} />

          {/* 푸터 */}
          <Section style={footer}>
            <Text style={footerText}>
              © {new Date().getFullYear()} Product Builder. All rights reserved.
            </Text>
            <Text style={footerText}>
              <Link href={`${appUrl}/settings/email`} style={footerLink}>
                이메일 설정
              </Link>
              {" · "}
              <Link href={`${appUrl}/support`} style={footerLink}>
                고객 지원
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "20px 0 48px",
  marginBottom: "64px",
  maxWidth: "600px",
};

const header = {
  padding: "32px 48px",
};

const logo = {
  display: "block",
  margin: "0",
};

const divider = {
  borderColor: "#e6ebf1",
  margin: "0",
};

const content = {
  padding: "48px",
};

const footer = {
  padding: "32px 48px",
  textAlign: "center" as const,
};

const footerText = {
  fontSize: "12px",
  color: "#8898aa",
  lineHeight: "16px",
  margin: "4px 0",
};

const footerLink = {
  fontSize: "12px",
  color: "#6772e5",
  textDecoration: "underline",
};
