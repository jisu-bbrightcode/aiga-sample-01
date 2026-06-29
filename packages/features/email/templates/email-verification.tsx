import { Button, Heading, Text } from "@react-email/components";
// biome-ignore lint/correctness/noUnusedImports: Nest server build uses the classic JSX transform.
import * as React from "react";
import type { EmailVerificationVariables } from "../../common/types";
import { EmailLayout } from "./layout";

/**
 * 이메일 인증 템플릿
 */
export function EmailVerificationEmail({ userName, verifyUrl }: EmailVerificationVariables) {
  return (
    <EmailLayout>
      <Heading style={heading}>이메일 주소를 인증해주세요</Heading>

      <Text style={paragraph}>안녕하세요, {userName}님</Text>

      <Text style={paragraph}>
        Product Builder 계정의 이메일 주소를 인증하기 위해 아래 버튼을 클릭해주세요.
      </Text>

      <Button href={verifyUrl} style={button}>
        이메일 인증하기
      </Button>

      <Text style={paragraph}>
        버튼이 작동하지 않으면 아래 링크를 복사하여 브라우저에 붙여넣으세요:
      </Text>

      <Text style={link}>{verifyUrl}</Text>

      <Text style={footnote}>
        이 링크는 24시간 동안 유효합니다. 인증 요청을 하지 않으셨다면 이 이메일을 무시하세요.
      </Text>
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

const link = {
  fontSize: "14px",
  color: "#6772e5",
  wordBreak: "break-all" as const,
  marginBottom: "16px",
};

const footnote = {
  fontSize: "12px",
  lineHeight: "16px",
  marginTop: "32px",
  color: "#8898aa",
};
