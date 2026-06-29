import { Button, Heading, Text } from "@react-email/components";
import { PaymentEmailLayout, formatAmount, sharedStyles } from "./layout";

export interface TopUpCompletedProps {
  credits: number;
  amountCents: number;
  newBalance: number;
}

export const topUpCompletedSubject = (props: TopUpCompletedProps): string =>
  `[Product Builder] 크레딧 충전 완료 — ${props.credits}cr`;

export function TopUpCompletedEmail(props: TopUpCompletedProps) {
  const { credits, amountCents, newBalance } = props;
  const usageUrl = `${process.env.APP_URL ?? "https://example.com"}/billing/usage`;
  return (
    <PaymentEmailLayout
      preview={`크레딧 ${credits}개가 정상 충전되었습니다.`}
    >
      <Heading style={sharedStyles.heading}>크레딧 충전 완료</Heading>
      <Text style={sharedStyles.paragraph}>
        크레딧 충전이 정상적으로 처리되었습니다.
      </Text>
      <Text style={sharedStyles.detailRow}>{`충전 크레딧: ${credits}cr`}</Text>
      <Text style={sharedStyles.detailRow}>{`결제 금액: $${formatAmount(amountCents)}`}</Text>
      <Text style={sharedStyles.detailRow}>{`충전 후 잔액: ${newBalance}cr`}</Text>
      <Button href={usageUrl} style={sharedStyles.button}>
        사용량 보기
      </Button>
    </PaymentEmailLayout>
  );
}
