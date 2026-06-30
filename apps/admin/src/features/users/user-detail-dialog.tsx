/**
 * Admin user detail + management dialog (BBR-684).
 *
 * Read-only account summary plus the two audited management actions:
 *  - 접근 역할 변경 (admin/member) — owner accounts are protected.
 *  - 계정 상태 변경 (활성/정지)   — owner accounts are protected.
 *
 * Both actions write to the admin audit log on the server; this dialog only
 * surfaces friendly, non-technical outcomes (toast) and refetches the list.
 */
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/shadcn/avatar";
import { Badge } from "@repo/ui/shadcn/badge";
import { Button } from "@repo/ui/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/shadcn/dialog";
import { Label } from "@repo/ui/shadcn/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/shadcn/select";
import { Textarea } from "@repo/ui/shadcn/textarea";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  type AdminUserAuditEntry,
  type AdminUserAuthProvider,
  type AdminUserDetail,
  type AdminUserItem,
  type AdminUserSessionSummary,
  type AdminUserSubscriptionSummary,
  type AssignableRole,
  adminActionErrorMessage,
  changeUserRole,
  changeUserStatus,
  fetchAdminUserDetail,
} from "./api";

interface Props {
  user: AdminUserItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}

type Pending = "role" | "status" | null;

const ACCESS_ROLE_LABELS: Record<string, string> = {
  owner: "소유자",
  admin: "관리자",
  member: "멤버",
  none: "일반 사용자",
};

