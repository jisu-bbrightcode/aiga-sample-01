/**
 * @design-ref none — admin capability registry screen; no finalized screen HTML exists.
 */
import { Badge } from "@repo/ui/shadcn/badge";
import { Button } from "@repo/ui/shadcn/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/shadcn/card";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, ShieldCheck } from "lucide-react";
import { useIdentityVerificationHealth, useIdentityVerificationList } from "../hooks";

export function IdentityVerificationAdminPage() {
  const health = useIdentityVerificationHealth();
  const sessions = useIdentityVerificationList();

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-5" />
        <h1 className="text-xl font-semibold">본인확인 관리</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>KCB Java adapter health</CardTitle>
        </CardHeader>
        <CardContent>
          {health.isLoading ? (
            <p className="text-sm text-muted-foreground">확인 중입니다.</p>
          ) : null}
          {health.isError ? (
            <p className="text-sm text-destructive">
              본인확인 상태를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
            </p>
          ) : null}
          {health.data ? (
            <div className="grid gap-3 md:grid-cols-4">
              <HealthCell label="Adapter" ok={health.data.adapterConfigured} />
              <HealthCell label="Official source" ok={health.data.officialSourceMapped} />
              <HealthCell label="JAR" ok={health.data.jar.configured && health.data.jar.readable} />
              <HealthCell label="OkCert wiring" ok={health.data.officialModuleWired} />
              <HealthCell
                label="License"
                ok={health.data.license.configured && health.data.license.readable}
              />
              <HealthCell
                label={health.data.nativeLibraryRequired ? "Native" : "Native optional"}
                ok={
                  !health.data.nativeLibraryRequired ||
                  (health.data.nativeLibrary.configured && health.data.nativeLibrary.readable)
                }
              />
              <div className="md:col-span-4">
                <div className="mb-2 text-xs font-medium text-muted-foreground">Blockers</div>
                <div className="flex flex-wrap gap-2">
                  {health.data.blockers.length === 0 ? (
                    <Badge variant="success">clear</Badge>
                  ) : (
                    health.data.blockers.map((blocker) => (
                      <Badge key={blocker} variant="warning">
                        {blocker}
                      </Badge>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>본인확인 세션</CardTitle>
        </CardHeader>
        <CardContent>
          {sessions.isError ? (
            <p className="text-sm text-destructive">
              본인확인 이력을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
            </p>
          ) : null}
          <div className="flex flex-col divide-y rounded-md border">
            {(sessions.data ?? []).map((session) => (
              <div
                key={session.id}
                className="grid gap-2 p-3 md:grid-cols-[1fr_120px_120px_150px_80px]"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{session.targetAction}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {ownerLabel(session.userId)}
                  </div>
                </div>
                <Badge variant={session.status === "verified" ? "success" : "outline"}>
                  {session.status}
                </Badge>
                <div className="text-xs text-muted-foreground">{session.mode}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(session.createdAt).toLocaleString()}
                </div>
                <Button
                  variant="outline"
                  size="xs"
                  render={
                    <Link
                      to="/identity-verification/$sessionId"
                      params={{ sessionId: session.id }}
                    />
                  }
                >
                  상세
                </Button>
              </div>
            ))}
            {!sessions.isLoading && (sessions.data ?? []).length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">
                표시할 본인확인 이력이 없습니다.
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

function ownerLabel(userId: string | null): string {
  return userId ?? "익명";
}

function HealthCell({ label, ok }: { label: string; ok: boolean }) {
  const Icon = ok ? CheckCircle2 : AlertTriangle;
  return (
    <div className="flex items-center gap-2 rounded-md border p-3">
      <Icon className={ok ? "size-4 text-green-600" : "size-4 text-yellow-600"} />
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm font-medium">{ok ? "ready" : "required"}</div>
      </div>
    </div>
  );
}
