import { Button, Heading, Text } from "@react-email/components";
// biome-ignore lint/correctness/noUnusedImports: Nest server build uses the classic JSX transform.
import * as React from "react";
import type { NotificationEmailVariables } from "../../common/types";
import { EmailLayout } from "./layout";

/**
 * 일반 알림 템플릿
 */
export function NotificationEmail({
  actionLabel,
  actionUrl,
  body,
  title,
}: NotificationEmailVariables) {
  return (
    <EmailLayout>
      <Heading style={heading}>{title}</Heading>

      <Text style={paragraph}>{body}</Text>

      {actionUrl && actionLabel ? (
        <Button href={actionUrl} style={button}>
          {actionLabel}
        </Button>
      ) : null}

      {actionUrl ? <Text style={link}>{actionUrl}</Text> : null}
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
