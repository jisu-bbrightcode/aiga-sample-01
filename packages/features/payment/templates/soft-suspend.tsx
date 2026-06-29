import { Button, Heading, Text } from "@react-email/components";
import { PaymentEmailLayout, formatDate, sharedStyles } from "./layout";

export interface SoftSuspendProps {
  planName: string;
  gracePeriodEndsAt: Date;
  dataPurgeAt: Date;
  restoreUrl: string;
}

export const softSuspendSubject = (_props: SoftSuspendProps): string =>
  `[Product Builder] 서비스 일시 제한 — 7일 이내 결제 정상화 필요`;

export function SoftSuspendEmail(props: SoftSuspendProps) {
  const { planName, gracePeriodEndsAt, dataPurgeAt, restoreUrl } = props;
  return (
    <PaymentEmailLayout preview="결제 미정상화로 서비스가 일시 제한되었습니다.">
      <Heading style={sharedStyles.heading}>서비스 일시 제한</Heading>
      <Text style={sharedStyles.paragraph}>
        {`반복된 결제 실패로 ${planName} 구독이 일시 제한되었습니다. 결제 수단을 업데이트하시면 즉시 정상화됩니다.`}
      </Text>
      <Text style={sharedStyles.warning}>
        {`${formatDate(gracePeriodEndsAt)}까지 결제가 정상화되지 않으면 서비스 접근이 중단됩니다. ${formatDate(dataPurgeAt)} 이후에는 데이터 보존 정책에 따라 자료가 삭제될 수 있습니다.`}
      </Text>
      <Button href={restoreUrl} style={sharedStyles.button}>
        결제 수단 업데이트
      </Button>
      <Text style={sharedStyles.paragraph}>
        문의가 있으시면 회신해주세요. 빠르게 도와드리겠습니다.
      </Text>
    </PaymentEmailLayout>
  );
}
