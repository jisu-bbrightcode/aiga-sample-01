/**
 * Admin Audit Log Page — read-only viewer for the general `admin_audit_log`.
 *
 * Surfaces privileged admin changes (e.g. role grants) so operators can review
 * who changed what and when (PB-ADMIN-001 / AC: "관리자 변경 작업이 감사
 * 로그에 남는다"). Cursor pagination via "더 보기".
 */

import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/shadcn/button";
import { RefreshCw, ScrollText } from "lucide-react";
import { useEffect, useState } from "react";
import { API_URL, getAuthHeaders } from "../../lib/api";

interface AuditLogItem {
  id: string;
  actorUserId: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  payloadBefore: unknown;
  payloadAfter: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  reason: string | null;
  createdAt: string;
}

interface AuditListResponse {
  rows: AuditLogItem[];
  nextCursor: string | null;
}

const PAGE_SIZE = 50;
const AUDIT_ERROR_MESSAGE = "감사 로그를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";
const SKELETON_KEYS = ["a", "b", "c", "d", "e"];

const ACTION_LABELS: Record<string, string> = {
  "user.role_changed": "사용자 역할 변경",
};

async function fetchAuditLogs(cursor: string | null): Promise<AuditListResponse> {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
  if (cursor) params.set("cursor", cursor);
  const response = await fetch(`${API_URL}/api/admin/audit-logs?${params.toString()}`, {
    headers: getAuthHeaders(),
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(`admin_audit_${response.status}`);
  }
  return (await response.json()) as AuditListResponse;
}

export function AdminAuditLogsPage() {
  const [rows, setRows] = useState<AuditLogItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(cursor: string | null, append: boolean) {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await fetchAuditLogs(cursor);
      setRows((prev) => (append ? [...prev, ...data.rows] : data.rows));
      setNextCursor(data.nextCursor);
    } catch (e) {
      console.error("[admin-audit] list failed", e);
      setError(AUDIT_ERROR_MESSAGE);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchAuditLogs(null);
        if (cancelled) return;
        setRows(data.rows);
        setNextCursor(data.nextCursor);
      } catch (e) {
        if (cancelled) return;
        console.error("[admin-audit] list failed", e);
        setError(AUDIT_ERROR_MESSAGE);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <ScrollText className="size-5 text-muted-foreground" />
          <div>
            <h1 className="text-lg font-semibold">감사 로그</h1>
            <p className="text-[13px] text-muted-foreground">관리자 변경 작업 기록</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => load(null, false)}
          disabled={loading}
          className="gap-1.5"
        >
          <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          새로고침
        </Button>
      </div>

      {error ? (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-[13px] text-destructive">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="px-4 py-2.5 text-left font-medium">시각</th>
              <th className="px-4 py-2.5 text-left font-medium">작업</th>
              <th className="px-4 py-2.5 text-left font-medium">수행자</th>
              <th className="px-4 py-2.5 text-left font-medium">대상</th>
              <th className="px-4 py-2.5 text-left font-medium">변경</th>
              <th className="px-4 py-2.5 text-left font-medium">사유</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? SKELETON_KEYS.map((key) => (
                  <tr key={key} className="border-b">
                    <td colSpan={6} className="px-4 py-3">
                      <div className="h-5 w-full animate-pulse rounded bg-muted" />
                    </td>
                  </tr>
                ))
              : null}
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                  기록된 감사 로그가 없습니다
                </td>
              </tr>
            ) : null}
            {loading ? null : rows.map((row) => <AuditRow key={row.id} row={row} />)}
          </tbody>
        </table>
      </div>

      {nextCursor && !loading ? (
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => load(nextCursor, true)}
            disabled={loadingMore}
          >
            {loadingMore ? "불러오는 중..." : "더 보기"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function roleOf(payload: unknown): string | null {
  if (payload && typeof payload === "object" && "role" in payload) {
    const role = (payload as { role?: unknown }).role;
    return typeof role === "string" ? role : null;
  }
  return null;
}

function AuditRow({ row }: { row: AuditLogItem }) {
  const before = roleOf(row.payloadBefore);
  const after = roleOf(row.payloadAfter);
  const change = before || after ? `${before ?? "-"} → ${after ?? "-"}` : "-";

  return (
    <tr className="border-b last:border-0 transition-colors hover:bg-muted/30">
      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
        {new Date(row.createdAt).toLocaleString("ko-KR")}
      </td>
      <td className="px-4 py-3 font-medium">{ACTION_LABELS[row.action] ?? row.action}</td>
      <td className="px-4 py-3 font-mono text-[12px] text-muted-foreground">{row.actorUserId}</td>
      <td className="px-4 py-3 font-mono text-[12px] text-muted-foreground">
        {row.targetId ?? "-"}
      </td>
      <td className="px-4 py-3">{change}</td>
      <td className="px-4 py-3 text-muted-foreground">{row.reason ?? "-"}</td>
    </tr>
  );
}
