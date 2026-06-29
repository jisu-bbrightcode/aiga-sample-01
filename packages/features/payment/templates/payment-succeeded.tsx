import { Heading, Text } from "@react-email/components";
import {
  PaymentEmailLayout,
  formatAmount,
  formatDate,
  sharedStyles,
} from "./layout";

export interface PaymentSucceededProps {
  planName: string;
  amountCents: number;
  nextBillingDate?: Date;
  userName?: string;
}

export const paymentSucceededSubject = (props: PaymentSucceededProps): string =>
  `[Product Builder] 결제 완료 — ${props.planName}`;

export function PaymentSucceededEmail(props: PaymentSucceededProps) {
  const { planName, amountCents, nextBillingDate, userName } = props;
  return (
    <PaymentEmailLayout preview={`${planName} 결제가 정상 처리되었습니다.`}>
      <Heading style={sharedStyles.heading}>결제 완료</Heading>
      <Text style={sharedStyles.paragraph}>
        {`${userName ? `${userName}님, ` : ""}${planName} 구독 결제가 정상적으로 처리되었습니다.`}
      </Text>
      <Text style={sharedStyles.detailRow}>{`플랜: ${planName}`}</Text>
      <Text style={sharedStyles.detailRow}>{`결제 금액: $${formatAmount(amountCents)}`}</Text>
      {nextBillingDate ? (
        <Text style={sharedStyles.detailRow}>{`다음 결제 예정일: ${formatDate(nextBillingDate)}`}</Text>
      ) : null}
      <Text style={sharedStyles.paragraph}>
        영수증과 사용량은 대시보드의 결제 내역에서 확인하실 수 있습니다.
      </Text>
    </PaymentEmailLayout>
  );
}
