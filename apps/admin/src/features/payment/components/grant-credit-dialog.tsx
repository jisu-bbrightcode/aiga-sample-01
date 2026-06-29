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
import { Textarea } from "@repo/ui/shadcn/textarea";
import { useState } from "react";
import { toast } from "sonner";
import { useCreditActions } from "../hooks/use-credit-actions";

interface GrantCreditDialogProps {
  organizationId: string;
  subscriptionId?: string;
  mode: "grant" | "revoke";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GrantCreditDialog({
  organizationId,
  subscriptionId,
  mode,
  open,
  onOpenChange,
}: GrantCreditDialogProps) {
  const { grant, revoke } = useCreditActions(subscriptionId);
  const mutation = mode === "grant" ? grant : revoke;
  let submitLabel = mode === "grant" ? "지급" : "회수";
  if (mutation.isPending) submitLabel = "처리 중...";

  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const handleSubmit = async () => {
    const amountNum = parseInt(amount, 10);
    if (!amountNum || amountNum <= 0) {
      toast.error("크레딧 수량을 입력하세요.");
      return;
    }
    if (!reason.trim()) {
      toast.error("사유를 입력하세요.");
      return;
    }
    try {
      const idempotencyKey = `${mode}-${organizationId}-${Date.now()}`;
      await mutation.mutateAsync({
        organizationId,
        amount: amountNum,
        reason,
        idempotencyKey,
      });
      toast.success(mode === "grant" ? "크레딧이 지급되었습니다." : "크레딧이 회수되었습니다.");
      setAmount("");
      setReason("");
      onOpenChange(false);
    } catch {
      toast.error("잠시 문제가 생겼어요. 조금 뒤 다시 시도해 주세요.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "grant" ? "크레딧 지급" : "크레딧 회수"}</DialogTitle>
          <DialogDescription>
            {mode === "grant"
              ? "이 조직에 크레딧을 추가합니다. (감사 로그 기록)"
              : "이 조직에서 크레딧을 차감합니다. (감사 로그 기록)"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="credit-amount">크레딧 수량</Label>
            <Input
              id="credit-amount"
              type="number"
              min="1"
              placeholder="예: 1000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="credit-reason">사유 (필수)</Label>
            <Textarea
              id="credit-reason"
              rows={3}
              placeholder="예: 고객 보상 / 결제 오류 보정"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending}>
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
