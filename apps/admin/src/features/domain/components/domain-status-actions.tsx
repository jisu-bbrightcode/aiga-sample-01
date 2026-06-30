import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@repo/ui/shadcn/alert-dialog";
import { Button } from "@repo/ui/shadcn/button";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useChangeDomainStatus } from "../hooks/use-change-domain-status";
import { type DomainStatusAction, statusActionsFor } from "../transitions";
import type { DomainResourceDetail } from "../types";

/**
 * 공개(published) ↔ 비공개(draft) 상태 변경 액션 (PB-ADMIN-DOMAIN-UPDATE-001 / BBR-681).
 *
 * 현재 상태에서 허용된 전이만 버튼으로 노출하고 (AC#1), 각 변경은 확인 다이얼로그를
 * 거쳐 서버의 검증·감사 경로로 처리된다 (AC#2). 보관/복구(archive/restore)는 별도
 * {@link ./domain-lifecycle-actions} 가 담당하므로 여기서는 다루지 않는다. 삭제된
 * 리소스는 상태 변경 대상이 아니다.
 */
export function DomainStatusActions({ detail }: { detail: DomainResourceDetail }) {
  const [pendingAction, setPendingAction] = useState<DomainStatusAction | null>(null);
  const mutation = useChangeDomainStatus();

  if (detail.ops.isDeleted) {
    return null;
  }

  const actions = statusActionsFor(detail.status);
  if (actions.length === 0) {
    return null;
  }

  function handleConfirm() {
    if (!pendingAction) return;
    mutation.mutate(
      { type: detail.type, id: detail.id, status: pendingAction.to },
      { onSettled: () => setPendingAction(null) },
    );
  }

  return (
    <>
      {actions.map((action) => (
        <Button
          key={action.to}
          type="button"
          variant={action.to === "published" ? "default" : "secondary"}
          size="sm"
          onClick={() => setPendingAction(action)}
          disabled={mutation.isPending}
        >
          {action.to === "published" ? (
            <Eye className="mr-2 size-3.5" />
          ) : (
            <EyeOff className="mr-2 size-3.5" />
          )}
          {action.label}
        </Button>
      ))}

      <AlertDialog
        open={pendingAction !== null}
        onOpenChange={(open) => {
          if (!open) setPendingAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingAction?.label} 하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>{pendingAction?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutation.isPending}>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={mutation.isPending}>
              {mutation.isPending ? "처리 중..." : (pendingAction?.label ?? "확인")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
