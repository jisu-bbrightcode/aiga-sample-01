import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/shadcn/card";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { History } from "lucide-react";
import type { DomainResourceHistoryEntry } from "../api";
import { useDomainResourceHistory } from "../hooks/use-domain-resource-history";
import type { DomainResourceType } from "../types";

/** Korean labels for the audit actions this domain emits. */
const ACTION_LABELS: Record<string, string> = {
  "domain.doctor.created": "생성",
  "domain.hospital.created": "생성",
  "domain.doctor.updated": "수정",
  "domain.hospital.updated": "수정",
  "service_domain.status_changed": "상태 변경",
  "service_domain.archived": "보관",
  "service_domain.restored": "복구",
};

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

function formatDateTime(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return format(parsed, "yyyy.MM.dd HH:mm", { locale: ko });
}

/** Pull a readable status string from an audit payload, if present. */
function statusOf(payload: unknown): string | null {
  if (payload && typeof payload === "object" && "status" in payload) {
    const status = (payload as { status?: unknown }).status;
    return typeof status === "string" ? status : null;
  }
  return null;
}

/** One-line summary of what changed, when the payloads carry a status diff. */
function changeSummary(entry: DomainResourceHistoryEntry): string | null {
  const before = statusOf(entry.payloadBefore);
  const after = statusOf(entry.payloadAfter);
  if (before && after && before !== after) {
    return `${before} → ${after}`;
  }
  return null;
}

/**
 * 변경 이력 (audit trail) for one domain resource — PB-ADMIN-DOMAIN-UPDATE-001 / BBR-681.
 *
 * Reads the append-only `admin_audit_log` filtered to this record, newest first.
 * Shows the action, who performed it, when, and (for status changes) the
 * before → after transition.
 */
export function DomainHistoryCard({ type, id }: { type: DomainResourceType; id: string }) {
  const { data, isLoading, isError } = useDomainResourceHistory(type, id);

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="size-4 text-muted-foreground" aria-hidden /> 변경 이력
        </CardTitle>
        <CardDescription>이 리소스에 대한 수정·상태 변경 감사 기록 (최신순)</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">불러오는 중...</div>
        ) : isError ? (
          <div className="text-sm text-muted-foreground">변경 이력을 불러오지 못했습니다.</div>
        ) : !data || data.rows.length === 0 ? (
          <div className="text-sm text-muted-foreground">변경 이력이 없습니다.</div>
        ) : (
          <ul className="space-y-2 text-sm">
            {data.rows.map((entry) => {
              const summary = changeSummary(entry);
              return (
                <li key={entry.id} className="flex flex-wrap items-center gap-2 border-b pb-2">
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">
                    {actionLabel(entry.action)}
                  </span>
                  {summary && <span className="font-mono text-xs">{summary}</span>}
                  <span className="text-muted-foreground">{entry.actorUserId}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {formatDateTime(entry.createdAt)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
