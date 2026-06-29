/**
 * @design-ref none — admin session detail screen; no finalized screen HTML exists.
 */

import { Badge } from "@repo/ui/shadcn/badge";
import { Button } from "@repo/ui/shadcn/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/shadcn/card";
import { Skeleton } from "@repo/ui/shadcn/skeleton";
import { Link, useParams } from "@tanstack/react-router";
import { ArrowLeft, FileText, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { useIdentityVerificationDetail } from "../hooks";

export function IdentityVerificationDetailPage() {
  const { sessionId } = useParams({ strict: false }) as { sessionId: string };
  const detail = useIdentityVerificationDetail(sessionId);

  if (detail.isLoading) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-6">
        <Skeleton className="h-64 w-full" />
      </main>
    );
  }

  if (detail.isError) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-6">
        <BackButton />
        <Card>
          <CardContent className="p-6 text-sm text-destructive">
            본인확인 상세 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!detail.data) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-6">
        <BackButton />
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            본인확인 세션을 찾을 수 없습니다.
          </CardContent>
        </Card>
      </main>
    );
  }

  const session = detail.data;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <ShieldCheck className="size-5 shrink-0" />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold">본인확인 요청 상세</h1>
            <p className="truncate font-mono text-xs text-muted-foreground">{session.id}</p>
          </div>
        </div>
        <BackButton />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>요청 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="상태">
              <Badge variant={session.status === "verified" ? "success" : "outline"}>
                {session.status}
              </Badge>
            </Row>
            <Row label="모드">{session.mode}</Row>
            <Row label="사용자 ID" mono>
              {session.userId ?? "익명"}
            </Row>
            <Row label="대상 액션">{session.targetAction}</Row>
            <Row label="Provider 거래 ID" mono>
              {session.providerTransactionId ?? "-"}
            </Row>
            <Row label="결과 코드">{session.resultCode ?? "-"}</Row>
            <Row label="실패 코드">{session.failureCode ?? "-"}</Row>
            <Row label="생성">{formatDate(session.createdAt)}</Row>
            <Row label="수정">{formatDate(session.updatedAt)}</Row>
            <Row label="만료">{formatDate(session.expiresAt)}</Row>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-4" />
              검증 결과
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {session.verifications.length === 0 ? (
              <p className="text-muted-foreground">저장된 검증 결과가 없습니다.</p>
            ) : (
              session.verifications.map((result) => (
                <div key={result.id} className="space-y-2 rounded-md border p-3">
                  <Row label="이름">{result.nameMasked ?? "-"}</Row>
                  <Row label="생년">{result.birthYear ?? "-"}</Row>
                  <Row label="휴대폰">{result.phoneMasked ?? "-"}</Row>
                  <Row label="CI/DI hash">
                    {result.ciHashPresent || result.diHashPresent ? "저장됨" : "없음"}
                  </Row>
                  <Row label="검증 완료">{formatDate(result.verifiedAt)}</Row>
                  <Row label="보존 기한">
                    {result.retainedUntil ? formatDate(result.retainedUntil) : "정책 설정 필요"}
                  </Row>
                  <Row label="사용자 연결" mono>
                    {result.userId ?? "미연결"}
                  </Row>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function BackButton() {
  return (
    <Button variant="outline" size="sm" render={<Link to="/identity-verification" />}>
      <ArrowLeft />
      목록
    </Button>
  );
}

function Row({ label, mono, children }: { label: string; mono?: boolean; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className={mono ? "min-w-0 truncate font-mono text-xs" : "min-w-0 truncate text-right"}>
        {children}
      </span>
    </div>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("ko-KR");
}
