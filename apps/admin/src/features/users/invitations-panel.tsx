/**
 * Invitations panel (PB-ADMIN-USERS-CREATE-001 / BBR-687).
 *
 * The invite console surface on the Users page: an "운영자 초대" action that
 * opens the invite form, plus the list of pending invitations with a re-send
 * action (재초대). Pending invitations are only shown when present so the page
 * stays uncluttered for organizations with none.
 */
import { Badge } from "@repo/ui/shadcn/badge";
import { Button } from "@repo/ui/shadcn/button";
import { Mail, RefreshCw, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { type Invitation, inviteErrorMessage, resendInvitation } from "./api";
import { InviteUserDialog } from "./invite-user-dialog";
import { useInvitations } from "./use-invitations";

const ROLE_LABELS: Record<string, string> = {
  owner: "소유자",
  admin: "관리자",
  member: "멤버",
};

export function InvitationsPanel() {
  const { invitations, loading, error, refetch } = useInvitations();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);

  async function handleResend(invitation: Invitation) {
    setResendingId(invitation.id);
    try {
      await resendInvitation(invitation.id);
      toast.success(`${invitation.email} 님에게 초대를 다시 보냈습니다.`);
      refetch();
    } catch (err) {
      toast.error(inviteErrorMessage(err));
    } finally {
      setResendingId(null);
    }
  }

  return (
    <section className="mb-4 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Mail className="size-4 text-muted-foreground" />
          <h2 className="text-[13px] font-medium">운영자 초대</h2>
          {!loading && invitations.length > 0 ? (
            <Badge variant="secondary">대기 {invitations.length}건</Badge>
          ) : null}
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setDialogOpen(true)}>
          <UserPlus className="size-3.5" />
          운영자 초대
        </Button>
      </div>

      {error ? (
        <p className="mt-3 text-[13px] text-destructive">{error}</p>
      ) : (
        <PendingList
          invitations={invitations}
          loading={loading}
          resendingId={resendingId}
          onResend={handleResend}
        />
      )}

      <InviteUserDialog open={dialogOpen} onOpenChange={setDialogOpen} onInvited={refetch} />
    </section>
  );
}

function PendingList({
  invitations,
  loading,
  resendingId,
  onResend,
}: {
  invitations: Invitation[];
  loading: boolean;
  resendingId: string | null;
  onResend: (invitation: Invitation) => void;
}) {
  if (loading) {
    return <p className="mt-3 text-[13px] text-muted-foreground">불러오는 중...</p>;
  }
  if (invitations.length === 0) {
    return <p className="mt-3 text-[13px] text-muted-foreground">대기 중인 초대가 없습니다.</p>;
  }
  return (
    <ul className="mt-3 divide-y">
      {invitations.map((invitation) => (
        <li key={invitation.id} className="flex items-center justify-between gap-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium">{invitation.email}</p>
            <p className="text-[12px] text-muted-foreground">
              {ROLE_LABELS[invitation.role] ?? invitation.role} · 만료{" "}
              {new Date(invitation.expiresAt).toLocaleDateString("ko-KR")}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={resendingId !== null}
            onClick={() => onResend(invitation)}
          >
            <RefreshCw
              className={resendingId === invitation.id ? "size-3.5 animate-spin" : "size-3.5"}
            />
            재발송
          </Button>
        </li>
      ))}
    </ul>
  );
}
