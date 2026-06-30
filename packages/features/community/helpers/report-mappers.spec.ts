import type { CommunityReport } from "@repo/drizzle/schema";
import { toReportReceipt } from "./report-mappers";

const createdAt = new Date("2026-01-02T03:04:05.000Z");

function makeReport(overrides: Partial<CommunityReport> = {}): CommunityReport {
  return {
    id: "report-1",
    createdAt,
    updatedAt: new Date("2026-01-02T03:04:05.000Z"),
    communityId: "community-1",
    reporterId: "reporter-secret-1",
    targetType: "post",
    targetId: "post-1",
    reason: "spam",
    ruleViolated: 2,
    description: "스팸성 게시글입니다.",
    status: "pending",
    resolvedBy: null,
    resolvedAt: null,
    resolution: null,
    actionTaken: null,
    severity: "medium",
    firstResponseAt: null,
    ...overrides,
  } as CommunityReport;
}

describe("toReportReceipt", () => {
  it("신고자 보호: 응답에 reporterId 가 절대 포함되지 않는다 (AC#2)", () => {
    const receipt = toReportReceipt(makeReport({ reporterId: "reporter-secret-1" }));
    expect(Object.values(receipt)).not.toContain("reporter-secret-1");
    expect("reporterId" in receipt).toBe(false);
  });

  it("내부 처리 필드(resolvedBy/resolution/actionTaken)를 노출하지 않는다", () => {
    const receipt = toReportReceipt(
      makeReport({
        status: "resolved",
        resolvedBy: "mod-9",
        resolution: "처리 완료",
        actionTaken: "removed",
      }),
    );
    expect("resolvedBy" in receipt).toBe(false);
    expect("resolution" in receipt).toBe(false);
    expect("actionTaken" in receipt).toBe(false);
    expect(Object.values(receipt)).not.toContain("mod-9");
  });

  it("접수증 공개 필드를 그대로 projection 한다", () => {
    const receipt = toReportReceipt(makeReport());
    expect(receipt).toEqual({
      id: "report-1",
      targetType: "post",
      targetId: "post-1",
      reason: "spam",
      status: "pending",
      severity: "medium",
      createdAt: "2026-01-02T03:04:05.000Z",
    });
  });

  it("createdAt 가 문자열(ISO)이면 그대로 통과시킨다", () => {
    const receipt = toReportReceipt(
      makeReport({ createdAt: "2026-05-06T07:08:09.000Z" as unknown as Date }),
    );
    expect(receipt.createdAt).toBe("2026-05-06T07:08:09.000Z");
  });
});
