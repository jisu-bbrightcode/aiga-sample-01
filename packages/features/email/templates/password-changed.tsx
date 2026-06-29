import { Button, Heading, Text } from "@react-email/components";
// biome-ignore lint/correctness/noUnusedImports: Nest server build uses the classic JSX transform.
import * as React from "react";
import type { PasswordChangedVariables } from "../../common/types";
import { EmailLayout } from "./layout";

/**
 * 비밀번호 변경 완료 템플릿
 */
export function PasswordChangedEmail({
  userName,
  changedAt,
  supportUrl,
}: PasswordChangedVariables) {
  return (
    <EmailLayout>
      <Heading style={heading}>비밀번호가 변경되었습니다</Heading>

      <Text style={paragraph}>안녕하세요, {userName}님</Text>

      <Text style={paragraph}>Product Builder 계정의 비밀번호가 성공적으로 변경되었습니다.</Text>

      <Text style={infoBox}>변경 시각: {changedAt}</Text>

      <Text style={paragraph}>
        본인이 변경한 것이 아니라면 즉시 고객 지원으로 문의하고 계정 보안을 확인하세요.
      </Text>

      <Button href={supportUrl} style={button}>
        고객 지원 문의
      </Button>
    </EmailLayout>
  );
}

const heading = {
  fontSize: "24px",
  fontWeight: "bold",
  marginBottom: "24px",
  color: "#000000",
};

const paragraph = {
  fontSize: "16px",
  lineHeight: "24px",
  marginBottom: "16px",
  color: "#525f7f",
};

const infoBox = {
  backgroundColor: "#f6f9fc",
  border: "1px solid #e6ebf1",
  borderRadius: "4px",
  padding: "16px",
  fontSize: "14px",
  lineHeight: "20px",
  color: "#525f7f",
  margin: "24px 0",
};

const button = {
  backgroundColor: "#5469d4",
  borderRadius: "4px",
  color: "#fff",
  fontSize: "16px",
  fontWeight: "bold",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "block",
  padding: "12px 20px",
  margin: "24px 0",
};
