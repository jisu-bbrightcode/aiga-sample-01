/**
 * 프로젝트 삭제 확인 다이얼로그.
 * 사용자가 프로젝트 이름을 정확히 입력해야 삭제 버튼 활성화.
 */

import { useFeatureTranslation } from "@repo/core/i18n";
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
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { usePermanentlyDeleteProject } from "@/features/project/hooks/use-project-mutations";

interface ProjectDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
}

export function ProjectDeleteDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
}: ProjectDeleteDialogProps) {
  const [confirmName, setConfirmName] = useState("");
  const navigate = useNavigate();
  const deleteProject = usePermanentlyDeleteProject();
  const { t } = useFeatureTranslation("feature.story");

  const isMatch = confirmName === projectName;

  function handleDelete() {
    if (!isMatch) return;
    deleteProject.mutate(projectId, {
      onSuccess: () => {
        onOpenChange(false);
        setConfirmName("");
        navigate({ to: "/" });
      },
    });
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setConfirmName("");
    }
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("project.delete.title")}</DialogTitle>
          <DialogDescription>
            {t("project.delete.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 py-2">
          <p className="text-sm text-muted-foreground">
            {t("project.delete.confirmPrefix")}{" "}
            <span className="font-semibold text-foreground">{projectName}</span>
            {t("project.delete.confirmSuffix")}
          </p>
          <Input
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            placeholder={projectName}
            autoComplete="off"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            {t("project.delete.cancel")}
          </Button>
          <Button
            variant="destructive"
            disabled={!isMatch || deleteProject.isPending}
            onClick={handleDelete}
          >
            {deleteProject.isPending ? t("project.delete.deleting") : t("project.delete.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