export function UserDetailDialog({ user, open, onOpenChange, onChanged }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>사용자 상세</DialogTitle>
          <DialogDescription>계정 정보 확인 및 권한·상태 관리</DialogDescription>
        </DialogHeader>
        {open && user ? <UserDetailBody user={user} onChanged={onChanged} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function UserDetailBody({ user, onChanged }: { user: AdminUserItem; onChanged: () => void }) {
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState<Pending>(null);
  const { detail, loading: detailLoading, error: detailError, refresh } = useUserDetail(user.id);

  async function runAction(
    kind: Exclude<Pending, null>,
    action: () => Promise<unknown>,
    ok: string,
  ) {
    setPending(kind);
    try {
      await action();
      toast.success(ok);
      setReason("");
      onChanged();
      refresh();
    } catch (error) {
      toast.error(adminActionErrorMessage(error));
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-5">
      <UserSummary user={user} />

      <UserDetailSections detail={detail} loading={detailLoading} error={detailError} />

      <div className="space-y-2">
        <Label htmlFor="admin-user-reason">변경 사유 (선택, 감사 로그에 기록)</Label>
        <Textarea
          id="admin-user-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="예: 운영팀 권한 부여 요청"
          rows={2}
          maxLength={500}
        />
      </div>

      <RoleSection
        user={user}
        pending={pending}
        onChange={(role) =>
          runAction(
            "role",
            () => changeUserRole(user.id, role, reason),
            "접근 역할을 변경했습니다.",
          )
        }
      />

      <StatusSection
        user={user}
        pending={pending}
        onChange={(active) =>
          runAction(
            "status",
            () => changeUserStatus(user.id, active, reason),
            active ? "계정을 활성화했습니다." : "계정을 정지했습니다.",
          )
        }
      />
    </div>
  );
}

function UserSummary({ user }: { user: AdminUserItem }) {
  return (
    <>
      <div className="flex items-center gap-3">
        <Avatar className="size-12">
          <AvatarImage src={user.image ?? undefined} />
          <AvatarFallback>{user.name?.charAt(0)?.toUpperCase() ?? "U"}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate font-medium">{user.name}</p>
          <p className="truncate text-[13px] text-muted-foreground">{user.email}</p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
        <Field label="접근 역할">
          <Badge variant="secondary">{ACCESS_ROLE_LABELS[user.accessRole ?? "none"]}</Badge>
        </Field>
        <Field label="계정 상태">
          <Badge variant={user.isActive ? "default" : "outline"}>
            {user.isActive ? "활성" : "정지"}
          </Badge>
        </Field>
        <Field label="이메일 인증">{user.emailVerified ? "완료" : "미인증"}</Field>
        <Field label="가입일">{new Date(user.createdAt).toLocaleDateString("ko-KR")}</Field>
        <Field label="사용자 ID">
          <span className="font-mono text-[11px] break-all text-muted-foreground">{user.id}</span>
        </Field>
      </dl>
    </>
  );
}

function RoleSection({
  user,
  pending,
  onChange,
}: {
  user: AdminUserItem;
  pending: Pending;
  onChange: (role: AssignableRole) => void;
}) {
  const [role, setRole] = useState<AssignableRole>(
    user.accessRole === "admin" ? "admin" : "member",
  );

  let body: React.ReactNode;
  if (user.accessRole === "owner") {
    body = <SectionNote>소유자(owner) 계정의 역할은 변경할 수 없습니다.</SectionNote>;
  } else if (user.accessRole === null) {
    body = <SectionNote>조직 멤버가 아니어서 접근 역할을 변경할 수 없습니다.</SectionNote>;
  } else {
    body = (
      <div className="flex items-center gap-2">
        <Select value={role} onValueChange={(v) => setRole(v as AssignableRole)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="admin">관리자 (admin)</SelectItem>
            <SelectItem value="member">일반 멤버 (member)</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => onChange(role)} disabled={pending !== null}>
          {pending === "role" ? "변경 중..." : "역할 변경"}
        </Button>
      </div>
    );
  }

  return <Section title="접근 역할 변경">{body}</Section>;
}

function StatusSection({
  user,
  pending,
  onChange,
}: {
  user: AdminUserItem;
  pending: Pending;
  onChange: (active: boolean) => void;
}) {
  let body: React.ReactNode;
  if (user.accessRole === "owner") {
    body = <SectionNote>소유자(owner) 계정은 정지할 수 없습니다.</SectionNote>;
  } else if (user.isActive) {
    body = (
      <Button
        size="sm"
        variant="destructive"
        onClick={() => onChange(false)}
        disabled={pending !== null}
      >
        {pending === "status" ? "처리 중..." : "계정 정지"}
      </Button>
    );
  } else {
    body = (
      <Button size="sm" onClick={() => onChange(true)} disabled={pending !== null}>
        {pending === "status" ? "처리 중..." : "계정 활성화"}
      </Button>
    );
  }

  return <Section title="계정 상태 변경">{body}</Section>;
}

/** Fetch the secret-free operational detail when the dialog opens. */
function useUserDetail(userId: string) {
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetchAdminUserDetail(userId)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, reloadToken]);

  return { detail, loading, error, refresh: () => setReloadToken((t) => t + 1) };
}

const PROVIDER_LABELS: Record<string, string> = {
  credential: "이메일/비밀번호",
  google: "Google",
  kakao: "카카오",
  naver: "네이버",
  apple: "Apple",
  github: "GitHub",
};

const AUDIT_ACTION_LABELS: Record<string, string> = {
  "user.status_changed": "계정 상태 변경",
  "user.role_changed": "접근 역할 변경",
  "user.updated": "정보 수정",
  "user.archived": "보관(삭제)",
  "user.restored": "복구",
};

const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  active: "활성",
  trialing: "체험",
  grace: "유예",
  past_due: "연체",
  canceled: "해지",
  expired: "만료",
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("ko-KR");
}

function labelFor(map: Record<string, string>, key: string): string {
  return map[key] ?? key;
}

