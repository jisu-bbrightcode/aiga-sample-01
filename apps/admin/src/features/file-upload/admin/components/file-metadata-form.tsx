import { Button } from "@repo/ui/shadcn/button";
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
import { useUpdateFileMetadata } from "../hooks/use-file-mutations";
import {
  type AdminFileAsset,
  type AdminFileMetadataPatch,
  FILE_REVIEW_STATUS_LABELS,
  FILE_VISIBILITY_LABELS,
  type FileReviewStatus,
  type FileVisibility,
} from "../types";

interface FileMetadataFormProps {
  file: AdminFileAsset;
  onSaved?: () => void;
}

const VISIBILITY_OPTIONS = Object.keys(FILE_VISIBILITY_LABELS) as FileVisibility[];
const REVIEW_OPTIONS = Object.keys(FILE_REVIEW_STATUS_LABELS) as FileReviewStatus[];

/** Trimmed string or `undefined` (empty → undefined). */
function trimmed(value: string): string | undefined {
  const next = value.trim();
  return next.length > 0 ? next : undefined;
}

/**
 * 파일 metadata 수정 폼 (PATCH /admin/files/:id).
 *
 * Only edits the fields the admin list projects (display name, target link,
 * visibility, moderation review status). Sends only what actually changed, so a
 * no-op save records no audit entry. The binary is never touched — metadata +
 * review status only (AC §3 metadata 변경 감사).
 */
export function FileMetadataForm({ file, onSaved }: FileMetadataFormProps) {
  const [displayName, setDisplayName] = useState(file.originalName);
  const [targetType, setTargetType] = useState(file.targetType ?? "");
  const [targetId, setTargetId] = useState(file.targetId ?? "");
  const [visibility, setVisibility] = useState<FileVisibility>(file.visibility);
  const [reviewStatus, setReviewStatus] = useState<FileReviewStatus>(file.reviewStatus);
  const [reason, setReason] = useState("");

  const mutation = useUpdateFileMetadata();

  const buildPatch = (): AdminFileMetadataPatch => {
    const patch: AdminFileMetadataPatch = {};
    const nextName = trimmed(displayName);
    if (nextName && nextName !== file.originalName) patch.displayName = nextName;

    const nextTargetType = trimmed(targetType) ?? null;
    if (nextTargetType !== (file.targetType ?? null)) patch.targetType = nextTargetType;

    const nextTargetId = trimmed(targetId) ?? null;
    if (nextTargetId !== (file.targetId ?? null)) patch.targetId = nextTargetId;

    if (visibility !== file.visibility) patch.visibility = visibility;
    if (reviewStatus !== file.reviewStatus) patch.reviewStatus = reviewStatus;

    const nextReason = trimmed(reason);
    if (nextReason) patch.reason = nextReason;
    return patch;
  };

  const handleSave = () => {
    const patch = buildPatch();
    // Drop `reason` when it's the only key — there is nothing to record.
    const metadataKeys = Object.keys(patch).filter((k) => k !== "reason");
    if (metadataKeys.length === 0) return;

    mutation.mutate(
      { fileAssetId: file.fileAssetId, patch },
      {
        onSuccess: () => {
          setReason("");
          onSaved?.();
        },
      },
    );
  };

  const isDeleted = file.status === "deleted";

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        handleSave();
      }}
    >
      <div>
        <Label htmlFor="file-display-name">표시명</Label>
        <Input
          id="file-display-name"
          value={displayName}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDisplayName(e.target.value)}
          className="mt-1"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="file-target-type">대상 유형</Label>
          <Input
            id="file-target-type"
            placeholder="예: hospital"
            value={targetType}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTargetType(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="file-target-id">대상 ID</Label>
          <Input
            id="file-target-id"
            value={targetId}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTargetId(e.target.value)}
            className="mt-1"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="file-visibility">공개 여부</Label>
          <Select
            value={visibility}
            onValueChange={(v: string | null) => v && setVisibility(v as FileVisibility)}
          >
            <SelectTrigger id="file-visibility" className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VISIBILITY_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {FILE_VISIBILITY_LABELS[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="file-review-status">검수 상태</Label>
          <Select
            value={reviewStatus}
            onValueChange={(v: string | null) => v && setReviewStatus(v as FileReviewStatus)}
          >
            <SelectTrigger id="file-review-status" className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REVIEW_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {FILE_REVIEW_STATUS_LABELS[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="file-reason">변경 사유 (감사 로그 기록용, 선택)</Label>
        <Input
          id="file-reason"
          value={reason}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReason(e.target.value)}
          className="mt-1"
        />
      </div>

      {isDeleted ? (
        <p className="text-sm text-muted-foreground">
          삭제된 파일은 수정할 수 없습니다. 먼저 복구한 뒤 수정하세요.
        </p>
      ) : null}

      {mutation.isError ? (
        <p className="text-sm text-destructive">
          {mutation.error instanceof Error ? mutation.error.message : "수정에 실패했습니다."}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={mutation.isPending || isDeleted}>
          {mutation.isPending ? "저장 중..." : "변경 저장"}
        </Button>
      </div>
    </form>
  );
}
