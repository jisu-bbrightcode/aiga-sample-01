import { Heading, Text } from "@react-email/components";
import { PaymentEmailLayout, formatAmount, sharedStyles } from "./layout";

export interface RefundCompletedProps {
  amountCents: number;
  refundId: string;
  reason?: string;
}

export const refundCompletedSubject = (_props: RefundCompletedProps): string =>
  `[Product Builder] 환불 완료`;

export function RefundCompletedEmail(props: RefundCompletedProps) {
  const { amountCents, refundId, reason } = props;
  return (
    <PaymentEmailLayout preview="환불이 정상적으로 처리되었습니다.">
      <Heading style={sharedStyles.heading}>환불 완료</Heading>
      <Text style={sharedStyles.paragraph}>
        요청하신 환불이 정상적으로 처리되었습니다.
      </Text>
      <Text style={sharedStyles.detailRow}>{`환불 금액: $${formatAmount(amountCents)}`}</Text>
      <Text style={sharedStyles.detailRow}>{`환불 ID: ${refundId}`}</Text>
      {reason ? (
        <Text style={sharedStyles.detailRow}>{`사유: ${reason}`}</Text>
      ) : null}
      <Text style={sharedStyles.paragraph}>
        카드 결제 환불은 영업일 기준 3~5일 이내에 명세서에 반영됩니다.
      </Text>
    </PaymentEmailLayout>
  );
}
