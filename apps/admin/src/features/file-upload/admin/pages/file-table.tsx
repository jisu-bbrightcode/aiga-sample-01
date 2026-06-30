import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/shadcn/table";
import { FileReviewBadge, FileStatusBadge } from "../components/file-status-badge";
import { FileVisibilityCell } from "../components/file-visibility-cell";
import { formatDateTime, formatFileSize } from "../lib/format";
import { type AdminFileAsset, FILE_SOURCE_LABELS } from "../types";

interface FileTableProps {
  files: AdminFileAsset[];
  isLoading?: boolean;
  onSelect: (file: AdminFileAsset) => void;
}

/**
 * 관리자 파일 목록 테이블.
 *
 * Shows owner / target / status / visibility / size / createdAt per AC §2;
 * clicking a row opens the detail drawer (상세 · 수정 · 삭제/복구).
 */
export function FileTable({ files, isLoading, onSelect }: FileTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-muted-foreground">로딩 중...</div>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-muted-foreground">조건에 맞는 파일이 없습니다.</div>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>파일</TableHead>
          <TableHead>소유자</TableHead>
          <TableHead>대상</TableHead>
          <TableHead>상태</TableHead>
          <TableHead>공개</TableHead>
          <TableHead>검수</TableHead>
          <TableHead className="text-right">크기</TableHead>
          <TableHead>생성일</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {files.map((file) => (
          <TableRow
            key={file.fileAssetId}
            className="cursor-pointer"
            onClick={() => onSelect(file)}
          >
            <TableCell className="font-medium">
              <div className="break-all">{file.originalName}</div>
              <div className="text-xs text-muted-foreground">
                {file.contentType ?? "알 수 없는 형식"} · {FILE_SOURCE_LABELS[file.source]}
              </div>
            </TableCell>
            <TableCell className="font-mono text-xs">{file.ownerUserId ?? "-"}</TableCell>
            <TableCell className="text-sm">
              {file.targetType ? (
                <>
                  <div>{file.targetType}</div>
                  <div className="text-xs text-muted-foreground break-all">
                    {file.targetId ?? "-"}
                  </div>
                </>
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </TableCell>
            <TableCell>
              <FileStatusBadge status={file.status} />
            </TableCell>
            <TableCell>
              <FileVisibilityCell visibility={file.visibility} />
            </TableCell>
            <TableCell>
              <FileReviewBadge reviewStatus={file.reviewStatus} />
            </TableCell>
            <TableCell className="text-right text-sm">{formatFileSize(file.size)}</TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {formatDateTime(file.createdAt)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
