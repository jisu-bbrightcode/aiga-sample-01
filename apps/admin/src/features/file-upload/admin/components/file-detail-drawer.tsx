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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@repo/ui/shadcn/sheet";
import { RotateCcw, Trash2 } from "lucide-react";
import { useDeleteFile, useRestoreFile } from "../hooks/use-file-mutations";
import { formatDateTime, formatFileSize } from "../lib/format";
import { type AdminFileAsset, FILE_SOURCE_LABELS, FILE_VISIBILITY_LABELS } from "../types";
import { FileMetadataForm } from "./file-metadata-form";
import { FileReviewBadge, FileStatusBadge } from "./file-status-badge";

interface FileDetailDrawerProps {
  file: AdminFileAsset | null;
  onOpenChange: (open: boolean) => void;
}

function PropertyRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="col-span-2 break-all">{children}</dd>
    </div>
  );
}

/**
 * 파일 상세 Drawer — 전체 레코드(소유자/대상/상태/공개여부/크기/생성일 등)와
 * metadata 수정 폼, 삭제/복구 action을 한 화면에서 제공한다 (AC §2, §3).
 */
export function FileDetailDrawer({ file, onOpenChange }: FileDetailDrawerProps) {
  const deleteMutation = useDeleteFile();
  const restoreMutation = useRestoreFile();

  const isDeleted = file?.status === "deleted";

  const handleDelete = () => {
    if (!file) return;
    deleteMutation.mutate(file.fileAssetId);
  };

  const handleRestore = () => {
    if (!file) return;
    restoreMutation.mutate(file.fileAssetId);
  };

  return (
    <Sheet open={file != null} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        {file ? (
          <>
            <SheetHeader>
              <SheetTitle className="break-all">{file.originalName}</SheetTitle>
              <SheetDescription>파일 상세 정보 · 수정 · 삭제/복구</SheetDescription>
            </SheetHeader>

            <div className="space-y-6 px-4 pb-8">
              {/* 속성 */}
              <dl className="divide-y">
                <PropertyRow label="파일 ID">
                  <span className="font-mono text-xs">{file.fileAssetId}</span>
                </PropertyRow>
                <PropertyRow label="상태">
                  <FileStatusBadge status={file.status} />
                </PropertyRow>
                <PropertyRow label="검수">
                  <FileReviewBadge reviewStatus={file.reviewStatus} />
                </PropertyRow>
                <PropertyRow label="소유자">
                  {file.ownerUserId ? (
                    <span className="font-mono text-xs">{file.ownerUserId}</span>
                  ) : (
                    "-"
                  )}
                </PropertyRow>
                <PropertyRow label="출처">{FILE_SOURCE_LABELS[file.source]}</PropertyRow>
                <PropertyRow label="공개 여부">
                  {FILE_VISIBILITY_LABELS[file.visibility]}
                </PropertyRow>
                <PropertyRow label="대상 리소스">
                  {file.targetType ? `${file.targetType} / ${file.targetId ?? "-"}` : "-"}
                </PropertyRow>
                <PropertyRow label="크기">{formatFileSize(file.size)}</PropertyRow>
                <PropertyRow label="MIME 타입">{file.contentType ?? "-"}</PropertyRow>
                <PropertyRow label="스캔 상태">{file.scanStatus ?? "-"}</PropertyRow>
                <PropertyRow label="생성일">{formatDateTime(file.createdAt)}</PropertyRow>
                <PropertyRow label="완료일">{formatDateTime(file.completedAt)}</PropertyRow>
                {isDeleted ? (
                  <>
                    <PropertyRow label="삭제일">{formatDateTime(file.deletedAt)}</PropertyRow>
                    <PropertyRow label="삭제자">
                      {file.deletedBy ? (
                        <span className="font-mono text-xs">{file.deletedBy}</span>
                      ) : (
                        "-"
                      )}
                    </PropertyRow>
                  </>
                ) : null}
                {file.url ? (
                  <PropertyRow label="URL">
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline"
                    >
                      열기
                    </a>
                  </PropertyRow>
                ) : null}
              </dl>

              {/* metadata 수정 */}
              <section className="space-y-3">
                <h3 className="text-sm font-semibold">정보 수정</h3>
                <FileMetadataForm file={file} />
              </section>

              {/* 삭제 / 복구 */}
              <section className="space-y-3">
                <h3 className="text-sm font-semibold">삭제 / 복구</h3>
                {restoreMutation.isError ? (
                  <p className="text-sm text-destructive">
                    {restoreMutation.error instanceof Error
                      ? restoreMutation.error.message
                      : "복구에 실패했습니다."}
                  </p>
                ) : null}
                {deleteMutation.isError ? (
                  <p className="text-sm text-destructive">
                    {deleteMutation.error instanceof Error
                      ? deleteMutation.error.message
                      : "삭제에 실패했습니다."}
                  </p>
                ) : null}

                {isDeleted ? (
                  <Button
                    variant="outline"
                    onClick={handleRestore}
                    disabled={restoreMutation.isPending}
                  >
                    <RotateCcw className="mr-2 size-3.5" />
                    {restoreMutation.isPending ? "복구 중..." : "파일 복구"}
                  </Button>
                ) : (
                  <AlertDialog>
                    <AlertDialogTrigger
                      render={
                        <Button variant="destructive" disabled={deleteMutation.isPending}>
                          <Trash2 className="mr-2 size-3.5" />
                          파일 삭제
                        </Button>
                      }
                    />
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>파일을 삭제할까요?</AlertDialogTitle>
                        <AlertDialogDescription>
                          삭제하면 모든 공개/소유자 화면에서 즉시 숨겨집니다. 삭제 작업은 감사
                          로그에 기록되며, 필요 시 복구할 수 있습니다.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>취소</AlertDialogCancel>
                        <AlertDialogAction variant="destructive" onClick={handleDelete}>
                          삭제
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </section>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
