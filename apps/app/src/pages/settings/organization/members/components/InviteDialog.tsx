/**
 * InviteDialog — invite a teammate by email + role.
 *
 * Uses better-auth `organization.inviteMember`. Roles offered are
 * `member` and `admin` (backend enum, see role-display.ts).
 */
import { authClient } from "@repo/core/auth/client";
import { getUserFacingErrorMessage, useFeatureTranslation } from "@repo/core/i18n";
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
import { useState } from "react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  onInvited: () => void;
}

export function InviteDialog({ open, onOpenChange, organizationId, onInvited }: Props) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useFeatureTranslation("page.settings");

  async function submit() {
    setPending(true);
    setError(null);
    try {
      await authClient.organization.inviteMember({
        organizationId,
        email,
        role,
      });
      onInvited();
      onOpenChange(false);
      setEmail("");
      setRole("member");
    } catch (e) {
      setError(getUserFacingErrorMessage(t, e, { fallbackKey: "members.invite.error" }));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("members.invite.title")}</DialogTitle>
          <DialogDescription>{t("members.invite.description")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="invite-email">{t("members.invite.email")}</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label>{t("members.invite.role")}</Label>
            <Select value={role} onValueChange={(v) => v && setRole(v as "member" | "admin")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Editor (member)</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("members.invite.cancel")}
          </Button>
          <Button type="button" onClick={submit} disabled={pending || !email.trim()}>
            {pending ? t("members.invite.sending") : t("members.invite.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
