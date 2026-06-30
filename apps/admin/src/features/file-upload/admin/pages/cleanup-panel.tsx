import { Button } from "@repo/ui/shadcn/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/shadcn/card";
import { Link } from "@tanstack/react-router";
import { Recycle } from "lucide-react";
import { useFileCleanup } from "../hooks/use-file-mutations";

/** One labelled metric from the last cleanup sweep. */
function Metric({ label, value, tone }: { label: string; value: number; tone?: "danger" }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={
          tone === "danger" && value > 0
            ? "text-2xl font-semibold text-destructive"
            : "text-2xl font-semibold"
        }
      >
        {value.toLocaleString("ko-KR")}
      </div>
    </div>
  );
}

/**
 * Blob 정리(cleanup) + 감사 패널.
 *
 * Runs one `POST /admin/files/cleanup` sweep (orphan pending reap + stuck-purge
 * retry) and shows the result. Persistent `blobDeleteFailures` indicate a store
 * outage — the file stays soft-deleted and is retried on the next sweep. The
 * audit trail itself lives in the shared 감사 로그 화면 (linked below).
 */
export function CleanupPanel() {
  const cleanup = useFileCleanup();
  const result = cleanup.data;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Blob 정리 / 감사</CardTitle>
            <CardDescription>
              고아 업로드와 삭제 후 미정리된 Blob을 한 번의 sweep으로 회수합니다
            </CardDescription>
          </div>
          <Button onClick={() => cleanup.mutate()} disabled={cleanup.isPending} variant="outline">
            <Recycle
              className={cleanup.isPending ? "mr-2 size-3.5 animate-pulse" : "mr-2 size-3.5"}
            />
            {cleanup.isPending ? "정리 중..." : "정리 실행"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {cleanup.isError ? (
          <p className="text-sm text-destructive">
            {cleanup.error instanceof Error ? cleanup.error.message : "정리 작업에 실패했습니다."}
          </p>
        ) : null}

        {result ? (
          <div className="grid grid-cols-3 gap-3">
            <Metric label="회수한 고아 업로드" value={result.orphanPendingReaped} />
            <Metric label="정리한 Blob" value={result.deletedBlobsPurged} />
            <Metric label="Blob 삭제 실패" value={result.blobDeleteFailures} tone="danger" />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            아직 정리를 실행하지 않았습니다. "정리 실행"을 눌러 sweep을 시작하세요.
          </p>
        )}

        <p className="text-sm text-muted-foreground">
          삭제/복구/수정 등 모든 파일 작업의 변경 이력은{" "}
          <Link to="/audit-logs" className="text-primary underline">
            감사 로그
          </Link>{" "}
          화면에서 확인할 수 있습니다.
        </p>
      </CardContent>
    </Card>
  );
}
