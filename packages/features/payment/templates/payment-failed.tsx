import { Button, Heading, Text } from "@react-email/components";
import { PaymentEmailLayout, formatDate, sharedStyles } from "./layout";

export interface PaymentFailedProps {
  planName?: string;
  reason?: string;
  gracePeriodEndsAt?: Date;
  retryUrl?: string;
}

export const paymentFailedSubject = (_props: PaymentFailedProps): string =>
  `[Product Builder] 결제 실패 — 카드 정보를 확인해주세요`;

export function PaymentFailedEmail(props: PaymentFailedProps) {
  const { planName, reason, gracePeriodEndsAt, retryUrl } = props;
  return (
    <PaymentEmailLayout
      preview="결제가 실패했습니다. 결제 수단을 확인해주세요."
    >
      <Heading style={sharedStyles.heading}>결제 실패</Heading>
      <Text style={sharedStyles.paragraph}>
        {`${planName ? `${planName} 구독의 ` : ""}자동 결제가 실패했습니다. 결제 수단(카드 정보)을 확인하고 다시 시도해주세요.`}
      </Text>
      {reason ? (
        <Text style={sharedStyles.detailRow}>{`실패 사유: ${reason}`}</Text>
      ) : null}
      {gracePeriodEndsAt ? (
        <Text style={sharedStyles.warning}>
          {`${formatDate(gracePeriodEndsAt)}까지 결제가 정상화되지 않으면 서비스가 일시 제한됩니다.`}
        </Text>
      ) : null}
      {retryUrl ? (
        <Button href={retryUrl} style={sharedStyles.button}>
          결제 수단 업데이트
        </Button>
      ) : null}
    </PaymentEmailLayout>
  );
}
