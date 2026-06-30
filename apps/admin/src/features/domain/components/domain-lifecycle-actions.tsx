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
import { Archive, RotateCcw } from "lucide-react";
import { useState } from "react";
import { useDomainResourceLifecycle } from "../hooks/use-domain-resource-lifecycle";
import type { DomainResourceDetail } from "../types";

/**
 * Archive / restore actions for a domain resource detail page.
 *
 * - 공개(published)·초안(draft) 리소스: "보관" → archive (공개/앱 노출 차단).
 * - 보관(archived) 리소스: "복구" → restore (비공개 draft 로 되살림).
 * - 이미 soft-delete 된 리소스는 이 lifecycle 대상이 아니므로 액션을 숨긴다.
 *
 * 각 액션은 되돌릴 수 있지만 공개 노출에 영향을 주므로 확인 다이얼로그를 거친다.
 * PB-ADMIN-DOMAIN-DELETE-001 / BBR-682.
 */
export function DomainLifecycleActions({ detail }: { detail: DomainResourceDetail }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const isArchived = detail.status === "archived";
  const action = isArchived ? "restore" : "archive";
  const mutation = useDomainResourceLifecycle(action);

  // 삭제된 리소스는 archive/restore 흐름의 범위 밖이다 (별도 복구 경로 필요).
  if (detail.ops.isDeleted) {
    return <span className="text-sm text-muted-foreground">삭제된 리소스</span>;
  }

  function handleConfirm() {
    mutation.mutate(
      { type: detail.type, id: detail.id },
      { onSettled: () => setConfirmOpen(false) },
    );
  }

  const confirmLabel = isArchived ? "복구" : "보관";
  const confirmActionLabel = mutation.isPending ? "처리 중..." : confirmLabel;

  return (
    <>
      <Button
        type="button"
        variant={isArchived ? "outline" : "secondary"}
        size="sm"
        onClick={() => setConfirmOpen(true)}
        disabled={mutation.isPending}
      >
        {isArchived ? (
          <>
            <RotateCcw className="mr-2 size-3.5" />
            복구
          </>
        ) : (
          <>
            <Archive className="mr-2 size-3.5" />
            보관
          </>
        )}
      </Button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isArchived ? "리소스를 복구하시겠습니까?" : "리소스를 보관하시겠습니까?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isArchived
                ? `"${detail.name}"을(를) 비공개 초안 상태로 복구합니다. 다시 공개하려면 별도로 발행해야 합니다.`
                : `"${detail.name}"을(를) 보관합니다. 공개/앱 노출에서 즉시 제외되지만, 연결된 데이터와 이력은 그대로 보존됩니다.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutation.isPending}>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={mutation.isPending}>
              {confirmActionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
