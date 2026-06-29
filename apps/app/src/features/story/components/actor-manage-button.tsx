"use no memo";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@repo/ui/shadcn/alert-dialog";
import { Button } from "@repo/ui/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/shadcn/dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, MessageCircle, UserCheck, UserX } from "lucide-react";
import {
  characterChatKeys,
  disableCharacterActor,
  prepareCharacterActor,
  useCharacterActorByCharacter,
} from "../api/operator-chat";

interface ActorManageButtonProps {
  characterId: string;
  projectId: string;
}

export function ActorManageButton({ characterId, projectId }: ActorManageButtonProps) {
  const qc = useQueryClient();

  const { data: actor, isLoading } = useCharacterActorByCharacter(characterId);

  const prepare = useMutation({
    mutationFn: prepareCharacterActor,
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: characterChatKeys.actorByCharacter(characterId),
      });
      // sidebar ChatSidebarSection이 actor.list를 사용하므로 함께 invalidate
      void qc.invalidateQueries({
        queryKey: characterChatKeys.actors(projectId),
      });
    },
  });

  const disable = useMutation({
    mutationFn: disableCharacterActor,
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: characterChatKeys.actorByCharacter(characterId),
      });
      void qc.invalidateQueries({
        queryKey: characterChatKeys.actors(projectId),
      });
    },
  });

  if (isLoading) return null;

  const status = actor?.status ?? "not_enabled";

  if (status === "preparing") {
    return (
      <div
        className="flex items-center gap-2 text-sm text-muted-foreground"
        data-el="actor.preparing"
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        운영 오퍼레이터를 준비하고 있습니다
      </div>
    );
  }

  if (status === "ready") {
    return (
      <div className="flex items-center gap-2" data-el="actor.ready">
        <Button
          variant="outline"
          size="sm"
          render={<a href={`/p/${projectId}/chat/${characterId}`} />}
          data-el="actor.chat-link"
        >
          <MessageCircle className="mr-2 h-4 w-4" />
          오퍼레이터와 대화
        </Button>
        <AlertDialog>
          <AlertDialogTrigger
            render={<Button variant="ghost" size="sm" data-el="actor.disable-trigger" />}
          >
            <UserX className="h-4 w-4" />
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>운영 오퍼레이터 비활성화</AlertDialogTitle>
              <AlertDialogDescription>아래 내용을 확인하고 진행하세요.</AlertDialogDescription>
              <ul className="text-foreground mt-3 space-y-2 text-sm">
                <li className="flex gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>이 항목의 오퍼레이터를 더 이상 채팅에서 사용할 수 없게 됩니다.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>좌측 사이드바의 오퍼레이터 대화 목록에서 이 항목이 제거됩니다.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>기존 대화 기록과 thread는 DB에 그대로 남습니다.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>다시 준비하면 오퍼레이터 목록에 재노출되어 이어서 대화할 수 있습니다.</span>
                </li>
              </ul>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>취소</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => actor && disable.mutate({ actorId: actor.id })}
                data-el="actor.disable-confirm"
              >
                삭제
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => prepare.mutate({ projectId, characterId })}
        disabled={prepare.isPending}
        data-el="actor.retry"
      >
        {prepare.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        다시 시도
      </Button>
    );
  }

  // not_enabled
  return (
    <Dialog>
      <DialogTrigger
        render={<Button variant="outline" size="sm" data-el="actor.prepare-trigger" />}
      >
        <UserCheck className="mr-2 h-4 w-4" />
        운영 오퍼레이터로 준비
      </DialogTrigger>
      <DialogContent data-el="actor.prepare-dialog">
        <DialogHeader>
          <DialogTitle data-el="actor.prepare-dialog-title">운영 오퍼레이터로 준비</DialogTitle>
          <DialogDescription>아래 내용을 확인하고 진행하세요.</DialogDescription>
        </DialogHeader>
        <ul className="text-foreground my-2 space-y-2 text-sm" data-el="actor.prepare-dialog-notes">
          <li className="flex gap-2">
            <span className="text-muted-foreground">•</span>
            <span>이 항목을 기준으로 운영 오퍼레이터와 채팅할 수 있게 됩니다.</span>
          </li>
          <li className="flex gap-2" data-el="actor.prepare-dialog-cost">
            <span aria-hidden>⚠️</span>
            <span className="text-destructive font-medium">
              사용량에 따라 비용이 발생할 수 있습니다.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-muted-foreground">•</span>
            <span>준비 완료 직후 좌측 사이드바의 오퍼레이터 대화 목록에 나타납니다.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-muted-foreground">•</span>
            <span>대화 기억은 원본 문서 데이터와 분리되어 저장됩니다.</span>
          </li>
        </ul>
        <DialogFooter>
          <Button
            onClick={() => prepare.mutate({ projectId, characterId })}
            disabled={prepare.isPending}
            data-el="actor.prepare-confirm"
          >
            {prepare.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            준비하기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