function UserDetailSections({
  detail,
  loading,
  error,
}: {
  detail: AdminUserDetail | null;
  loading: boolean;
  error: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        <div className="h-16 animate-pulse rounded-lg bg-muted" />
        <div className="h-16 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }
  if (error || !detail) {
    return (
      <Section title="상세 정보">
        <SectionNote>상세 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</SectionNote>
      </Section>
    );
  }
  return (
    <>
      <AuthProvidersSection providers={detail.authProviders} />
      <SessionSection sessions={detail.sessions} />
      <PermissionSection accessRole={detail.accessRole} roles={detail.roles} />
      <SubscriptionSection subscription={detail.subscription} />
      <AuditSection entries={detail.recentAudit} />
    </>
  );
}

function AuthProvidersSection({ providers }: { providers: AdminUserAuthProvider[] }) {
  return (
    <Section title="인증 수단">
      {providers.length === 0 ? (
        <SectionNote>연결된 로그인 수단이 없습니다.</SectionNote>
      ) : (
        <ul className="space-y-1">
          {providers.map((p) => (
            <li key={p.providerId} className="flex items-center justify-between text-[13px]">
              <Badge variant="secondary">{labelFor(PROVIDER_LABELS, p.providerId)}</Badge>
              <span className="text-[11px] text-muted-foreground">
                연결 {formatDateTime(p.linkedAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function SessionSection({ sessions }: { sessions: AdminUserSessionSummary }) {
  return (
    <Section title="세션 / 활동 요약">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
        <Field label="유효 세션">{sessions.activeCount}개</Field>
        <Field label="마지막 활동">{formatDateTime(sessions.lastActiveAt)}</Field>
        <Field label="최근 IP">
          <span className="font-mono text-[12px] break-all">{sessions.lastIpAddress ?? "-"}</span>
        </Field>
        <Field label="최근 접속 환경">
          <span className="truncate text-[12px] text-muted-foreground">
            {sessions.lastUserAgent ?? "-"}
          </span>
        </Field>
      </dl>
    </Section>
  );
}

function PermissionSection({
  accessRole,
  roles,
}: {
  accessRole: AdminUserDetail["accessRole"];
  roles: string[];
}) {
  return (
    <Section title="권한 요약">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
        <Field label="접근 역할">
          <Badge variant="secondary">{ACCESS_ROLE_LABELS[accessRole ?? "none"]}</Badge>
        </Field>
        <Field label="부여된 역할">
          <span className="flex flex-wrap gap-1">
            {roles.map((role) => (
              <Badge key={role} variant="outline">
                {role}
              </Badge>
            ))}
          </span>
        </Field>
      </dl>
    </Section>
  );
}

function SubscriptionSection({
  subscription,
}: {
  subscription: AdminUserSubscriptionSummary | null;
}) {
  return (
    <Section title="결제 요약">
      {subscription ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
          <Field label="구독 상태">
            <Badge variant="default">
              {labelFor(SUBSCRIPTION_STATUS_LABELS, subscription.status)}
            </Badge>
          </Field>
          <Field label="현재 주기 종료">{formatDateTime(subscription.currentPeriodEnd)}</Field>
          {subscription.cancelAtPeriodEnd ? (
            <Field label="해지 예약">주기 종료 시 해지</Field>
          ) : null}
        </dl>
      ) : (
        <SectionNote>구독 또는 결제 내역이 없습니다.</SectionNote>
      )}
    </Section>
  );
}

function AuditSection({ entries }: { entries: AdminUserAuditEntry[] }) {
  return (
    <Section title="변경 이력 (감사 로그)">
      {entries.length === 0 ? (
        <SectionNote>기록된 변경 이력이 없습니다.</SectionNote>
      ) : (
        <ul className="space-y-2">
          {entries.map((entry) => (
            <li key={entry.id} className="border-b pb-2 text-[12px] last:border-0 last:pb-0">
              <div className="flex items-center justify-between">
                <span className="font-medium">{labelFor(AUDIT_ACTION_LABELS, entry.action)}</span>
                <span className="text-[11px] text-muted-foreground">
                  {formatDateTime(entry.createdAt)}
                </span>
              </div>
              {entry.reason ? (
                <p className="mt-0.5 text-muted-foreground">사유: {entry.reason}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 rounded-lg border p-3">
      <h3 className="text-[13px] font-medium">{title}</h3>
      {children}
    </section>
  );
}

function SectionNote({ children }: { children: React.ReactNode }) {
  return <p className="text-[12px] text-muted-foreground">{children}</p>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="flex items-center">{children}</dd>
    </div>
  );
}
