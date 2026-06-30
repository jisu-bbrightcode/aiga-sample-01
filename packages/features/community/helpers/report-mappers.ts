/**
 * 신고 응답 mappers — 순수 projection 함수 (PB-COMM-REPORT-API-CREATE-001 / BBR-614).
 *
 * `POST /community/reports` 의 응답은 신고자에게 돌아가는 "접수증(receipt)"이다.
 * 신고자 보호(AC#2)를 구조적으로 보장하기 위해, 신고 row 에서 필드를 **하나씩
 * 복사**해 `reporterId`(및 resolvedBy/resolution 등 내부 처리 필드)를 절대 응답에
 * 싣지 않는다. row 에 컬럼이 추가돼도 기본적으로 제외되는 fail-closed 방식이다.
 */
import type { CommunityReport } from "@repo/drizzle/schema";

const iso = (value: Date | string): string => (value instanceof Date ? value.toISOString() : value);

/** 신고 접수증 — 신고자 ID 등 민감/내부 필드를 제외한 공개 응답. */
export interface ReportReceipt {
  id: string;
  targetType: CommunityReport["targetType"];
  targetId: string;
  reason: CommunityReport["reason"];
  status: CommunityReport["status"];
  severity: CommunityReport["severity"];
  createdAt: string;
}

/** 신고 row 를 신고자 보호 접수증으로 projection 한다. */
export function toReportReceipt(report: CommunityReport): ReportReceipt {
  return {
    id: report.id,
    targetType: report.targetType,
    targetId: report.targetId,
    reason: report.reason,
    status: report.status,
    severity: report.severity,
    createdAt: iso(report.createdAt),
  };
}
