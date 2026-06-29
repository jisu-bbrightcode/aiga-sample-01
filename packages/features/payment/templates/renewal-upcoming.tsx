import { Heading, Text } from "@react-email/components";
import {
  PaymentEmailLayout,
  formatAmount,
  formatDate,
  sharedStyles,
} from "./layout";

export interface RenewalUpcomingProps {
  planName: string;
  amountCents: number;
  renewsAt: Date;
}

export const renewalUpcomingSubject = (_props: RenewalUpcomingProps): string =>
  `[Product Builder] 7일 후 자동 갱신 안내`;

export function RenewalUpcomingEmail(props: RenewalUpcomingProps) {
  const { planName, amountCents, renewsAt } = props;
  return (
    <PaymentEmailLayout
      preview={`${planName} 구독이 ${formatDate(renewsAt)}에 자동 갱신됩니다.`}
    >
      <Heading style={sharedStyles.heading}>곧 자동 갱신됩니다</Heading>
      <Text style={sharedStyles.paragraph}>
        {`${planName} 구독이 약 7일 후 자동으로 갱신될 예정입니다.`}
      </Text>
      <Text style={sharedStyles.detailRow}>{`플랜: ${planName}`}</Text>
      <Text style={sharedStyles.detailRow}>{`결제 예정 금액: $${formatAmount(amountCents)}`}</Text>
      <Text style={sharedStyles.detailRow}>{`갱신 예정일: ${formatDate(renewsAt)}`}</Text>
      <Text style={sharedStyles.paragraph}>
        플랜 변경이나 해지를 원하시면 갱신 전에 대시보드의 구독 관리에서
        조정해주세요.
      </Text>
    </PaymentEmailLayout>
  );
}
