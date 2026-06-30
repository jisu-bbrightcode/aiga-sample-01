/**
 * Invite operator dialog (PB-ADMIN-USERS-CREATE-001 / BBR-687).
 *
 * Collects an email + initial access role and posts to the audited invite
 * endpoint. Validation lives on the server (중복 이메일/잘못된 role 차단); this
 * form does a light client-side email check for fast feedback and surfaces only
 * friendly, non-technical errors (inline + toast) — never raw server detail.
 */
import { Button } from "@repo/ui/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/shadcn/dialog";
import { Input } from "@repo/ui/shadcn/input";
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
import { type AssignableRole, inviteErrorMessage, inviteUser } from "./api";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvited: () => void;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function InviteUserDialog({ open, onOpenChange, onInvited }: Props) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AssignableRole>("member");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setEmail("");
    setRole("member");
    setReason("");
    setError(null);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  async function handleSubmit() {
    const trimmed = email.trim();
    if (!EMAIL_PATTERN.test(trimmed)) {
      setError("올바른 이메일 주소를 입력해 주세요.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await inviteUser({ email: trimmed, role, reason });
      toast.success(`${trimmed} 님에게 초대를 보냈습니다.`);
      reset();
      onInvited();
      onOpenChange(false);
    } catch (err) {
      const message = inviteErrorMessage(err);
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>운영자 초대</DialogTitle>
          <DialogDescription>
            이메일로 초대를 보내고 초기 접근 역할을 지정합니다. 초대 작업은 감사 로그에 기록됩니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email">이메일</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="operator@example.com"
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-role">초기 접근 역할</Label>
            <Select value={role} onValueChange={(v) => setRole(v as AssignableRole)}>
              <SelectTrigger id="invite-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">관리자 (admin)</SelectItem>
                <SelectItem value="member">일반 멤버 (member)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-reason">초대 사유 (선택, 감사 로그에 기록)</Label>
            <Textarea
              id="invite-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="예: 운영팀 신규 합류"
              rows={2}
              maxLength={500}
            />
          </div>

          {error ? (
            <p className="text-[13px] text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
            취소
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "초대 보내는 중..." : "초대 보내기"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
