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
import { useState } from "react";
import { toast } from "sonner";
import {
  type AdminUserItem,
  type AssignableRole,
  adminActionErrorMessage,
  archiveUser,
  changeUserRole,
  changeUserStatus,
  restoreUser,
  userLifecycleStatus,
} from "./api";

interface Props {
  user: AdminUserItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}

type Pending = "role" | "status" | "archive" | "restore" | null;

const ACCESS_ROLE_LABELS: Record<string, string> = {
  owner: "소유자",
  admin: "관리자",
  member: "멤버",
  none: "일반 사용자",
};

const STATUS_LABELS: Record<string, string> = {
  active: "활성",
  suspended: "정지",
  archived: "보관됨",
};

export function UserDetailDialog({ user, open, onOpenChange, onChanged }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>사용자 상세</DialogTitle>
          <DialogDescription>계정 정보 확인 및 권한·상태 관리</DialogDescription>
        </DialogHeader>
        {user ? <UserDetailBody user={user} onChanged={onChanged} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function UserDetailBody({ user, onChanged }: { user: AdminUserItem; onChanged: () => void }) {
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState<Pending>(null);

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
    } catch (error) {
      toast.error(adminActionErrorMessage(error));
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-5">
      <UserSummary user={user} />

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

      <DataLifecycleSection
        user={user}
        pending={pending}
        onArchive={() =>
          runAction(
            "archive",
            () => archiveUser(user.id, reason),
            "계정을 보관 처리했습니다. (복구 가능)",
          )
        }
        onRestore={() =>
          runAction("restore", () => restoreUser(user.id, reason), "계정을 복구했습니다.")
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
            {STATUS_LABELS[userLifecycleStatus(user)]}
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
      <div className="space-y-2">
        <Button
          size="sm"
          variant="destructive"
          onClick={() => onChange(false)}
          disabled={pending !== null}
        >
          {pending === "status" ? "처리 중..." : "계정 정지"}
        </Button>
        <SectionNote>
          정지하면 사용자의 모든 로그인 세션이 해제되어 다시 로그인해야 합니다. 되돌릴 수 있는
          작업이며, 활성화하면 다시 이용할 수 있습니다.
        </SectionNote>
      </div>
    );
  } else {
    body = (
      <div className="space-y-2">
        <Button size="sm" onClick={() => onChange(true)} disabled={pending !== null}>
          {pending === "status" ? "처리 중..." : "계정 활성화"}
        </Button>
        <SectionNote>활성화해도 기존 세션은 복원되지 않습니다(사용자가 다시 로그인).</SectionNote>
      </div>
    );
  }

  return <Section title="계정 상태 변경 (정지 / 활성화)">{body}</Section>;
}

/**
 * 계정 보관(soft-delete) / 복구 — 되돌릴 수 있는 작업.
 *
 * 보관은 데이터를 물리적으로 지우지 않고 공개/앱 노출만 차단하며 세션을 해제한다.
 * 영구 삭제(되돌릴 수 없는 작업)는 데이터 보존 정책상 이 화면에서 제공하지 않는다
 * (AC: 되돌릴 수 있는/없는 작업 구분). 보관은 위험도가 있어 2단계 확인을 거친다.
 */
function DataLifecycleSection({
  user,
  pending,
  onArchive,
  onRestore,
}: {
  user: AdminUserItem;
  pending: Pending;
  onArchive: () => void;
  onRestore: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const isArchived = user.deletedAt !== null;
  const busy = pending !== null;

  let body: React.ReactNode;
  if (isArchived) {
    body = (
      <div className="space-y-2">
        <Badge variant="outline">
          보관됨 · {new Date(user.deletedAt as string).toLocaleString("ko-KR")}
        </Badge>
        <div>
          <Button size="sm" onClick={onRestore} disabled={busy}>
            {pending === "restore" ? "복구 중..." : "계정 복구"}
          </Button>
        </div>
        <SectionNote>
          복구하면 계정이 다시 활성화되고 공개/앱 노출이 재개됩니다. 보관 중에도 결제·이력 등 연결
          데이터는 보존됩니다.
        </SectionNote>
      </div>
    );
  } else if (user.accessRole === "owner") {
    body = <SectionNote>소유자(owner) 계정은 보관할 수 없습니다.</SectionNote>;
  } else if (confirming) {
    body = (
      <div className="space-y-2">
        <SectionNote>
          보관하면 사용자의 모든 세션이 해제되고 공개/앱에서 숨겨집니다. 데이터는 삭제되지 않으며
          언제든 복구할 수 있습니다. 계속할까요?
        </SectionNote>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="destructive"
            onClick={() => {
              setConfirming(false);
              onArchive();
            }}
            disabled={busy}
          >
            {pending === "archive" ? "보관 중..." : "보관 확인"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setConfirming(false)} disabled={busy}>
            취소
          </Button>
        </div>
      </div>
    );
  } else {
    body = (
      <div className="space-y-2">
        <Button size="sm" variant="outline" onClick={() => setConfirming(true)} disabled={busy}>
          계정 보관 (소프트 삭제)
        </Button>
        <SectionNote>
          되돌릴 수 있는 작업입니다. 데이터를 지우지 않고 노출만 차단하며 세션을 해제합니다. 영구
          삭제는 데이터 보존 정책상 제공하지 않습니다.
        </SectionNote>
      </div>
    );
  }

  return <Section title="계정 보관 / 복구 (삭제)">{body}</Section>;
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
