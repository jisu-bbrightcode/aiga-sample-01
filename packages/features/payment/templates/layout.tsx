import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type React from "react";

interface PaymentEmailLayoutProps {
  preview: string;
  children: React.ReactNode;
}

/**
 * 공통 결제 이메일 레이아웃.
 * - 로고는 텍스트 placeholder ("Product Builder") — 이미지 자산은 추후 교체.
 * - 푸터는 Resend C 정책에 따라 transactional 안내 문구만 표기.
 */
export function PaymentEmailLayout({
  preview,
  children,
}: PaymentEmailLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Text style={logo}>Product Builder</Text>
          </Section>

          <Hr style={divider} />

          <Section style={content}>{children}</Section>

          <Hr style={divider} />

          <Section style={footer}>
            <Text style={footerText}>결제 관련 안내 메일입니다.</Text>
            <Text style={footerText}>
              © {new Date().getFullYear()} Product Builder. All rights reserved.
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
  fontSize: "28px",
  fontWeight: "bold",
  color: "#000000",
  margin: "0",
};

const divider = {
  borderColor: "#e6ebf1",
  margin: "0",
};

const content = {
  padding: "32px 48px",
};

const footer = {
  padding: "24px 48px",
  textAlign: "center" as const,
};

const footerText = {
  fontSize: "12px",
  color: "#8898aa",
  lineHeight: "16px",
  margin: "4px 0",
};

export const sharedStyles = {
  heading: {
    fontSize: "22px",
    fontWeight: "bold",
    marginBottom: "16px",
    color: "#0a2540",
  },
  paragraph: {
    fontSize: "15px",
    lineHeight: "24px",
    marginBottom: "12px",
    color: "#425466",
  },
  detailRow: {
    fontSize: "14px",
    lineHeight: "22px",
    margin: "4px 0",
    color: "#525f7f",
  },
  button: {
    backgroundColor: "#5469d4",
    borderRadius: "4px",
    color: "#ffffff",
    fontSize: "15px",
    fontWeight: "bold",
    textDecoration: "none",
    textAlign: "center" as const,
    display: "block",
    padding: "12px 20px",
    margin: "20px 0",
  },
  warning: {
    fontSize: "14px",
    lineHeight: "22px",
    color: "#b54708",
    backgroundColor: "#fffaeb",
    padding: "12px 16px",
    borderRadius: "4px",
    margin: "16px 0",
  },
};

export function formatAmount(cents: number | undefined): string {
  return ((cents ?? 0) / 100).toFixed(2);
}

export function formatDate(d: Date | undefined): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}
