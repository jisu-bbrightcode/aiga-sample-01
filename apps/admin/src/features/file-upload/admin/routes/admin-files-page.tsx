import { Button } from "@repo/ui/shadcn/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/shadcn/card";
import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { FileDetailDrawer } from "../components/file-detail-drawer";
import { FILES_ADMIN_DEFAULT_PAGE_SIZE } from "../constants";
import { useAdminFiles } from "../hooks/use-admin-files";
import { CleanupPanel } from "../pages/cleanup-panel";
import { FileFilters, type FileFilterValues } from "../pages/file-filters";
import { FileTable } from "../pages/file-table";
import type { AdminFileAsset } from "../types";

const INITIAL_FILTERS: FileFilterValues = {
  ownerUserId: "",
  targetType: "",
  targetId: "",
  contentType: "",
  status: undefined,
  visibility: undefined,
  source: undefined,
  includeDeleted: false,
};

/**
 * Admin 파일 관리/감사 콘솔 — `/files` (PB-FILE-ADMIN-001 / BBR-555).
 *
 * 관리자가 파일 목록/상세를 확인하고, owner/target/status/visibility 필터로
 * 검색하며, metadata 수정·삭제/복구·Blob 정리(cleanup)를 수행하는 화면.
 * AdminGuard 하위 라우트이므로 관리자만 접근할 수 있다 (AC §1).
 */
export function AdminFilesPage() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<FileFilterValues>(INITIAL_FILTERS);
  // Debounced copy of the free-text filters so each keystroke doesn't refetch.
  const [debounced, setDebounced] = useState<FileFilterValues>(INITIAL_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebounced(filters);
      setPage(1);
    }, 300);
    return () => clearTimeout(handle);
  }, [filters]);

  const { data, isLoading, isFetching, isError, error, refetch } = useAdminFiles({
    page,
    limit: FILES_ADMIN_DEFAULT_PAGE_SIZE,
    ownerUserId: debounced.ownerUserId.trim() || undefined,
    targetType: debounced.targetType.trim() || undefined,
    targetId: debounced.targetId.trim() || undefined,
    contentType: debounced.contentType.trim() || undefined,
    status: debounced.status,
    visibility: debounced.visibility,
    source: debounced.source,
    includeDeleted: debounced.includeDeleted,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = total > 0 ? Math.ceil(total / FILES_ADMIN_DEFAULT_PAGE_SIZE) : 0;

  // Resolve the open drawer's file from the latest list data so status/metadata
  // edits are reflected immediately (the row is re-fetched after each mutation).
  const selected = selectedId ? (items.find((f) => f.fileAssetId === selectedId) ?? null) : null;

  const handleFilterChange = (patch: Partial<FileFilterValues>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  };

  const handleSelect = (file: AdminFileAsset) => setSelectedId(file.fileAssetId);

  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      <div>
        <h1 className="text-3xl font-bold">파일 관리</h1>
        <p className="text-muted-foreground">
          업로드된 파일을 검색·확인하고 정보 수정, 삭제/복구, Blob 정리를 수행합니다
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>파일 목록</CardTitle>
              <CardDescription>
                소유자·대상·상태·공개여부·크기·생성일을 확인하고 필터로 검색할 수 있습니다
              </CardDescription>
            </div>
            <Button onClick={() => refetch()} variant="outline" size="sm" disabled={isFetching}>
              <RefreshCw className={isFetching ? "mr-2 size-3.5 animate-spin" : "mr-2 size-3.5"} />
              새로고침
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <FileFilters values={filters} onChange={handleFilterChange} />

          {isError ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="text-destructive">
                {error instanceof Error ? error.message : "목록을 불러오지 못했습니다."}
              </div>
              <Button onClick={() => refetch()} variant="outline" size="sm">
                다시 시도
              </Button>
            </div>
          ) : (
            <FileTable files={items} isLoading={isLoading} onSelect={handleSelect} />
          )}

          {!isError && total > 0 ? (
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                총 {total.toLocaleString("ko-KR")}개 · {page} / {Math.max(totalPages, 1)} 페이지
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={page <= 1 || isFetching}
                >
                  이전
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((prev) => prev + 1)}
                  disabled={page >= totalPages || isFetching}
                >
                  다음
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <CleanupPanel />

      <FileDetailDrawer file={selected} onOpenChange={(open) => !open && setSelectedId(null)} />
    </div>
  );
}
